import { createHash } from 'node:crypto';

import { env } from './env.js';

import type { AdminAuthMode } from '../../../shared/types.js';

export function getAdminAuthMode(): AdminAuthMode {
  return env.ADMIN_AUTH_MODE;
}

export function isEnvAdminEnabled(): boolean {
  const mode = env.ADMIN_AUTH_MODE;
  return mode === 'env' || mode === 'both';
}

export function isOidcEnabled(): boolean {
  const mode = env.ADMIN_AUTH_MODE;
  return mode === 'oidc' || mode === 'both';
}

export function getAdminUsername(): string | null {
  return env.ADMIN_USERNAME;
}

export function getAdminPasswordHash(): string | null {
  return env.ADMIN_PASSWORD_HASH;
}

export function getAdminSessionSecret(): string {
  return env.ADMIN_SESSION_SECRET;
}

export function getAdminSessionTtlHours(): number {
  return env.ADMIN_SESSION_TTL_HOURS;
}

export function getAdminApiTokenTtlDays(): number {
  return env.ADMIN_API_TOKEN_TTL_DAYS;
}

export function getCookieSecure(): boolean {
  return env.ADMIN_COOKIE_SECURE;
}

export function getAllowedOidcEmails(): string[] {
  return env.OIDC_ALLOWED_EMAILS;
}

export function getTrustedProxyIps(): string[] {
  return env.ADMIN_TRUSTED_PROXY_IPS;
}

export function getOidcConfig() {
  return {
    issuerUrl: env.OIDC_ISSUER_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUri: env.OIDC_REDIRECT_URI,
    scopes: env.OIDC_SCOPES,
  };
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256')
    .update(env.ADMIN_SESSION_SECRET)
    .update(':')
    .update(token)
    .digest('hex');
}
