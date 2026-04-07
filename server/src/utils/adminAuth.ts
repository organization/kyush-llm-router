import { getSessionTokenFromCookies, hashAdminToken } from './adminSecurity.js';

import { getTrustedProxyIps } from '../config/admin-auth.js';

import { AdminApiTokenModel } from '../models/AdminApiToken.js';

import { AdminSessionModel } from '../models/AdminSession.js';

import type { Context, MiddlewareHandler } from 'hono';
import type { AdminPrincipal } from '../../../shared/types.js';

import type { AdminAuthContext, AppEnv } from '../types/hono.js';

function toPrincipal(data: {
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  display_name: string;
}): AdminPrincipal {
  return {
    provider: data.provider,
    subject: data.subject,
    username: data.username,
    email: data.email,
    displayName: data.display_name,
  };
}

function getRemoteIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? '';
  }
  // @hono/node-server exposes the underlying IncomingMessage as c.env.incoming
  const incoming = (
    c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
  )?.incoming;
  return incoming?.socket?.remoteAddress ?? '';
}

function passesTrustedProxyGuard(c: Context): boolean {
  const allowedIps = getTrustedProxyIps();
  if (allowedIps.length === 0) {
    return true;
  }

  const remoteIp = getRemoteIp(c);
  return allowedIps.includes(remoteIp);
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

  const sessionToken = getSessionTokenFromCookies(c.req.header('cookie'));
  if (!sessionToken) {
    return undefined;
  }

  const session = AdminSessionModel.findByTokenHash(
    hashAdminToken(sessionToken),
  );
  if (!session) {
    return undefined;
  }

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

export const requireSessionCsrf: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(
    c.req.method.toUpperCase(),
  );
  if (!unsafeMethod) {
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
