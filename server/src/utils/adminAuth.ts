import { NextFunction, Request, Response } from 'express';
import { AdminPrincipal } from '../../../shared/types';
import { getTrustedProxyIps } from '../config/admin-auth';
import { AdminApiTokenModel } from '../models/AdminApiToken';
import { AdminSessionModel } from '../models/AdminSession';
import { getSessionTokenFromCookies, hashAdminToken } from './adminSecurity';

export interface AdminRequest extends Request {
  adminAuth?: {
    principal: AdminPrincipal;
    method: 'session' | 'token';
    csrfToken?: string;
    sessionId?: number;
    tokenId?: number;
  };
}

function toPrincipal(data: { provider: 'env' | 'oidc'; subject: string; username?: string; email?: string; display_name: string }): AdminPrincipal {
  return {
    provider: data.provider,
    subject: data.subject,
    username: data.username,
    email: data.email,
    displayName: data.display_name,
  };
}

function passesTrustedProxyGuard(req: Request): boolean {
  const allowedIps = getTrustedProxyIps();
  if (allowedIps.length === 0) {
    return true;
  }

  const remoteIp = req.ip || req.socket.remoteAddress || '';
  return allowedIps.includes(remoteIp);
}

export function resolveAdminAuth(req: AdminRequest): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    const adminToken = AdminApiTokenModel.findByTokenHash(hashAdminToken(bearerToken));
    if (adminToken) {
      AdminApiTokenModel.touch(adminToken.id);
      req.adminAuth = {
        principal: toPrincipal(adminToken),
        method: 'token',
        tokenId: adminToken.id,
      };
      return;
    }
  }

  const sessionToken = getSessionTokenFromCookies(req.headers.cookie);
  if (!sessionToken) {
    return;
  }

  const session = AdminSessionModel.findByTokenHash(hashAdminToken(sessionToken));
  if (!session) {
    return;
  }

  AdminSessionModel.touch(session.id);
  req.adminAuth = {
    principal: toPrincipal(session),
    method: 'session',
    csrfToken: session.csrf_token,
    sessionId: session.id,
  };
}

export function requireAdminAccess(req: AdminRequest, res: Response, next: NextFunction): void {
  if (!passesTrustedProxyGuard(req)) {
    res.status(403).json({ error: 'Admin access is restricted to trusted proxy IPs' });
    return;
  }

  resolveAdminAuth(req);
  if (!req.adminAuth) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  next();
}

export function requireSessionCsrf(req: AdminRequest, res: Response, next: NextFunction): void {
  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (!unsafeMethod) {
    next();
    return;
  }

  if (req.adminAuth?.method !== 'session') {
    next();
    return;
  }

  const csrfHeader = req.get('X-CSRF-Token');
  if (!csrfHeader || csrfHeader !== req.adminAuth.csrfToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}
