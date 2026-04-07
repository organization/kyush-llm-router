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
  useContext,
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

function AuthContextProvider(props: {
  children: import('solid-js').JSX.Element;
}) {
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();

  // Mirror the CSRF token into the api client whenever the session updates.
  createEffect(() => {
    const data = sessionQuery.data;
    setAdminCsrfToken(data?.csrfToken ?? null);
  });

  // Wire the api client's 401 handler — when an unauthorized response surfaces,
  // immediately collapse the cached session to the unauthenticated fallback.
  createEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.setQueryData<AdminSessionResponse>(
        authKeys.session,
        (previous) => ({
          ...UNAUTHENTICATED_FALLBACK,
          authMode: previous?.authMode ?? UNAUTHENTICATED_FALLBACK.authMode,
        }),
      );
      setAdminCsrfToken(null);
    });

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
    onSuccess: (next) => {
      queryClient.setQueryData(authKeys.session, next);
    },
  }));

  const logoutMutation = useMutation(() => ({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData<AdminSessionResponse>(
        authKeys.session,
        (previous) => ({
          ...UNAUTHENTICATED_FALLBACK,
          authMode: previous?.authMode ?? UNAUTHENTICATED_FALLBACK.authMode,
        }),
      );
    },
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
