import {
  createContext,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type JSX,
  type ParentComponent,
} from 'solid-js';

import { api, setAdminCsrfToken, setUnauthorizedHandler } from './api/client';

import type { AdminSessionResponse } from './types';

interface AuthContextValue {
  session: Accessor<AdminSessionResponse | null>;
  loading: Accessor<boolean>;
  refreshSession: () => Promise<AdminSessionResponse>;
  login: (username: string, password: string) => Promise<AdminSessionResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

function unauthenticatedState(
  previous: AdminSessionResponse | null,
): AdminSessionResponse {
  return {
    authenticated: false,
    authMode: previous?.authMode ?? 'both',
    csrfToken: null,
    principal: null,
  };
}

export const AuthProvider: ParentComponent<{ children: JSX.Element }> = (
  props,
) => {
  const [session, setSession] = createSignal<AdminSessionResponse | null>(null);
  const [loading, setLoading] = createSignal(true);

  const refreshSession = async () => {
    const nextSession = await api.auth.getSession();
    setSession(nextSession);
    setAdminCsrfToken(nextSession.csrfToken);
    setLoading(false);
    return nextSession;
  };

  const login = async (username: string, password: string) => {
    const nextSession = await api.auth.login(username, password);
    setSession(nextSession);
    setAdminCsrfToken(nextSession.csrfToken);
    return nextSession;
  };

  const logout = async () => {
    await api.auth.logout();
    setSession((previous) => unauthenticatedState(previous));
    setAdminCsrfToken(null);
  };

  onMount(() => {
    setUnauthorizedHandler(() => {
      setSession((previous) => unauthenticatedState(previous));
      setAdminCsrfToken(null);
    });

    void refreshSession().catch(() => {
      setSession({
        authenticated: false,
        authMode: 'both',
        csrfToken: null,
        principal: null,
      });
      setLoading(false);
    });
  });

  return (
    <AuthContext.Provider
      value={{ session, loading, refreshSession, login, logout }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('Auth context is not available');
  }
  return context;
}
