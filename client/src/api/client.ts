import ky, {
  HTTPError,
  type KyInstance,
  type Options as KyOptions,
  type ResponsePromise,
} from 'ky';

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

/**
 * Base URL prepended by ky to every request.
 *
 * - In dev, the Vite proxy forwards `/admin/*` to the backend, so `'/'` is the right default.
 * - In prod (single-binary deploy), the dashboard is served from the same origin as the API.
 * - Override at build time with `VITE_API_BASE_URL` (e.g. `https://router.example.com/`)
 *   when the dashboard and API live on different origins.
 */
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/';

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

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const httpClient: KyInstance = ky.extend({
  prefixUrl: API_BASE_URL,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
          return;
        }
        if (!csrfToken) {
          return;
        }
        const url = new URL(request.url);
        if (url.pathname.startsWith('/admin')) {
          request.headers.set('X-CSRF-Token', csrfToken);
        }
      },
    ],
  },
});

type SearchParamsInit = Exclude<KyOptions['searchParams'], undefined>;

async function toApiError(error: HTTPError): Promise<ApiError> {
  const { response, request } = error;
  let message = `HTTP ${response.status}`;
  try {
    const payload = (await response.clone().json()) as { error?: string };
    if (payload.error) {
      message = payload.error;
    }
  } catch {
    // body wasn't JSON; keep the default message
  }

  const url = new URL(request.url);
  if (
    response.status === 401 &&
    !url.pathname.endsWith('/admin/auth/session')
  ) {
    unauthorizedHandler?.();
  }

  const apiError = new ApiError(response.status, message);
  apiError.stack = error.stack;
  return apiError;
}

async function unwrap<T>(promise: ResponsePromise): Promise<T> {
  try {
    const response = await promise;
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HTTPError) {
      throw await toApiError(error);
    }
    throw error;
  }
}

function getJson<T>(path: string, searchParams?: SearchParamsInit): Promise<T> {
  return unwrap<T>(
    httpClient.get(path, searchParams ? { searchParams } : undefined),
  );
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return unwrap<T>(
    httpClient.post(path, body !== undefined ? { json: body } : undefined),
  );
}

function putJson<T>(path: string, body?: unknown): Promise<T> {
  return unwrap<T>(
    httpClient.put(path, body !== undefined ? { json: body } : undefined),
  );
}

function deleteJson<T>(
  path: string,
  searchParams?: SearchParamsInit,
): Promise<T> {
  return unwrap<T>(
    httpClient.delete(path, searchParams ? { searchParams } : undefined),
  );
}

/**
 * Build a fully-qualified URL using the same prefix as the API client.
 * Used for window.location-style redirects (OIDC) where ky can't be invoked.
 */
function buildUrl(path: string, searchParams?: Record<string, string>): string {
  const base =
    API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')
      ? API_BASE_URL
      : new URL(API_BASE_URL, window.location.origin).toString();
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export const api = {
  auth: {
    getSession: (): Promise<AdminSessionResponse> =>
      getJson<AdminSessionResponse>('admin/auth/session'),
    login: (
      username: string,
      password: string,
    ): Promise<AdminSessionResponse> =>
      postJson<AdminSessionResponse>('admin/auth/login', {
        username,
        password,
      }),
    logout: (): Promise<void> => postJson<void>('admin/auth/logout'),
    beginOidc: (next: string = window.location.pathname) => {
      window.location.href = buildUrl('admin/auth/oidc/start', { next });
    },
    getTokens: (): Promise<AdminApiTokenSummary[]> =>
      getJson<AdminApiTokenSummary[]>('admin/auth/tokens'),
    createToken: (
      name: string,
      expiresInDays?: number,
    ): Promise<{ token: string; record: AdminApiTokenSummary }> =>
      postJson('admin/auth/tokens', { name, expiresInDays }),
    deleteToken: (id: number): Promise<void> =>
      deleteJson<void>(`admin/auth/tokens/${id}`),
  },
  users: {
    getAll: (): Promise<User[]> => getJson<User[]>('admin/users'),
    getById: (id: number): Promise<User> => getJson<User>(`admin/users/${id}`),
    create: (data: {
      name: string;
      email?: string;
      api_key?: string;
      detail_logging?: boolean;
    }): Promise<User> => postJson<User>('admin/users', data),
    update: (id: number, data: Partial<User>): Promise<User> =>
      putJson<User>(`admin/users/${id}`, data),
    delete: (id: number): Promise<void> =>
      deleteJson<void>(`admin/users/${id}`),
    regenerateApiKey: (id: number): Promise<User> =>
      postJson<User>(`admin/users/${id}/regenerate-api-key`),
  },

  backends: {
    getAll: (): Promise<Backend[]> => getJson<Backend[]>('admin/backends'),
    getById: (id: number): Promise<Backend> =>
      getJson<Backend>(`admin/backends/${id}`),
    getModels: (id: number): Promise<BackendModelsResponse> =>
      getJson<BackendModelsResponse>(`admin/backends/${id}/models`),
    refreshModels: (id: number): Promise<BackendModelsResponse> =>
      postJson<BackendModelsResponse>(`admin/backends/${id}/models/refresh`),
    create: (data: {
      name: string;
      base_url: string;
      api_key?: string;
      detail_logging?: boolean;
    }): Promise<Backend> => postJson<Backend>('admin/backends', data),
    update: (id: number, data: Partial<Backend>): Promise<Backend> =>
      putJson<Backend>(`admin/backends/${id}`, data),
    delete: (id: number): Promise<void> =>
      deleteJson<void>(`admin/backends/${id}`),
  },

  permissions: {
    getAll: (): Promise<Permission[]> =>
      getJson<Permission[]>('admin/permissions'),
    getByUser: (userId: number): Promise<Permission[]> =>
      getJson<Permission[]>(`admin/permissions/user/${userId}`),
    getByBackend: (backendId: number): Promise<Permission[]> =>
      getJson<Permission[]>(`admin/permissions/backend/${backendId}`),
    create: (data: {
      user_id: number;
      backend_id: number;
    }): Promise<Permission> => postJson<Permission>('admin/permissions', data),
    delete: (userId: number, backendId: number): Promise<void> =>
      deleteJson<void>('admin/permissions', {
        user_id: String(userId),
        backend_id: String(backendId),
      }),
  },

  modelRewrites: {
    getAll: (): Promise<ModelRewriteRule[]> =>
      getJson<ModelRewriteRule[]>('admin/model-rewrites'),
    create: (data: {
      source_model: string;
      target_model: string;
      is_active?: boolean;
      force?: boolean;
      note?: string;
    }): Promise<ModelRewriteRule> =>
      postJson<ModelRewriteRule>('admin/model-rewrites', data),
    update: (
      id: number,
      data: Partial<ModelRewriteRule>,
    ): Promise<ModelRewriteRule> =>
      putJson<ModelRewriteRule>(`admin/model-rewrites/${id}`, data),
    delete: (id: number): Promise<void> =>
      deleteJson<void>(`admin/model-rewrites/${id}`),
  },

  modelCache: {
    getOverview: (): Promise<ModelCacheOverview> =>
      getJson<ModelCacheOverview>('admin/models/cache'),
  },

  scripts: {
    getAll: (): Promise<UserScript[]> => getJson<UserScript[]>('admin/scripts'),
    getById: (id: number): Promise<UserScript> =>
      getJson<UserScript>(`admin/scripts/${id}`),
    create: (data: CreateScriptData): Promise<UserScript> =>
      postJson<UserScript>('admin/scripts', data),
    update: (id: number, data: UpdateScriptData): Promise<UserScript> =>
      putJson<UserScript>(`admin/scripts/${id}`, data),
    delete: (id: number): Promise<void> =>
      deleteJson<void>(`admin/scripts/${id}`),
    activate: (id: number): Promise<UserScript> =>
      postJson<UserScript>(`admin/scripts/${id}/activate`),
    deactivate: (id: number): Promise<UserScript> =>
      postJson<UserScript>(`admin/scripts/${id}/deactivate`),
    test: (
      id: number,
      context: {
        user?: User;
        backend?: Backend;
        request: {
          method: string;
          path: string;
          headers: Record<string, string>;
          body: unknown;
          isStream: boolean;
        };
      },
    ): Promise<{ success: boolean; error?: string; executionTime?: number }> =>
      postJson(`admin/scripts/${id}/test`, context),
  },

  dashboard: {
    getSummary: (days: number = 30): Promise<DashboardSummaryResponse> =>
      getJson<DashboardSummaryResponse>('admin/dashboard/summary', { days }),
  },

  analytics: {
    getUsage: (
      userId?: number,
      backendId?: number,
      days: number = 30,
    ): Promise<UsageStats[]> => {
      const searchParams: Record<string, number> = { days };
      if (userId) searchParams.userId = userId;
      if (backendId) searchParams.backendId = backendId;
      return getJson<UsageStats[]>('admin/analytics/usage', searchParams);
    },
    getRequests: (
      params: {
        limit?: number;
        offset?: number;
        month?: string;
        date?: string;
        q?: string;
        userId?: number;
        backendId?: number;
        endpoint?: string;
        detailLogged?: boolean;
      } = {},
    ): Promise<RequestLogPage> => {
      const searchParams: Record<string, string | number> = {
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      };
      if (params.month) searchParams.month = params.month;
      if (params.date) searchParams.date = params.date;
      if (params.q) searchParams.q = params.q;
      if (params.userId) searchParams.userId = params.userId;
      if (params.backendId) searchParams.backendId = params.backendId;
      if (params.endpoint) searchParams.endpoint = params.endpoint;
      if (params.detailLogged !== undefined) {
        searchParams.detailLogged = params.detailLogged ? '1' : '0';
      }
      return getJson<RequestLogPage>('admin/analytics/requests', searchParams);
    },
    getMetrics: (
      backendId?: number,
      days: number = 30,
    ): Promise<BackendMetrics[]> => {
      const searchParams: Record<string, number> = { days };
      if (backendId) searchParams.backendId = backendId;
      return getJson<BackendMetrics[]>('admin/analytics/metrics', searchParams);
    },
    getDailyTotals: (
      backendId?: number,
      days: number = 30,
    ): Promise<AnalyticsDailyTotalsPoint[]> => {
      const searchParams: Record<string, number> = { days };
      if (backendId) searchParams.backendId = backendId;
      return getJson<AnalyticsDailyTotalsPoint[]>(
        'admin/analytics/daily-totals',
        searchParams,
      );
    },
    getBackendQuality: (
      backendId?: number,
      days: number = 30,
    ): Promise<AnalyticsBackendQualityPoint[]> => {
      const searchParams: Record<string, number> = { days };
      if (backendId) searchParams.backendId = backendId;
      return getJson<AnalyticsBackendQualityPoint[]>(
        'admin/analytics/backend-quality',
        searchParams,
      );
    },
    getModelTrends: (
      params: { backendId?: number; days?: number; limit?: number } = {},
    ): Promise<AnalyticsModelTrendPoint[]> => {
      const searchParams: Record<string, number> = {
        days: params.days ?? 30,
        limit: params.limit ?? 8,
      };
      if (params.backendId) searchParams.backendId = params.backendId;
      return getJson<AnalyticsModelTrendPoint[]>(
        'admin/analytics/model-trends',
        searchParams,
      );
    },
    getResponseLengthHistogram: (
      params: { backendId?: number; days?: number; bins?: number } = {},
    ): Promise<AnalyticsHistogramBin[]> => {
      const searchParams: Record<string, number> = {
        days: params.days ?? 30,
        bins: params.bins ?? 20,
      };
      if (params.backendId) searchParams.backendId = params.backendId;
      return getJson<AnalyticsHistogramBin[]>(
        'admin/analytics/response-length-histogram',
        searchParams,
      );
    },
    getResponseLengthBoxPlot: (
      backendId?: number,
      days: number = 30,
    ): Promise<AnalyticsBoxPlotPoint[]> => {
      const searchParams: Record<string, number> = { days };
      if (backendId) searchParams.backendId = backendId;
      return getJson<AnalyticsBoxPlotPoint[]>(
        'admin/analytics/response-length-box-plot',
        searchParams,
      );
    },
  },
};
