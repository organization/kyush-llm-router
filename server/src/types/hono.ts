import type { AdminPrincipal, User } from '../../../shared/types';

export interface AdminAuthContext {
  principal: AdminPrincipal;
  method: 'session' | 'token';
  csrfToken?: string;
  sessionId?: number;
  tokenId?: number;
}

export type AppVariables = {
  user: User;
  allowedBackendIds: number[];
  adminAuth: AdminAuthContext;
};

export type AppEnv = {
  Variables: Partial<AppVariables>;
};
