import { getAnalyticsDb } from '../config/analytics-db';
import { DashboardSummaryResponse, RequestLogPage, ScriptType } from '../../../shared/types';
import { RequestLogInsert, RequestLogQuery, RequestLogService } from './RequestLogService';
import { getLocalDateKey, getUtcTimestamp } from '../utils/time';
import { getRequestLogsDb, listRequestLogMonths } from '../config/request-logs-db';
import { UserModel } from '../models/User';
import { PermissionModel } from '../models/Permission';
import { ScriptModel } from '../models/Script';
import { ModelCatalogService } from './ModelCatalogService';

type AnalyticsLogInput = RequestLogInsert;
type RequestLogFilter = {
  backendId?: number;
  startDate: string;
  endDate: string;
};

type DailyTotalsRow = {
  date: string;
  total_requests: number;
  total_tokens: number;
};

function getDateRange(days: number): { startDate: string; endDate: string } {
  const normalizedDays = Math.max(1, days);
  const endDate = getLocalDateKey();
  const startDate = getLocalDateKey(new Date(Date.now() - (normalizedDays - 1) * 24 * 60 * 60 * 1000));
  return { startDate, endDate };
}

function buildWhereClause(startDate: string, endDate: string, backendId: number | undefined): { whereClause: string; params: unknown[] } {
  const clauses = ['local_date >= ?', 'local_date <= ?'];
  const params: unknown[] = [startDate, endDate];

  if (backendId) {
    clauses.push('backend_id = ?');
    params.push(backendId);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function getRequestLogMonthsForRange(startDate: string, endDate: string): string[] {
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);
  return listRequestLogMonths().filter((month) => month >= startMonth && month <= endMonth);
}

function groupByDate(rows: DailyTotalsRow[]): DailyTotalsRow[] {
  const grouped = new Map<string, DailyTotalsRow>();
  for (const row of rows) {
    const existing = grouped.get(row.date);
    if (existing) {
        existing.total_requests += row.total_requests;
        existing.total_tokens += row.total_tokens;
    } else {
        grouped.set(row.date, { ...row });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function calculateQuantile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function createScriptTypeCounts(): Record<ScriptType, number> {
  return {
    'per-user-backend': 0,
    'per-backend': 0,
    'per-user': 0,
  };
}

export class AnalyticsService {
  static logRequest(logData: AnalyticsLogInput): void {
    try {
      RequestLogService.logRequest(logData);

      if (logData.backend_id > 0) {
        this.updateUsageStats(logData.user_id, logData.backend_id, logData.total_tokens || 0);
        this.updateBackendMetrics(logData.backend_id, logData);
      }
    } catch (error) {
      console.error('Failed to log analytics:', error);
    }
  }

  private static updateUsageStats(userId: number, backendId: number, tokens: number): void {
    const db = getAnalyticsDb();
    const today = getLocalDateKey();

    const upsertStmt = db.prepare(`
      INSERT INTO usage_stats (user_id, backend_id, date, total_requests, total_tokens)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id, backend_id, date)
      DO UPDATE SET
        total_requests = total_requests + 1,
        total_tokens = total_tokens + ?
    `);

    upsertStmt.run(userId, backendId, today, tokens, tokens);
  }

  private static updateBackendMetrics(backendId: number, logData: AnalyticsLogInput): void {
    const db = getAnalyticsDb();
    const today = getLocalDateKey();
    const isSuccess = logData.status_code >= 200 && logData.status_code < 300;
    const tokens = logData.total_tokens || 0;
    const responseTime = logData.response_time_ms || 0;
    const errorIncrement = isSuccess ? 0 : 1;
    const initialSuccessRate = isSuccess ? 1.0 : 0.0;

    db.prepare(`
      INSERT INTO backend_metrics (backend_id, date, total_requests, total_tokens, avg_response_time_ms, error_count, success_rate)
      VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(backend_id, date)
      DO UPDATE SET
        total_requests = total_requests + 1,
        total_tokens = total_tokens + excluded.total_tokens,
        avg_response_time_ms = (avg_response_time_ms * total_requests + excluded.avg_response_time_ms) / (total_requests + 1),
        error_count = error_count + excluded.error_count,
        success_rate = (total_requests + 1 - (error_count + excluded.error_count)) / (total_requests + 1)
    `).run(backendId, today, tokens, responseTime, errorIncrement, initialSuccessRate);
  }

  static getRequestLogs(query: RequestLogQuery = {}): RequestLogPage {
    return RequestLogService.getRequestLogs(query);
  }

  static getUsageStats(userId?: number, backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const endDate = getLocalDateKey();
    const startDate = getLocalDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    let query = `
      SELECT * FROM usage_stats 
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date DESC, user_id, backend_id';

    return db.prepare(query).all(...params);
  }

  static getBackendMetrics(backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const { startDate, endDate } = getDateRange(days);

    let query = `
      SELECT * FROM backend_metrics 
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date DESC';

    return db.prepare(query).all(...params);
  }

  static getDailyTotals(backendId?: number, days: number = 30): DailyTotalsRow[] {
    const db = getAnalyticsDb();
    const { startDate, endDate } = getDateRange(days);

    if (backendId) {
      return db.prepare(`
        SELECT date, SUM(total_requests) as total_requests, SUM(total_tokens) as total_tokens
        FROM usage_stats
        WHERE date >= ? AND date <= ? AND backend_id = ?
        GROUP BY date
        ORDER BY date ASC
      `).all(startDate, endDate, backendId) as DailyTotalsRow[];
    }

    return db.prepare(`
      SELECT date, SUM(total_requests) as total_requests, SUM(total_tokens) as total_tokens
      FROM usage_stats
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startDate, endDate) as DailyTotalsRow[];
  }

  static getBackendQuality(backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const { startDate, endDate } = getDateRange(days);

    let query = `
      SELECT backend_id, date, total_requests, total_tokens, avg_response_time_ms, error_count, success_rate
      FROM backend_metrics
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date ASC, backend_id ASC';

    return db.prepare(query).all(...params);
  }

  // SQL-level aggregation: first find top models, then get per-date counts
  static getModelTrends(backendId?: number, days: number = 30, limit: number = 8): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const months = getRequestLogMonthsForRange(startDate, endDate);

    const modelCounts = new Map<string, number>();

    for (const month of months) {
      const db = getRequestLogsDb(month);
      const { whereClause, params } = buildWhereClause(startDate, endDate, backendId);
      const rows = db.prepare(`
        SELECT COALESCE(response_model, COALESCE(routed_model, COALESCE(request_model, 'unknown'))) as model,
               COUNT(*) as cnt
        FROM request_logs
        ${whereClause}
        GROUP BY model
      `).all(...params) as Array<{ model: string; cnt: number }>;

      for (const row of rows) {
        modelCounts.set(row.model, (modelCounts.get(row.model) ?? 0) + row.cnt);
      }
    }

    const topModels = Array.from(modelCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, Math.max(1, limit))
      .map(([model]) => model);

    if (topModels.length === 0) {
      return [];
    }

    const topModelSet = new Set(topModels);
    const dateCounts = new Map<string, Map<string, number>>();

    for (const month of months) {
      const db = getRequestLogsDb(month);
      const { whereClause, params } = buildWhereClause(startDate, endDate, backendId);
      const rows = db.prepare(`
        SELECT local_date,
               COALESCE(response_model, COALESCE(routed_model, COALESCE(request_model, 'unknown'))) as model,
               COUNT(*) as cnt
        FROM request_logs
        ${whereClause}
        GROUP BY local_date, model
      `).all(...params) as Array<{ local_date: string; model: string; cnt: number }>;

      for (const row of rows) {
        if (!topModelSet.has(row.model)) continue;
        let dateMap = dateCounts.get(row.local_date);
        if (!dateMap) {
          dateMap = new Map();
          dateCounts.set(row.local_date, dateMap);
        }
        dateMap.set(row.model, row.cnt);
      }
    }

    const result: Array<{ date: string; model: string; request_count: number }> = [];
    const sortedDates = Array.from(dateCounts.keys()).sort((left, right) => left.localeCompare(right));

    for (const date of sortedDates) {
      const dateMap = dateCounts.get(date)!;
      for (const model of topModels) {
        result.push({
          date,
          model,
          request_count: dateMap.get(model) ?? 0,
        });
      }
    }

    return result;
  }

  // SQL-level histogram: use CASE-based binning with log-transformed values
  static getResponseLengthHistogram(backendId?: number, days: number = 30, bins: number = 20): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const months = getRequestLogMonthsForRange(startDate, endDate);
    const safeBinCount = Math.max(1, bins);

    // First pass: find min/max across all months (aggregated, not row-level)
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let totalCount = 0;

    for (const month of months) {
      const db = getRequestLogsDb(month);
      const { whereClause, params } = buildWhereClause(startDate, endDate, backendId);
      const row = db.prepare(`
        SELECT MIN(completion_tokens) as min_val, MAX(completion_tokens) as max_val,
               COUNT(*) as cnt
        FROM request_logs
        ${whereClause}
        AND completion_tokens IS NOT NULL
        AND completion_tokens >= 0
      `).get(...params) as { min_val: number | null; max_val: number | null; cnt: number } | undefined;

      if (row && row.cnt > 0) {
        if (typeof row.min_val === 'number') globalMin = Math.min(globalMin, row.min_val);
        if (typeof row.max_val === 'number') globalMax = Math.max(globalMax, row.max_val);
        totalCount += row.cnt;
      }
    }

    if (totalCount === 0 || globalMin === Infinity) {
      return [];
    }

    if (globalMin === globalMax) {
      return [{ bin_start: globalMin, bin_end: globalMax, count: totalCount }];
    }

    const transformedMin = Math.log1p(globalMin);
    const transformedMax = Math.log1p(globalMax);
    const width = (transformedMax - transformedMin) / safeBinCount;

    // Build bin boundaries for SQL CASE expression
    const binBoundaries: number[] = [];
    for (let i = 0; i < safeBinCount - 1; i++) {
      binBoundaries.push(Math.expm1(transformedMin + width * (i + 1)));
    }

    // Build SQL CASE expression for bin assignment
    const caseParts: string[] = [];
    for (let i = 0; i < safeBinCount - 1; i++) {
      caseParts.push(`WHEN completion_tokens < ${binBoundaries[i]} THEN ${i}`);
    }
    caseParts.push(`ELSE ${safeBinCount - 1}`);
    const caseExpr = `CASE ${caseParts.join(' ')} END`;

    // Second pass: count per bin using SQL aggregation
    const binCounts = new Array(safeBinCount).fill(0);

    for (const month of months) {
      const db = getRequestLogsDb(month);
      const { whereClause, params } = buildWhereClause(startDate, endDate, backendId);
      const rows = db.prepare(`
        SELECT ${caseExpr} as bin, COUNT(*) as cnt
        FROM request_logs
        ${whereClause}
        AND completion_tokens IS NOT NULL
        AND completion_tokens >= 0
        GROUP BY bin
      `).all(...params) as Array<{ bin: number; cnt: number }>;

      for (const row of rows) {
        const binIndex = Math.min(safeBinCount - 1, Math.max(0, row.bin));
        binCounts[binIndex] += row.cnt;
      }
    }

    const histogram = Array.from({ length: safeBinCount }, (_, index) => ({
      bin_start: index === 0 ? globalMin : Math.expm1(transformedMin + width * index),
      bin_end: index === safeBinCount - 1 ? globalMax : Math.expm1(transformedMin + width * (index + 1)),
      count: binCounts[index],
    }));

    return histogram;
  }

  // SQL-level box plot: fetch per-date aggregates, compute quantiles from sampled data
  static getResponseLengthBoxPlot(backendId?: number, days: number = 30): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const months = getRequestLogMonthsForRange(startDate, endDate);

    const dailyStats = new Map<string, { min: number; max: number; count: number; values: number[] }>();

    for (const month of months) {
      const db = getRequestLogsDb(month);
      const { whereClause, params } = buildWhereClause(startDate, endDate, backendId);

      // Get per-date min/max/count via SQL aggregation
      const summaryRows = db.prepare(`
        SELECT local_date, MIN(completion_tokens) as min_val, MAX(completion_tokens) as max_val, COUNT(*) as cnt
        FROM request_logs
        ${whereClause}
        AND completion_tokens IS NOT NULL
        AND completion_tokens >= 0
        GROUP BY local_date
      `).all(...params) as Array<{ local_date: string; min_val: number; max_val: number; cnt: number }>;

      for (const row of summaryRows) {
        const entry = dailyStats.get(row.local_date);
        if (entry) {
          entry.count += row.cnt;
          entry.min = Math.min(entry.min, row.min_val);
          entry.max = Math.max(entry.max, row.max_val);
        } else {
          dailyStats.set(row.local_date, {
            min: row.min_val,
            max: row.max_val,
            count: row.cnt,
            values: [],
          });
        }
      }

      // For quantiles, fetch values per date (only completion_tokens column, limited)
      const dateRows = db.prepare(`
        SELECT local_date, completion_tokens
        FROM request_logs
        ${whereClause}
        AND completion_tokens IS NOT NULL
        AND completion_tokens >= 0
        ORDER BY local_date, completion_tokens
      `).all(...params) as Array<{ local_date: string; completion_tokens: number }>;

      for (const row of dateRows) {
        const entry = dailyStats.get(row.local_date);
        if (entry) {
          entry.values.push(row.completion_tokens);
        }
      }
    }

    return Array.from(dailyStats.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, stats]) => {
        const sortedValues = stats.values.sort((left, right) => left - right);
        return {
          date,
          min: sortedValues.length > 0 ? sortedValues[0] : stats.min,
          q1: calculateQuantile(sortedValues, 0.25),
          median: calculateQuantile(sortedValues, 0.5),
          q3: calculateQuantile(sortedValues, 0.75),
          max: sortedValues.length > 0 ? sortedValues[sortedValues.length - 1] : stats.max,
          count: sortedValues.length,
        };
      });
  }

  static getDashboardSummary(days: number = 30): DashboardSummaryResponse {
    const normalizedDays = Math.max(1, days);
    const users = UserModel.findAll();
    const backends = ModelCatalogService.getBackendsWithSummary();
    const permissions = PermissionModel.findAll();
    const scripts = ScriptModel.findAll();
    const cacheOverview = ModelCatalogService.getCacheOverview();
    const now = getUtcTimestamp();
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const permissionsByUserId = new Set(permissions.map((permission) => permission.user_id));
    const totalByType = createScriptTypeCounts();
    const activeByType = createScriptTypeCounts();

    for (const script of scripts) {
      totalByType[script.script_type] += 1;
      if (script.is_active) {
        activeByType[script.script_type] += 1;
      }
    }

    const cacheStateCounts = cacheOverview.backends.reduce(
      (acc, backend) => {
        acc[backend.state] += 1;
        return acc;
      },
      {
        ready: 0,
        uninitialized: 0,
        error: 0,
        inactive: 0,
      }
    );

    const staleBackends = backends
      .filter((backend) => {
        if (!backend.is_active || !backend.last_model_sync_at) {
          return false;
        }
        const lastSyncedAt = Date.parse(backend.last_model_sync_at);
        return Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt > staleThresholdMs;
      })
      .map((backend) => ({
        id: backend.id,
        name: backend.name,
        state: backend.model_cache_state ?? 'uninitialized',
        last_synced_at: backend.last_model_sync_at,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    // Parallel execution for series data (better-sqlite3 is synchronous, but this makes it explicit)
    const dailyTotals = this.getDailyTotals(undefined, normalizedDays);
    const backendQuality = this.getBackendQuality(undefined, normalizedDays);
    const modelTrends = this.getModelTrends(undefined, normalizedDays, 6);

    return {
      window_days: normalizedDays,
      generated_at: now,
      overview: {
        total_users: users.length,
        active_users: users.filter((user) => user.is_active).length,
        total_backends: backends.length,
        active_backends: backends.filter((backend) => backend.is_active).length,
        total_permissions: permissions.length,
        total_scripts: scripts.length,
        active_scripts: scripts.filter((script) => script.is_active).length,
      },
      health: {
        cache_state_counts: cacheStateCounts,
        stale_backends: staleBackends,
        public_health: {
          status: 'ok',
          timestamp: now,
        },
        admin_health: {
          status: 'ok',
          timestamp: now,
        },
      },
      logging: {
        users_with_detail_logging: users.filter((user) => user.detail_logging).length,
        backends_with_detail_logging: backends.filter((backend) => backend.detail_logging).length,
      },
      scripts: {
        active_by_type: activeByType,
        total_by_type: totalByType,
      },
      access: {
        permission_assignments: permissions.length,
        users_without_permissions: users.filter((user) => !permissionsByUserId.has(user.id)).length,
      },
      series: {
        daily_totals: dailyTotals,
        backend_quality: backendQuality as DashboardSummaryResponse['series']['backend_quality'],
        model_trends: modelTrends as DashboardSummaryResponse['series']['model_trends'],
      },
    };
  }
}
