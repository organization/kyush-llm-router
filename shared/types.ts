export interface User {
  id: number;
  api_key: string;
  name: string;
  email?: string;
  is_active: boolean;
  detail_logging: boolean;
  created_at: string;
  updated_at: string;
}

export interface Backend {
  id: number;
  name: string;
  base_url: string;
  api_key?: string;
  is_active: boolean;
  detail_logging: boolean;
  created_at: string;
  updated_at: string;
  cached_model_count?: number;
  last_model_sync_at?: string;
  model_cache_initialized?: boolean;
  model_cache_state?: ModelCacheState;
}

export interface BackendModelSnapshot {
  id: number;
  backend_id: number;
  model_id: string;
  raw_json?: string;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export type ModelCacheState = 'ready' | 'uninitialized' | 'error' | 'inactive';

export interface BackendModelCacheStatus {
  backend_id: number;
  initialized: boolean;
  state: ModelCacheState;
  model_count: number;
  last_synced_at?: string;
  last_attempted_at?: string;
  last_error?: string;
}

export interface BackendModelCatalogEntry {
  model_id: string;
  backend_ids: number[];
}

export interface BackendModelsResponse {
  backend: Backend;
  cache: BackendModelCacheStatus;
  snapshots: BackendModelSnapshot[];
  models: string[];
}

export interface ModelCacheOverview {
  backends: BackendModelCacheStatus[];
  models: BackendModelCatalogEntry[];
}

export interface ModelRewriteRule {
  id: number;
  source_model: string;
  target_model: string;
  is_active: boolean;
  force: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateModelRewriteData {
  source_model: string;
  target_model: string;
  is_active?: boolean;
  force?: boolean;
  note?: string;
}

export interface UpdateModelRewriteData {
  source_model?: string;
  target_model?: string;
  is_active?: boolean;
  force?: boolean;
  note?: string;
}

export interface Permission {
  id: number;
  user_id: number;
  backend_id: number;
  created_at: string;
}

export interface CreateUserData {
  name: string;
  email?: string;
  detail_logging?: boolean;
}

export interface CreateBackendData {
  name: string;
  base_url: string;
  api_key?: string;
  detail_logging?: boolean;
}

export interface CreatePermissionData {
  user_id: number;
  backend_id: number;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  is_active?: boolean;
  detail_logging?: boolean;
}

export interface UpdateBackendData {
  name?: string;
  base_url?: string;
  api_key?: string;
  is_active?: boolean;
  detail_logging?: boolean;
}

export interface RequestLog {
  id: number;
  user_id: number;
  backend_id: number;
  endpoint: string;
  request_model?: string;
  routed_model?: string;
  response_model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  status_code: number;
  response_time_ms?: number;
  error_message?: string;
  detail_logged: boolean;
  local_date: string;
  request_headers?: string;
  request_body?: string;
  response_headers?: string;
  response_body?: string;
  created_at: string;
}

export interface RequestLogPage {
  rows: RequestLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface UsageStats {
  id: number;
  user_id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
}

export interface BackendMetrics {
  id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
}

export interface AnalyticsDailyTotalsPoint {
  date: string;
  total_requests: number;
  total_tokens: number;
}

export interface AnalyticsBackendQualityPoint {
  date: string;
  backend_id: number;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
}

export interface AnalyticsModelTrendPoint {
  date: string;
  model: string;
  request_count: number;
}

export interface AnalyticsHistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface AnalyticsBoxPlotPoint {
  date: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export type ScriptType = 'per-user-backend' | 'per-backend' | 'per-user';

export interface UserScript {
  id: number;
  name: string;
  script_type: ScriptType;
  target_user_id: number | null;
  target_backend_id: number | null;
  script_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateScriptData {
  name: string;
  script_type: ScriptType;
  target_user_id?: number | null;
  target_backend_id?: number | null;
  script_code: string;
  is_active?: boolean;
}

export interface UpdateScriptData {
  name?: string;
  script_type?: ScriptType;
  target_user_id?: number | null;
  target_backend_id?: number | null;
  script_code?: string;
  is_active?: boolean;
}

export type AdminAuthMode = 'env' | 'oidc' | 'both';

export interface AdminPrincipal {
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  displayName: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  authMode: AdminAuthMode;
  csrfToken: string | null;
  principal: AdminPrincipal | null;
}

export interface AdminApiTokenSummary {
  id: number;
  name: string;
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  display_name: string;
  token_prefix: string;
  expires_at: string;
  last_used_at?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Serializable script context data that can be transferred across isolate boundaries
 * via structured clone ({ copy: true }).
 * Non-serializable values (ReadableStream, callbacks) are NOT included here.
 */
export interface ScriptContextData {
  user: { id: number; name: string; email?: string } | null;
  backend: { id: number; name: string; base_url: string } | null;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
    isStream: boolean;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    isStream: boolean;
  };
}
