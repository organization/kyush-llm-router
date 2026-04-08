import { getSessionTokenFromContext, hashAdminToken } from './adminSecurity';

import { getTrustedProxyIps } from '../config/admin-auth';

import { AdminApiTokenModel } from '../models/AdminApiToken';
import { AdminSessionModel } from '../models/AdminSession';

import type { Context, MiddlewareHandler } from 'hono';

import type { AdminPrincipal } from '../../../shared/types';
import type { AdminAuthContext, AppEnv } from '../types/hono';

interface PrincipalRow {
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  display_name: string;
}

function toPrincipal(data: PrincipalRow): AdminPrincipal {
  return {
    provider: data.provider,
    subject: data.subject,
    username: data.username,
    email: data.email,
    displayName: data.display_name,
  };
}

/**
 * Type guard for `@hono/node-server`'s context env shape. The Node adapter
 * exposes the underlying `IncomingMessage` as `c.env.incoming`; we narrow it
 * here so the rest of the file never has to touch `as` casts.
 */
function getNodeIncomingSocket(
  env: unknown,
): { remoteAddress?: string } | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  if (!('incoming' in env)) return undefined;
  const incoming = (env as { incoming: unknown }).incoming;
  if (typeof incoming !== 'object' || incoming === null) return undefined;
  if (!('socket' in incoming)) return undefined;
  const socket = (incoming as { socket: unknown }).socket;
  if (typeof socket !== 'object' || socket === null) return undefined;
  return socket as { remoteAddress?: string };
}

function getRemoteIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '';
  return getNodeIncomingSocket(c.env)?.remoteAddress ?? '';
}

function passesTrustedProxyGuard(c: Context): boolean {
  const allowedIps = getTrustedProxyIps();
  if (allowedIps.length === 0) return true;
  return allowedIps.includes(getRemoteIp(c));
}

export function resolveAdminAuth(
  c: Context<AppEnv>,
): AdminAuthContext | undefined {
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    const adminToken = AdminApiTokenModel.findByTokenHash(
      hashAdminToken(bearerToken),
    );
    if (adminToken) {
      AdminApiTokenModel.touch(adminToken.id);
      const ctx: AdminAuthContext = {
        principal: toPrincipal(adminToken),
        method: 'token',
        tokenId: adminToken.id,
      };
      c.set('adminAuth', ctx);
      return ctx;
    }
  }

  // Cookie reads now go through hono/cookie's helper inside getSessionTokenFromContext.
  const sessionToken = getSessionTokenFromContext(c);
  if (!sessionToken) return undefined;

  const session = AdminSessionModel.findByTokenHash(
    hashAdminToken(sessionToken),
  );
  if (!session) return undefined;

  AdminSessionModel.touch(session.id);
  const ctx: AdminAuthContext = {
    principal: toPrincipal(session),
    method: 'session',
    csrfToken: session.csrf_token,
    sessionId: session.id,
  };
  c.set('adminAuth', ctx);
  return ctx;
}

export const requireAdminAccess: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (!passesTrustedProxyGuard(c)) {
    return c.json(
      { error: 'Admin access is restricted to trusted proxy IPs' },
      403,
    );
  }

  const auth = resolveAdminAuth(c);
  if (!auth) {
    return c.json({ error: 'Admin authentication required' }, 401);
  }

  await next();
  return;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireSessionCsrf: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (SAFE_METHODS.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }

  const adminAuth = c.get('adminAuth');
  if (adminAuth?.method !== 'session') {
    await next();
    return;
  }

  const csrfHeader = c.req.header('X-CSRF-Token');
  if (!csrfHeader || csrfHeader !== adminAuth.csrfToken) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  await next();
  return;
};
