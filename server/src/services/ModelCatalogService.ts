import {
  Backend,
  BackendModelCacheStatus,
  BackendModelCatalogEntry,
  BackendModelsResponse,
  ModelCacheOverview,
  ModelRewriteRule,
} from '../../../shared/types';
import { BackendModel } from '../models/Backend';
import { BackendModelSnapshotModel } from '../models/BackendModelSnapshot';
import { ModelRewriteModel } from '../models/ModelRewrite';
import { getUtcTimestamp } from '../utils/time';
import { logger } from '../utils/logger';

interface BackendCacheEntry {
  backendId: number;
  initialized: boolean;
  modelIds: string[];
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  lastError?: string;
}

interface RefreshOptions {
  force?: boolean;
  reason?: string;
}

interface FetchModelsResponse {
  models: string[];
  rawModels: Array<{ model_id: string; raw_json?: string }>;
}

interface RewriteResolution {
  requestedModel: string;
  routedModel: string;
  wasRewritten: boolean;
  ruleType: 'none' | 'force' | 'fallback' | 'chain';
}

interface RewriteConfig {
  id: number;
  sourceModel: string;
  targetModel: string;
  force: boolean;
}

interface ResolutionContext {
  allowedActiveBackendIds: number[];
  allowedActiveBackendIdSet: Set<number>;
  candidateMemo: Map<string, number[]>;
}

const DEFAULT_REFRESH_MIN_MS = 5 * 60 * 1000;

export class ModelRewriteCycleError extends Error {
  cycle: string[];

  constructor(cycle: string[]) {
    super(`Model rewrite cycle detected: ${cycle.join(' -> ')}`);
    this.name = 'ModelRewriteCycleError';
    this.cycle = cycle;
  }
}

export class ModelCatalogService {
  private static backendModelsByBackendId = new Map<number, BackendCacheEntry>();
  private static backendIdsByModel = new Map<string, Set<number>>();
  private static modelRewriteMap = new Map<string, RewriteConfig>();
  private static inFlightRefreshes = new Map<number, Promise<BackendModelCacheStatus>>();
  private static initialized = false;

  private static getRefreshMinMs(): number {
    const raw = process.env.MODEL_CATALOG_REFRESH_MIN_MS;
    if (!raw) return DEFAULT_REFRESH_MIN_MS;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REFRESH_MIN_MS;
  }

  private static normalizeModelId(modelId: string): string {
    return modelId.trim();
  }

  private static getCacheEntry(backendId: number): BackendCacheEntry {
    const existing = this.backendModelsByBackendId.get(backendId);
    if (existing) return existing;

    const created: BackendCacheEntry = {
      backendId,
      initialized: false,
      modelIds: [],
    };
    this.backendModelsByBackendId.set(backendId, created);
    return created;
  }

  private static statusFromEntry(entry: BackendCacheEntry, backend?: Backend): BackendModelCacheStatus {
    const active = backend ? backend.is_active : true;
    let state: BackendModelCacheStatus['state'];
    if (!active) {
      state = 'inactive';
    } else if (entry.lastError) {
      state = 'error';
    } else if (entry.initialized) {
      state = 'ready';
    } else {
      state = 'uninitialized';
    }

    return {
      backend_id: entry.backendId,
      initialized: entry.initialized,
      state,
      model_count: entry.modelIds.length,
      last_synced_at: entry.lastSyncedAt,
      last_attempted_at: entry.lastAttemptedAt,
      last_error: entry.lastError,
    };
  }

  private static rebuildModelIndex(): void {
    this.backendIdsByModel.clear();
    const backends = new Map(BackendModel.findAll().map((backend) => [backend.id, backend]));

    for (const entry of this.backendModelsByBackendId.values()) {
      const backend = backends.get(entry.backendId);
      if (!backend?.is_active) {
        continue;
      }

      for (const modelId of entry.modelIds) {
        const normalized = this.normalizeModelId(modelId);
        const ids = this.backendIdsByModel.get(normalized) || new Set<number>();
        ids.add(entry.backendId);
        this.backendIdsByModel.set(normalized, ids);
      }
    }
  }

  private static async fetchBackendModels(backend: Backend): Promise<FetchModelsResponse> {
    let backendPath = '/v1/models';
    if (backend.base_url.includes('/v1')) {
      backendPath = '/models';
    }
    const url = backend.base_url.replace(/\/$/, '') + backendPath;
    const headers: Record<string, string> = {};
    if (backend.api_key) {
      headers.Authorization = `Bearer ${backend.api_key}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Backend model fetch failed with HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => ({} as any));
    const data = payload && typeof payload === 'object' && Array.isArray((payload as any).data)
      ? (payload as any).data
      : [];

    const seen = new Set<string>();
    const rawModels: Array<{ model_id: string; raw_json?: string }> = [];
    const models: string[] = [];

    for (const item of data) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
        continue;
      }
      const modelId = this.normalizeModelId(item.id);
      if (!modelId || seen.has(modelId)) {
        continue;
      }
      seen.add(modelId);
      models.push(modelId);
      rawModels.push({
        model_id: modelId,
        raw_json: JSON.stringify(item),
      });
    }

    return { models, rawModels };
  }

  static async initialize(): Promise<void> {
    this.loadRewriteMap();
    this.syncActiveBackendCacheState();

    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const activeBackends = BackendModel.findActive();
    await Promise.allSettled(activeBackends.map((backend) => this.refreshBackendModels(backend.id, { reason: 'startup' })));
  }

  static reset(): void {
    this.backendModelsByBackendId.clear();
    this.backendIdsByModel.clear();
    this.modelRewriteMap.clear();
    this.inFlightRefreshes.clear();
    this.initialized = false;
  }

  static loadRewriteMap(): void {
    this.modelRewriteMap.clear();
    for (const rule of ModelRewriteModel.findAll()) {
      if (rule.is_active) {
        const sourceModel = this.normalizeModelId(rule.source_model);
        const targetModel = this.normalizeModelId(rule.target_model);
        this.modelRewriteMap.set(sourceModel, {
          id: rule.id,
          sourceModel,
          targetModel,
          force: rule.force,
        });
      }
    }
  }

  private static createResolutionContext(allowedBackendIds: number[]): ResolutionContext {
    const allowed = new Set(allowedBackendIds);
    const allowedActiveBackendIds = BackendModel.findActive()
      .map((backend) => backend.id)
      .filter((backendId) => allowed.has(backendId));

    return {
      allowedActiveBackendIds,
      allowedActiveBackendIdSet: new Set(allowedActiveBackendIds),
      candidateMemo: new Map<string, number[]>(),
    };
  }

  static getActiveAllowedBackendIds(allowedBackendIds: number[]): number[] {
    return this.createResolutionContext(allowedBackendIds).allowedActiveBackendIds;
  }

  private static getCandidateBackendIdsWithContext(modelId: string, context: ResolutionContext): number[] {
    const normalized = this.normalizeModelId(modelId);
    const memoized = context.candidateMemo.get(normalized);
    if (memoized) return memoized;

    const backendIds = this.backendIdsByModel.get(normalized);
    const candidates = backendIds
      ? Array.from(backendIds).filter((backendId) => context.allowedActiveBackendIdSet.has(backendId))
      : [];
    const sorted = candidates.sort((a, b) => a - b);

    context.candidateMemo.set(normalized, sorted);
    return sorted;
  }

  private static getRuleTypeFromAppliedRules(appliedRules: RewriteConfig[]): RewriteResolution['ruleType'] {
    if (appliedRules.length === 0) {
      return 'none';
    }
    if (appliedRules.length === 1) {
      return appliedRules[0].force ? 'force' : 'fallback';
    }
    return 'chain';
  }

  static syncActiveBackendCacheState(): void {
    const backends = BackendModel.findAll();
    const backendIds = new Set(backends.map((backend) => backend.id));

    for (const backend of backends) {
      const entry = this.getCacheEntry(backend.id);
      if (!backend.is_active) {
        entry.modelIds = [];
      }
    }

    for (const backendId of Array.from(this.backendModelsByBackendId.keys())) {
      if (!backendIds.has(backendId)) {
        this.backendModelsByBackendId.delete(backendId);
      }
    }

    this.rebuildModelIndex();
  }

  private static resolveRequestedModelWithContext(modelId: string, context: ResolutionContext): RewriteResolution {
    const requestedModel = this.normalizeModelId(modelId);
    const visitedModels = new Map<string, number>();
    const path: string[] = [];
    const appliedRules: RewriteConfig[] = [];
    let currentModel = requestedModel;
    const maxSteps = this.modelRewriteMap.size + 1;

    for (let step = 0; step <= maxSteps; step += 1) {
      const firstSeenAt = visitedModels.get(currentModel);
      if (firstSeenAt !== undefined) {
        throw new ModelRewriteCycleError([...path.slice(firstSeenAt), currentModel]);
      }
      visitedModels.set(currentModel, path.length);
      path.push(currentModel);

      const rewrite = this.modelRewriteMap.get(currentModel);
      if (!rewrite) {
        return {
          requestedModel,
          routedModel: currentModel,
          wasRewritten: currentModel !== requestedModel,
          ruleType: this.getRuleTypeFromAppliedRules(appliedRules),
        };
      }

      if (!rewrite.force) {
        const originalCandidates = this.getCandidateBackendIdsWithContext(currentModel, context);
        if (originalCandidates.length > 0) {
          return {
            requestedModel,
            routedModel: currentModel,
            wasRewritten: currentModel !== requestedModel,
            ruleType: this.getRuleTypeFromAppliedRules(appliedRules),
          };
        }
      }

      appliedRules.push(rewrite);
      currentModel = this.normalizeModelId(rewrite.targetModel);
    }

    throw new ModelRewriteCycleError([...path, currentModel]);
  }

  static resolveRequestedModel(modelId: string, allowedBackendIds: number[]): RewriteResolution {
    return this.resolveRequestedModelWithContext(modelId, this.createResolutionContext(allowedBackendIds));
  }

  static detectRewriteCycle(rules: ModelRewriteRule[]): string[] | null {
    const activeRules = new Map<string, string>();
    for (const rule of rules) {
      if (rule.is_active) {
        activeRules.set(this.normalizeModelId(rule.source_model), this.normalizeModelId(rule.target_model));
      }
    }

    const visited = new Set<string>();
    const visiting = new Map<string, number>();
    const path: string[] = [];

    const visit = (modelId: string): string[] | null => {
      const firstSeenAt = visiting.get(modelId);
      if (firstSeenAt !== undefined) {
        return [...path.slice(firstSeenAt), modelId];
      }
      if (visited.has(modelId)) {
        return null;
      }

      visiting.set(modelId, path.length);
      path.push(modelId);

      const targetModel = activeRules.get(modelId);
      if (targetModel) {
        const cycle = visit(targetModel);
        if (cycle) {
          return cycle;
        }
      }

      path.pop();
      visiting.delete(modelId);
      visited.add(modelId);
      return null;
    };

    for (const sourceModel of activeRules.keys()) {
      const cycle = visit(sourceModel);
      if (cycle) {
        return cycle;
      }
    }

    return null;
  }

  static getRequestableModelsForAllowedBackends(allowedBackendIds: number[]): BackendModelCatalogEntry[] {
    const context = this.createResolutionContext(allowedBackendIds);
    const requestableModelIds = new Set<string>();
    const candidateModelIds = new Set<string>([
      ...this.backendIdsByModel.keys(),
      ...this.modelRewriteMap.keys(),
    ]);

    for (const modelId of candidateModelIds) {
      const resolution = this.resolveRequestedModelWithContext(modelId, context);
      const routedBackendIds = this.getCandidateBackendIdsWithContext(resolution.routedModel, context);
      if (routedBackendIds.length > 0) {
        requestableModelIds.add(this.normalizeModelId(modelId));
      }
    }

    return Array.from(requestableModelIds)
      .sort((a, b) => a.localeCompare(b))
      .map((modelId) => {
        const resolution = this.resolveRequestedModelWithContext(modelId, context);
        return {
          model_id: modelId,
          backend_ids: this.getCandidateBackendIdsWithContext(resolution.routedModel, context),
        };
      });
  }

  static getBackendCacheStatus(backendId: number): BackendModelCacheStatus {
    const backend = BackendModel.findById(backendId);
    const entry = this.getCacheEntry(backendId);
    return this.statusFromEntry(entry, backend);
  }

  static getBackendsWithSummary(): Backend[] {
    return BackendModel.findAll().map((backend) => {
      const status = this.getBackendCacheStatus(backend.id);
      return {
        ...backend,
        cached_model_count: status.model_count,
        last_model_sync_at: status.last_synced_at,
        model_cache_initialized: status.initialized,
        model_cache_state: status.state,
      } as Backend & {
        cached_model_count: number;
        last_model_sync_at?: string;
        model_cache_initialized: boolean;
        model_cache_state: BackendModelCacheStatus['state'];
      };
    });
  }

  static async ensureInitializedForBackends(backendIds: number[]): Promise<void> {
    const refreshes: Promise<BackendModelCacheStatus>[] = [];
    for (const backendId of backendIds) {
      const backend = BackendModel.findById(backendId);
      if (!backend?.is_active) continue;
      const entry = this.getCacheEntry(backendId);
      if (!entry.initialized) {
        refreshes.push(this.refreshBackendModels(backendId, { reason: 'lazy-init' }));
      }
    }
    await Promise.allSettled(refreshes);
  }

  static async refreshBackendModels(backendId: number, options: RefreshOptions = {}): Promise<BackendModelCacheStatus> {
    const backend = BackendModel.findById(backendId);
    const entry = this.getCacheEntry(backendId);

    if (!backend) {
      this.backendModelsByBackendId.delete(backendId);
      this.rebuildModelIndex();
      return this.statusFromEntry(entry);
    }

    if (!backend.is_active) {
      entry.initialized = false;
      entry.modelIds = [];
      entry.lastError = undefined;
      this.rebuildModelIndex();
      return this.statusFromEntry(entry, backend);
    }

    const now = Date.now();
    const lastAttempt = entry.lastAttemptedAt ? Date.parse(entry.lastAttemptedAt) : 0;
    if (!options.force && lastAttempt && now - lastAttempt < this.getRefreshMinMs()) {
      return this.statusFromEntry(entry, backend);
    }

    const existing = this.inFlightRefreshes.get(backendId);
    if (existing) {
      return existing;
    }

    const refreshPromise = (async () => {
      entry.lastAttemptedAt = getUtcTimestamp();
      try {
        const fetchedAt = getUtcTimestamp();
        const { models, rawModels } = await this.fetchBackendModels(backend);
        entry.modelIds = models;
        entry.initialized = true;
        entry.lastSyncedAt = fetchedAt;
        entry.lastError = undefined;
        BackendModelSnapshotModel.replaceForBackend(backendId, rawModels, fetchedAt);
        this.rebuildModelIndex();
        logger.info(`Model catalog refreshed for backend ${backendId}${options.reason ? ` (${options.reason})` : ''}`);
      } catch (error) {
        entry.initialized = true;
        entry.modelIds = [];
        entry.lastError = error instanceof Error ? error.message : 'Unknown model refresh error';
        this.rebuildModelIndex();
        logger.warn(`Model catalog refresh failed for backend ${backendId}: ${entry.lastError}`);
      } finally {
        this.inFlightRefreshes.delete(backendId);
      }

      return this.statusFromEntry(entry, backend);
    })();

    this.inFlightRefreshes.set(backendId, refreshPromise);
    return refreshPromise;
  }

  static async refreshBackendAfterFailure(backendId: number): Promise<void> {
    const backend = BackendModel.findById(backendId);
    if (!backend?.is_active) return;
    await this.refreshBackendModels(backendId, { reason: 'request-failure' });
  }

  static async handleBackendUpdated(backendId: number): Promise<void> {
    const backend = BackendModel.findById(backendId);
    if (!backend) {
      this.backendModelsByBackendId.delete(backendId);
      this.rebuildModelIndex();
      return;
    }

    if (!backend.is_active) {
      const entry = this.getCacheEntry(backendId);
      entry.initialized = false;
      entry.modelIds = [];
      entry.lastError = undefined;
      this.rebuildModelIndex();
      return;
    }

    await this.refreshBackendModels(backendId, { force: true, reason: 'admin-update' });
  }

  static getCandidateBackendIds(modelId: string, allowedBackendIds: number[]): number[] {
    return this.getCandidateBackendIdsWithContext(modelId, this.createResolutionContext(allowedBackendIds));
  }

  static getModelsForAllowedBackends(allowedBackendIds: number[]): BackendModelCatalogEntry[] {
    const allowed = new Set(allowedBackendIds);
    const entries: BackendModelCatalogEntry[] = [];
    for (const [modelId, backendIds] of this.backendIdsByModel.entries()) {
      const matched = Array.from(backendIds).filter((backendId) => allowed.has(backendId));
      if (matched.length > 0) {
        entries.push({ model_id: modelId, backend_ids: matched.sort((a, b) => a - b) });
      }
    }
    return entries.sort((a, b) => a.model_id.localeCompare(b.model_id));
  }

  static getBackendModelsResponse(backendId: number): BackendModelsResponse | null {
    const backend = BackendModel.findById(backendId);
    if (!backend) return null;

    return {
      backend: {
        ...backend,
        ...(this.getBackendsWithSummary().find((item) => item.id === backendId) || {}),
      },
      cache: this.getBackendCacheStatus(backendId),
      snapshots: BackendModelSnapshotModel.findByBackendId(backendId),
      models: [...this.getCacheEntry(backendId).modelIds],
    };
  }

  static getCacheOverview(): ModelCacheOverview {
    const backends = BackendModel.findAll()
      .map((backend) => this.statusFromEntry(this.getCacheEntry(backend.id), backend))
      .sort((a, b) => a.backend_id - b.backend_id);

    const models = Array.from(this.backendIdsByModel.entries())
      .map(([modelId, backendIds]) => ({
        model_id: modelId,
        backend_ids: Array.from(backendIds).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.model_id.localeCompare(b.model_id));

    return { backends, models };
  }

  static getRewriteRules(): ModelRewriteRule[] {
    return ModelRewriteModel.findAll();
  }
}
