import { createHash } from 'crypto';
import { AdminAuthMode } from '../../../shared/types';

function normalizeAuthMode(value?: string): AdminAuthMode {
  if (value === 'env' || value === 'oidc' || value === 'both') {
    return value;
  }
  return 'both';
}

function parseList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getAdminAuthMode(): AdminAuthMode {
  return normalizeAuthMode(process.env.ADMIN_AUTH_MODE);
}

export function isEnvAdminEnabled(): boolean {
  const mode = getAdminAuthMode();
  return mode === 'env' || mode === 'both';
}

export function isOidcEnabled(): boolean {
  const mode = getAdminAuthMode();
  return mode === 'oidc' || mode === 'both';
}

export function getAdminUsername(): string | null {
  return process.env.ADMIN_USERNAME?.trim() || null;
}

export function getAdminPasswordHash(): string | null {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || null;
}

export function getAdminSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || 'development-admin-session-secret';
}

export function getAdminSessionTtlHours(): number {
  const parsed = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 12);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

export function getAdminApiTokenTtlDays(): number {
  const parsed = Number(process.env.ADMIN_API_TOKEN_TTL_DAYS ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function getCookieSecure(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ADMIN_COOKIE_SECURE !== 'false';
}

export function getAllowedOidcEmails(): string[] {
  return parseList(process.env.OIDC_ALLOWED_EMAILS).map((entry) => entry.toLowerCase());
}

export function getTrustedProxyIps(): string[] {
  return parseList(process.env.ADMIN_TRUSTED_PROXY_IPS);
}

export function getOidcConfig() {
  return {
    issuerUrl: process.env.OIDC_ISSUER_URL?.trim() || '',
    clientId: process.env.OIDC_CLIENT_ID?.trim() || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET?.trim() || '',
    redirectUri: process.env.OIDC_REDIRECT_URI?.trim() || '',
    scopes: process.env.OIDC_SCOPES?.trim() || 'openid profile email',
  };
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256')
    .update(getAdminSessionSecret())
    .update(':')
    .update(token)
    .digest('hex');
}
