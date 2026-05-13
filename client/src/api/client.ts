import type {
  User,
  Backend,
  BackendModelsResponse,
  ModelCacheOverview,
  ModelRewriteRule,
  Permission,
  RequestLogPage,
  UsageStats,
  BackendMetrics,
  AnalyticsDailyTotalsPoint,
  AnalyticsBackendQualityPoint,
  AnalyticsModelTrendPoint,
  AnalyticsHistogramBin,
  AnalyticsBoxPlotPoint,
  DashboardSummaryResponse,
  UserScript,
  CreateScriptData,
  UpdateScriptData,
  AdminApiTokenSummary,
  AdminSessionResponse,
} from '../types';

const API_BASE = '';
let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setAdminCsrfToken(nextToken: string | null) {
  csrfToken = nextToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase());
  const nextHeaders: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (isUnsafeMethod) {
    nextHeaders['Content-Type'] = nextHeaders['Content-Type'] ?? 'application/json';
  }

  if (isUnsafeMethod && url.startsWith('/admin') && csrfToken) {
    nextHeaders['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...nextHeaders,
    },
  });

  if (response.status === 204) {
    return {} as T;
  }

  const payload = await response.json().catch(() => ({ error: 'Request failed' }));

  if (!response.ok) {
    if (response.status === 401 && !url.endsWith('/admin/auth/session')) {
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

export const api = {
  auth: {
    getSession: (): Promise<AdminSessionResponse> => fetchJson<AdminSessionResponse>(`${API_BASE}/admin/auth/session`),
    login: (username: string, password: string): Promise<AdminSessionResponse> =>
      fetchJson<AdminSessionResponse>(`${API_BASE}/admin/auth/login`, { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: (): Promise<void> => fetchJson<void>(`${API_BASE}/admin/auth/logout`, { method: 'POST' }),
    beginOidc: (next: string = window.location.pathname) => {
      const search = new URLSearchParams({ next });
      window.location.href = `${API_BASE}/admin/auth/oidc/start?${search.toString()}`;
    },
    getTokens: (): Promise<AdminApiTokenSummary[]> => fetchJson<AdminApiTokenSummary[]>(`${API_BASE}/admin/auth/tokens`),
    createToken: (name: string, expiresInDays?: number): Promise<{ token: string; record: AdminApiTokenSummary }> =>
      fetchJson(`${API_BASE}/admin/auth/tokens`, { method: 'POST', body: JSON.stringify({ name, expiresInDays }) }),
    deleteToken: (id: number): Promise<void> => fetchJson<void>(`${API_BASE}/admin/auth/tokens/${id}`, { method: 'DELETE' }),
  },
  users: {
    getAll: (): Promise<User[]> => fetchJson<User[]>(`${API_BASE}/admin/users`),
    getById: (id: number): Promise<User> => fetchJson<User>(`${API_BASE}/admin/users/${id}`),
    create: (data: { name: string; email?: string; api_key?: string; detail_logging?: boolean; copy_reasoning_to_reasoning_content?: boolean }): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<User>): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' }),
    regenerateApiKey: (id: number): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users/${id}/regenerate-api-key`, { method: 'POST' }),
  },

  backends: {
    getAll: (): Promise<Backend[]> => fetchJson<Backend[]>(`${API_BASE}/admin/backends`),
    getById: (id: number): Promise<Backend> => fetchJson<Backend>(`${API_BASE}/admin/backends/${id}`),
    getModels: (id: number): Promise<BackendModelsResponse> => fetchJson<BackendModelsResponse>(`${API_BASE}/admin/backends/${id}/models`),
    refreshModels: (id: number): Promise<BackendModelsResponse> =>
      fetchJson<BackendModelsResponse>(`${API_BASE}/admin/backends/${id}/models/refresh`, { method: 'POST' }),
    create: (data: { name: string; base_url: string; api_key?: string; detail_logging?: boolean }): Promise<Backend> =>
      fetchJson<Backend>(`${API_BASE}/admin/backends`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Backend>): Promise<Backend> =>
      fetchJson<Backend>(`${API_BASE}/admin/backends/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/backends/${id}`, { method: 'DELETE' }),
  },

  permissions: {
    getAll: (): Promise<Permission[]> => fetchJson<Permission[]>(`${API_BASE}/admin/permissions`),
    getByUser: (userId: number): Promise<Permission[]> =>
      fetchJson<Permission[]>(`${API_BASE}/admin/permissions/user/${userId}`),
    getByBackend: (backendId: number): Promise<Permission[]> =>
      fetchJson<Permission[]>(`${API_BASE}/admin/permissions/backend/${backendId}`),
    create: (data: { user_id: number; backend_id: number }): Promise<Permission> =>
      fetchJson<Permission>(`${API_BASE}/admin/permissions`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (userId: number, backendId: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/permissions?user_id=${userId}&backend_id=${backendId}`, { method: 'DELETE' }),
  },

  modelRewrites: {
    getAll: (): Promise<ModelRewriteRule[]> => fetchJson<ModelRewriteRule[]>(`${API_BASE}/admin/model-rewrites`),
    create: (data: { source_model: string; target_model: string; is_active?: boolean; force?: boolean; note?: string }): Promise<ModelRewriteRule> =>
      fetchJson<ModelRewriteRule>(`${API_BASE}/admin/model-rewrites`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ModelRewriteRule>): Promise<ModelRewriteRule> =>
      fetchJson<ModelRewriteRule>(`${API_BASE}/admin/model-rewrites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/model-rewrites/${id}`, { method: 'DELETE' }),
  },

  modelCache: {
    getOverview: (): Promise<ModelCacheOverview> => fetchJson<ModelCacheOverview>(`${API_BASE}/admin/models/cache`),
  },

  scripts: {
    getAll: (): Promise<UserScript[]> => fetchJson<UserScript[]>(`${API_BASE}/admin/scripts`),
    getById: (id: number): Promise<UserScript> => fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}`),
    create: (data: CreateScriptData): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UpdateScriptData): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/scripts/${id}`, { method: 'DELETE' }),
    activate: (id: number): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}/activate`, { method: 'POST' }),
    deactivate: (id: number): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}/deactivate`, { method: 'POST' }),
    test: (id: number, context: { user?: User; backend?: Backend; request: { method: string; path: string; headers: Record<string, string>; body: unknown; isStream: boolean } }): Promise<{ success: boolean; error?: string; executionTime?: number }> =>
      fetchJson(`${API_BASE}/admin/scripts/${id}/test`, { method: 'POST', body: JSON.stringify(context) }),
  },

  dashboard: {
    getSummary: (days: number = 30): Promise<DashboardSummaryResponse> => {
      const params = new URLSearchParams();
      params.append('days', String(days));
      return fetchJson<DashboardSummaryResponse>(`${API_BASE}/admin/dashboard/summary?${params}`);
    },
  },

  analytics: {
    getUsage: (userId?: number, backendId?: number, days: number = 30): Promise<UsageStats[]> => {
      const params = new URLSearchParams();
      if (userId) params.append('userId', String(userId));
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<UsageStats[]>(`${API_BASE}/admin/analytics/usage?${params}`);
    },
    getRequests: (params: { limit?: number; offset?: number; month?: string; date?: string; q?: string; userId?: number; backendId?: number; endpoint?: string; detailLogged?: boolean } = {}): Promise<RequestLogPage> => {
      const search = new URLSearchParams();
      search.set('limit', String(params.limit ?? 100));
      search.set('offset', String(params.offset ?? 0));
      if (params.month) search.set('month', params.month);
      if (params.date) search.set('date', params.date);
      if (params.q) search.set('q', params.q);
      if (params.userId) search.set('userId', String(params.userId));
      if (params.backendId) search.set('backendId', String(params.backendId));
      if (params.endpoint) search.set('endpoint', params.endpoint);
      if (params.detailLogged !== undefined) search.set('detailLogged', params.detailLogged ? '1' : '0');
      return fetchJson<RequestLogPage>(`${API_BASE}/admin/analytics/requests?${search}`);
    },
    getMetrics: (backendId?: number, days: number = 30): Promise<BackendMetrics[]> => {
      const params = new URLSearchParams();
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<BackendMetrics[]>(`${API_BASE}/admin/analytics/metrics?${params}`);
    },
    getDailyTotals: (backendId?: number, days: number = 30): Promise<AnalyticsDailyTotalsPoint[]> => {
      const params = new URLSearchParams();
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<AnalyticsDailyTotalsPoint[]>(`${API_BASE}/admin/analytics/daily-totals?${params}`);
    },
    getBackendQuality: (backendId?: number, days: number = 30): Promise<AnalyticsBackendQualityPoint[]> => {
      const params = new URLSearchParams();
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<AnalyticsBackendQualityPoint[]>(`${API_BASE}/admin/analytics/backend-quality?${params}`);
    },
    getModelTrends: (params: { backendId?: number; days?: number; limit?: number } = {}): Promise<AnalyticsModelTrendPoint[]> => {
      const search = new URLSearchParams();
      if (params.backendId) search.set('backendId', String(params.backendId));
      search.set('days', String(params.days ?? 30));
      search.set('limit', String(params.limit ?? 8));
      return fetchJson<AnalyticsModelTrendPoint[]>(`${API_BASE}/admin/analytics/model-trends?${search}`);
    },
    getResponseLengthHistogram: (params: { backendId?: number; days?: number; bins?: number } = {}): Promise<AnalyticsHistogramBin[]> => {
      const search = new URLSearchParams();
      if (params.backendId) search.set('backendId', String(params.backendId));
      search.set('days', String(params.days ?? 30));
      search.set('bins', String(params.bins ?? 20));
      return fetchJson<AnalyticsHistogramBin[]>(`${API_BASE}/admin/analytics/response-length-histogram?${search}`);
    },
    getResponseLengthBoxPlot: (backendId?: number, days: number = 30): Promise<AnalyticsBoxPlotPoint[]> => {
      const params = new URLSearchParams();
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<AnalyticsBoxPlotPoint[]>(`${API_BASE}/admin/analytics/response-length-box-plot?${params}`);
    },
  },
};
