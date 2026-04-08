import { omitBy } from 'es-toolkit';
import ky, {
  HTTPError,
  type KyInstance,
  type Options as KyOptions,
  type ResponsePromise,
} from 'ky';

import type {
  AdminApiTokenSummary,
  AdminSessionResponse,
  AnalyticsBackendQualityPoint,
  AnalyticsBoxPlotPoint,
  AnalyticsDailyTotalsPoint,
  AnalyticsHistogramBin,
  AnalyticsModelTrendPoint,
  Backend,
  BackendMetrics,
  BackendModelsResponse,
  CreateBackendInput,
  CreateModelRewriteInput,
  CreatePermissionInput,
  CreateScriptInput,
  CreateUserInput,
  DashboardSummaryResponse,
  ModelCacheOverview,
  ModelRewriteRule,
  Permission,
  RequestLogPage,
  UpdateBackendInput,
  UpdateModelRewriteInput,
  UpdateScriptInput,
  UpdateUserInput,
  UsageStats,
  User,
  UserScript,
} from '@kyush/shared';

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
        if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return;
        if (!csrfToken) return;
        const url = new URL(request.url);
        if (url.pathname.startsWith('/admin')) {
          request.headers.set('X-CSRF-Token', csrfToken);
        }
      },
    ],
  },
});

type SearchParamsInit = Exclude<KyOptions['searchParams'], undefined>;
type Primitive = string | number | boolean | undefined | null;

/**
 * Drop `undefined`/`null` keys so callers can pass `{ userId: maybeUndefined }`
 * without polluting the query string with empty values. Returns `undefined`
 * when nothing is left so ky skips the search parameter step entirely.
 */
function compactSearchParams(
  params: Record<string, Primitive>,
): SearchParamsInit | undefined {
  const cleaned = omitBy(
    params,
    (value) => value === undefined || value === null,
  );
  const entries = Object.entries(cleaned);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([k, v]) => [k, String(v)]));
}

async function toApiError(error: HTTPError): Promise<ApiError> {
  const { response, request } = error;
  let message = `HTTP ${response.status}`;
  try {
    const payload = (await response.clone().json()) as { error?: string };
    if (payload.error) message = payload.error;
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
    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HTTPError) throw await toApiError(error);
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

interface AnalyticsRequestParams {
  limit?: number;
  offset?: number;
  month?: string;
  date?: string;
  q?: string;
  userId?: number;
  backendId?: number;
  endpoint?: string;
  detailLogged?: boolean;
}

interface ModelTrendsParams {
  backendId?: number;
  days?: number;
  limit?: number;
}

interface HistogramParams {
  backendId?: number;
  days?: number;
  bins?: number;
}

export const api = {
  auth: {
    getSession: () => getJson<AdminSessionResponse>('admin/auth/session'),
    login: (username: string, password: string) =>
      postJson<AdminSessionResponse>('admin/auth/login', {
        username,
        password,
      }),
    logout: () => postJson<void>('admin/auth/logout'),
    beginOidc: (next: string = window.location.pathname) => {
      window.location.href = buildUrl('admin/auth/oidc/start', { next });
    },
    getTokens: () => getJson<AdminApiTokenSummary[]>('admin/auth/tokens'),
    createToken: (name: string, expiresInDays?: number) =>
      postJson<{ token: string; record: AdminApiTokenSummary }>(
        'admin/auth/tokens',
        { name, expiresInDays },
      ),
    deleteToken: (id: number) => deleteJson<void>(`admin/auth/tokens/${id}`),
  },

  users: {
    getAll: () => getJson<User[]>('admin/users'),
    getById: (id: number) => getJson<User>(`admin/users/${id}`),
    create: (data: CreateUserInput) => postJson<User>('admin/users', data),
    update: (id: number, data: UpdateUserInput) =>
      putJson<User>(`admin/users/${id}`, data),
    delete: (id: number) => deleteJson<void>(`admin/users/${id}`),
    regenerateApiKey: (id: number) =>
      postJson<User>(`admin/users/${id}/regenerate-api-key`),
  },

  backends: {
    getAll: () => getJson<Backend[]>('admin/backends'),
    getById: (id: number) => getJson<Backend>(`admin/backends/${id}`),
    getModels: (id: number) =>
      getJson<BackendModelsResponse>(`admin/backends/${id}/models`),
    refreshModels: (id: number) =>
      postJson<BackendModelsResponse>(`admin/backends/${id}/models/refresh`),
    create: (data: CreateBackendInput) =>
      postJson<Backend>('admin/backends', data),
    update: (id: number, data: UpdateBackendInput) =>
      putJson<Backend>(`admin/backends/${id}`, data),
    delete: (id: number) => deleteJson<void>(`admin/backends/${id}`),
  },

  permissions: {
    getAll: () => getJson<Permission[]>('admin/permissions'),
    getByUser: (userId: number) =>
      getJson<Permission[]>(`admin/permissions/user/${userId}`),
    getByBackend: (backendId: number) =>
      getJson<Permission[]>(`admin/permissions/backend/${backendId}`),
    create: (data: CreatePermissionInput) =>
      postJson<Permission>('admin/permissions', data),
    delete: (userId: number, backendId: number) =>
      deleteJson<void>('admin/permissions', {
        user_id: String(userId),
        backend_id: String(backendId),
      }),
  },

  modelRewrites: {
    getAll: () => getJson<ModelRewriteRule[]>('admin/model-rewrites'),
    create: (data: CreateModelRewriteInput) =>
      postJson<ModelRewriteRule>('admin/model-rewrites', data),
    update: (id: number, data: UpdateModelRewriteInput) =>
      putJson<ModelRewriteRule>(`admin/model-rewrites/${id}`, data),
    delete: (id: number) => deleteJson<void>(`admin/model-rewrites/${id}`),
  },

  modelCache: {
    getOverview: () => getJson<ModelCacheOverview>('admin/models/cache'),
  },

  scripts: {
    getAll: () => getJson<UserScript[]>('admin/scripts'),
    getById: (id: number) => getJson<UserScript>(`admin/scripts/${id}`),
    create: (data: CreateScriptInput) =>
      postJson<UserScript>('admin/scripts', data),
    update: (id: number, data: UpdateScriptInput) =>
      putJson<UserScript>(`admin/scripts/${id}`, data),
    delete: (id: number) => deleteJson<void>(`admin/scripts/${id}`),
    activate: (id: number) =>
      postJson<UserScript>(`admin/scripts/${id}/activate`),
    deactivate: (id: number) =>
      postJson<UserScript>(`admin/scripts/${id}/deactivate`),
    test: (
      id: number,
      context: {
        user?: { id: number; name: string; email?: string };
        backend?: { id: number; name: string; base_url: string };
        request: {
          method: string;
          path: string;
          headers: Record<string, string>;
          body: unknown;
          isStream: boolean;
        };
      },
    ) =>
      postJson<{ success: boolean; error?: string; executionTime?: number }>(
        `admin/scripts/${id}/test`,
        context,
      ),
  },

  dashboard: {
    getSummary: (days: number = 30) =>
      getJson<DashboardSummaryResponse>('admin/dashboard/summary', { days }),
  },

  analytics: {
    getUsage: (userId?: number, backendId?: number, days: number = 30) =>
      getJson<UsageStats[]>(
        'admin/analytics/usage',
        compactSearchParams({ userId, backendId, days }),
      ),
    getRequests: (params: AnalyticsRequestParams = {}) =>
      getJson<RequestLogPage>(
        'admin/analytics/requests',
        compactSearchParams({
          limit: params.limit ?? 100,
          offset: params.offset ?? 0,
          month: params.month,
          date: params.date,
          q: params.q,
          userId: params.userId,
          backendId: params.backendId,
          endpoint: params.endpoint,
          detailLogged:
            params.detailLogged === undefined
              ? undefined
              : params.detailLogged
                ? '1'
                : '0',
        }),
      ),
    getMetrics: (backendId?: number, days: number = 30) =>
      getJson<BackendMetrics[]>(
        'admin/analytics/metrics',
        compactSearchParams({ backendId, days }),
      ),
    getDailyTotals: (backendId?: number, days: number = 30) =>
      getJson<AnalyticsDailyTotalsPoint[]>(
        'admin/analytics/daily-totals',
        compactSearchParams({ backendId, days }),
      ),
    getBackendQuality: (backendId?: number, days: number = 30) =>
      getJson<AnalyticsBackendQualityPoint[]>(
        'admin/analytics/backend-quality',
        compactSearchParams({ backendId, days }),
      ),
    getModelTrends: (params: ModelTrendsParams = {}) =>
      getJson<AnalyticsModelTrendPoint[]>(
        'admin/analytics/model-trends',
        compactSearchParams({
          backendId: params.backendId,
          days: params.days ?? 30,
          limit: params.limit ?? 8,
        }),
      ),
    getResponseLengthHistogram: (params: HistogramParams = {}) =>
      getJson<AnalyticsHistogramBin[]>(
        'admin/analytics/response-length-histogram',
        compactSearchParams({
          backendId: params.backendId,
          days: params.days ?? 30,
          bins: params.bins ?? 20,
        }),
      ),
    getResponseLengthBoxPlot: (backendId?: number, days: number = 30) =>
      getJson<AnalyticsBoxPlotPoint[]>(
        'admin/analytics/response-length-box-plot',
        compactSearchParams({ backendId, days }),
      ),
  },
};
