/**
 * Centralised TanStack Query keys.
 *
 * Each scope returns a literal `as const` tuple so query invalidation
 * patterns like `queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })`
 * stay type-safe.
 */
export const queryKeys = {
  auth: {
    session: () => ['auth', 'session'] as const,
  },
  users: {
    all: () => ['users'] as const,
    detail: (id: number) => ['users', id] as const,
  },
  backends: {
    all: () => ['backends'] as const,
    detail: (id: number) => ['backends', id] as const,
    models: (id: number) => ['backends', id, 'models'] as const,
  },
  permissions: {
    all: () => ['permissions'] as const,
    byUser: (userId: number) => ['permissions', 'user', userId] as const,
    byBackend: (backendId: number) =>
      ['permissions', 'backend', backendId] as const,
  },
  modelRewrites: {
    all: () => ['model-rewrites'] as const,
  },
  modelCache: {
    overview: () => ['models', 'cache'] as const,
  },
  scripts: {
    all: () => ['scripts'] as const,
    detail: (id: number) => ['scripts', id] as const,
  },
  dashboard: {
    summary: (days: number) => ['dashboard', 'summary', days] as const,
  },
  analytics: {
    requests: (params: Record<string, unknown>) =>
      ['analytics', 'requests', params] as const,
    dailyTotals: (backendId: number | undefined, days: number) =>
      ['analytics', 'daily-totals', backendId, days] as const,
    backendQuality: (backendId: number | undefined, days: number) =>
      ['analytics', 'backend-quality', backendId, days] as const,
    modelTrends: (params: {
      backendId?: number;
      days?: number;
      limit?: number;
    }) => ['analytics', 'model-trends', params] as const,
    histogram: (params: { backendId?: number; days?: number; bins?: number }) =>
      ['analytics', 'response-length-histogram', params] as const,
    boxPlot: (backendId: number | undefined, days: number) =>
      ['analytics', 'response-length-box-plot', backendId, days] as const,
  },
} as const;
