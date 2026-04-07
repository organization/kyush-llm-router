import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import {
  createContext,
  createEffect,
  onCleanup,
  onMount,
  useContext,
  type JSX,
  type ParentComponent,
} from 'solid-js';

import {
  ApiError,
  api,
  setAdminCsrfToken,
  setUnauthorizedHandler,
} from './api/client';

import type { AdminSessionResponse } from '@kyush/shared';

/* ────────────────────────────────────────────────────────────────────────────
 * QueryClient
 * ────────────────────────────────────────────────────────────────────────── */

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Treat 401 specially via a global onError pipeline; never retry auth
        // failures, since the unauthorizedHandler will reset the session.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status === 401) return false;
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }
          return failureCount < 2;
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        throwOnError: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Query keys
 * ────────────────────────────────────────────────────────────────────────── */

export const authKeys = {
  session: ['auth', 'session'] as const,
} as const;

const UNAUTHENTICATED_FALLBACK: AdminSessionResponse = {
  authenticated: false,
  authMode: 'both',
  csrfToken: null,
  principal: null,
};

/* ────────────────────────────────────────────────────────────────────────────
 * Auth context (thin wrapper around the session query + mutations)
 * ────────────────────────────────────────────────────────────────────────── */

interface AuthContextValue {
  session: () => AdminSessionResponse | null;
  loading: () => boolean;
  refreshSession: () => Promise<AdminSessionResponse>;
  login: (username: string, password: string) => Promise<AdminSessionResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

function useSessionQuery() {
  return useQuery(() => ({
    queryKey: authKeys.session,
    queryFn: () => api.auth.getSession(),
    // The session is already authoritative for the dashboard's lifecycle,
    // so cache it forever and let mutations invalidate it explicitly.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  }));
}

/**
 * Tag a query as belonging to the auth namespace so we can keep it across
 * sign-in/sign-out transitions while wiping every other cached query.
 *
 * `removeQueries`/`invalidateQueries` accept a `predicate` that runs against
 * each Query in the cache — anchoring on the first key segment is the
 * cheapest stable identifier we have.
 */
const isAuthQuery = (queryKey: readonly unknown[]) => queryKey[0] === 'auth';

/**
 * Replace the cached session with the unauthenticated fallback (preserving
 * the configured auth mode so the login gate keeps showing the right form),
 * then evict every non-auth query so stale user-scoped data doesn't leak
 * across sign-out/401 boundaries.
 */
function clearAuthenticatedState(queryClient: QueryClient): void {
  queryClient.setQueryData<AdminSessionResponse>(
    authKeys.session,
    (previous) => ({
      ...UNAUTHENTICATED_FALLBACK,
      authMode: previous?.authMode ?? UNAUTHENTICATED_FALLBACK.authMode,
    }),
  );
  setAdminCsrfToken(null);
  queryClient.removeQueries({
    predicate: (query) => !isAuthQuery(query.queryKey),
  });
}

/**
 * After a successful login the cached results from the previous (anonymous
 * or different-user) session are stale. Mark every non-auth query stale so
 * mounted components refetch under the new session.
 */
function refreshAfterLogin(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => !isAuthQuery(query.queryKey),
  });
}

function AuthContextProvider(props: { children: JSX.Element }) {
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();

  // Mirror the CSRF token into the api client whenever the session updates.
  createEffect(() => {
    const data = sessionQuery.data;
    setAdminCsrfToken(data?.csrfToken ?? null);
  });

  // Wire the api client's 401 handler once at mount — when an unauthorized
  // response surfaces, immediately collapse the cached session to the
  // unauthenticated fallback AND wipe every other cached query so we never
  // render data that was fetched under a now-revoked session. There are no
  // reactive reads in this block, so `onMount` (one-shot) is a more honest
  // fit than `createEffect`.
  onMount(() => {
    setUnauthorizedHandler(() => clearAuthenticatedState(queryClient));
    onCleanup(() => setUnauthorizedHandler(null));
  });

  const loginMutation = useMutation(() => ({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => api.auth.login(username, password),
    onSuccess: async (next) => {
      queryClient.setQueryData(authKeys.session, next);
      // Invalidate (don't remove) so any currently-mounted view kicks off
      // a refetch under the new session — `removeQueries` here would leave
      // the dashboard staring at empty fallbacks until each query mounted.
      await refreshAfterLogin(queryClient);
    },
  }));

  const logoutMutation = useMutation(() => ({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => clearAuthenticatedState(queryClient),
  }));

  const value: AuthContextValue = {
    session: () => sessionQuery.data ?? null,
    // Only treat the very first fetch as "loading" — once we have any data
    // (or an error), the gate should resolve to login or to the dashboard.
    loading: () =>
      sessionQuery.isPending && sessionQuery.fetchStatus !== 'idle',
    refreshSession: async () => {
      const next = await queryClient.fetchQuery({
        queryKey: authKeys.session,
        queryFn: () => api.auth.getSession(),
        staleTime: 0,
      });
      return next;
    },
    login: (username, password) =>
      loginMutation.mutateAsync({ username, password }),
    logout: () => logoutMutation.mutateAsync(),
  };

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
}

export const AuthProvider: ParentComponent = (props) => {
  const queryClient = makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>{props.children}</AuthContextProvider>
    </QueryClientProvider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
