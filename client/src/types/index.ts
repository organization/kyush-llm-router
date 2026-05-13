export type User = {
  id: number;
  api_key: string;
  name: string;
  email?: string;
  is_active: boolean;
  detail_logging: boolean;
  copy_reasoning_to_reasoning_content: boolean;
  created_at: string;
  updated_at: string;
};

export type Backend = {
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
  model_cache_state?: 'ready' | 'uninitialized' | 'error' | 'inactive';
};

export type BackendModelSnapshot = {
  id: number;
  backend_id: number;
  model_id: string;
  raw_json?: string;
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type BackendModelCacheStatus = {
  backend_id: number;
  initialized: boolean;
  state: 'ready' | 'uninitialized' | 'error' | 'inactive';
  model_count: number;
  last_synced_at?: string;
  last_attempted_at?: string;
  last_error?: string;
};

export type BackendModelsResponse = {
  backend: Backend;
  cache: BackendModelCacheStatus;
  snapshots: BackendModelSnapshot[];
  models: string[];
};

export type BackendModelCatalogEntry = {
  model_id: string;
  backend_ids: number[];
};

export type ModelCacheOverview = {
  backends: BackendModelCacheStatus[];
  models: BackendModelCatalogEntry[];
};

export type ModelRewriteRule = {
  id: number;
  source_model: string;
  target_model: string;
  is_active: boolean;
  force: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: number;
  user_id: number;
  backend_id: number;
  created_at: string;
};

export type RequestLog = {
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
};

export type RequestLogPage = {
  rows: RequestLog[];
  total: number;
  limit: number;
  offset: number;
};

export type UsageStats = {
  id: number;
  user_id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
};

export type BackendMetrics = {
  id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
};

export type AnalyticsDailyTotalsPoint = {
  date: string;
  total_requests: number;
  total_tokens: number;
};

export type AnalyticsBackendQualityPoint = {
  date: string;
  backend_id: number;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
};

export type AnalyticsModelTrendPoint = {
  date: string;
  model: string;
  request_count: number;
};

export type AnalyticsHistogramBin = {
  bin_start: number;
  bin_end: number;
  count: number;
};

export type AnalyticsBoxPlotPoint = {
  date: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
};

export type DashboardHealthStatus = {
  status: 'ok';
  timestamp: string;
};

export type DashboardOverviewSummary = {
  total_users: number;
  active_users: number;
  total_backends: number;
  active_backends: number;
  total_permissions: number;
  total_scripts: number;
  active_scripts: number;
};

export type DashboardHealthSummary = {
  cache_state_counts: Record<Backend['model_cache_state'] extends infer T ? Extract<T, string> : never, number>;
  stale_backends: Array<{
    id: number;
    name: string;
    state: NonNullable<Backend['model_cache_state']>;
    last_synced_at?: string;
  }>;
  public_health: DashboardHealthStatus;
  admin_health: DashboardHealthStatus;
};

export type DashboardLoggingSummary = {
  users_with_detail_logging: number;
  backends_with_detail_logging: number;
};

export type DashboardScriptSummary = {
  active_by_type: Record<ScriptType, number>;
  total_by_type: Record<ScriptType, number>;
};

export type DashboardAccessSummary = {
  permission_assignments: number;
  users_without_permissions: number;
};

export type DashboardSummaryResponse = {
  window_days: number;
  generated_at: string;
  overview: DashboardOverviewSummary;
  health: DashboardHealthSummary;
  logging: DashboardLoggingSummary;
  scripts: DashboardScriptSummary;
  access: DashboardAccessSummary;
  series: {
    daily_totals: AnalyticsDailyTotalsPoint[];
    backend_quality: AnalyticsBackendQualityPoint[];
    model_trends: AnalyticsModelTrendPoint[];
  };
};

export type ScriptType = 'per-user-backend' | 'per-backend' | 'per-user';

export type UserScript = {
  id: number;
  name: string;
  script_type: ScriptType;
  target_user_id: number | null;
  target_backend_id: number | null;
  script_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateScriptData = {
  name: string;
  script_type: ScriptType;
  target_user_id?: number | null;
  target_backend_id?: number | null;
  script_code: string;
  is_active?: boolean;
};

export type UpdateScriptData = {
  name?: string;
  script_type?: ScriptType;
  target_user_id?: number | null;
  target_backend_id?: number | null;
  script_code?: string;
  is_active?: boolean;
};

export type AdminAuthMode = 'env' | 'oidc' | 'both';

export type AdminPrincipal = {
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  displayName: string;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  authMode: AdminAuthMode;
  csrfToken: string | null;
  principal: AdminPrincipal | null;
};

export type AdminApiTokenSummary = {
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
};
