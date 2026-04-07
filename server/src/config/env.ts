/**
 * Single source of truth for every environment variable the server reads.
 *
 * - All `process.env` access is centralised here.
 * - Each value is parsed/validated/normalised once at module load and exposed
 *   via `env`, an immutable object.
 * - Importers should grab a typed value (`env.SERVER_PORT`) instead of touching
 *   `process.env` directly. This makes mistakes loud (typos surface as TS
 *   errors) and concentrates default values in one place.
 *
 * Tests can mutate the underlying `process.env` before importing this module
 * (see tests/setup.ts) — values that may legitimately change at runtime are
 * exposed as functions instead of frozen primitives.
 */

import path from 'node:path';

import type { AdminAuthMode } from '../../../shared/types.js';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'data');
const DEFAULT_TIME_ZONE = 'UTC';
const DEFAULT_REFRESH_MIN_MS = 5 * 60 * 1000;
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result && result.length > 0 ? result : undefined;
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeAuthMode(value: string | undefined): AdminAuthMode {
  return value === 'env' || value === 'oidc' || value === 'both'
    ? value
    : 'both';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Eagerly-resolved values (read once at boot)
 * ────────────────────────────────────────────────────────────────────────── */

export const env = {
  // Server runtime
  get SERVER_PORT(): number {
    return parsePositiveNumber(process.env.SERVER_PORT, 3000);
  },
  get NODE_ENV(): string | undefined {
    return process.env.NODE_ENV;
  },
  get IS_PRODUCTION(): boolean {
    return process.env.NODE_ENV === 'production';
  },

  // Storage paths
  get DB_DIR(): string {
    return (
      trimmed(process.env.DB_DIR) ??
      trimmed(process.env.DB_PATH) ??
      DEFAULT_DB_DIR
    );
  },

  // Time zone (used for daily/monthly bucket math)
  get TIME_ZONE(): string {
    return trimmed(process.env.TZ) ?? DEFAULT_TIME_ZONE;
  },

  // CORS
  get CORS_ORIGINS(): string[] {
    const raw = trimmed(process.env.CORS_ORIGINS);
    return raw
      ? raw.split(',').map((origin) => origin.trim())
      : DEFAULT_CORS_ORIGINS;
  },

  // Admin auth mode + ENV credentials
  get ADMIN_AUTH_MODE(): AdminAuthMode {
    return normalizeAuthMode(process.env.ADMIN_AUTH_MODE);
  },
  get ADMIN_USERNAME(): string | null {
    return trimmed(process.env.ADMIN_USERNAME) ?? null;
  },
  get ADMIN_PASSWORD_HASH(): string | null {
    return trimmed(process.env.ADMIN_PASSWORD_HASH) ?? null;
  },
  get ADMIN_SESSION_SECRET(): string {
    return (
      trimmed(process.env.ADMIN_SESSION_SECRET) ??
      'development-admin-session-secret'
    );
  },
  get ADMIN_SESSION_TTL_HOURS(): number {
    return parsePositiveNumber(process.env.ADMIN_SESSION_TTL_HOURS, 12);
  },
  get ADMIN_API_TOKEN_TTL_DAYS(): number {
    return parsePositiveNumber(process.env.ADMIN_API_TOKEN_TTL_DAYS, 30);
  },
  get ADMIN_COOKIE_SECURE(): boolean {
    return (
      process.env.NODE_ENV === 'production' &&
      process.env.ADMIN_COOKIE_SECURE !== 'false'
    );
  },
  get ADMIN_TRUSTED_PROXY_IPS(): string[] {
    return parseList(process.env.ADMIN_TRUSTED_PROXY_IPS);
  },

  // OIDC
  get OIDC_ISSUER_URL(): string {
    return trimmed(process.env.OIDC_ISSUER_URL) ?? '';
  },
  get OIDC_CLIENT_ID(): string {
    return trimmed(process.env.OIDC_CLIENT_ID) ?? '';
  },
  get OIDC_CLIENT_SECRET(): string {
    return trimmed(process.env.OIDC_CLIENT_SECRET) ?? '';
  },
  get OIDC_REDIRECT_URI(): string {
    return trimmed(process.env.OIDC_REDIRECT_URI) ?? '';
  },
  get OIDC_SCOPES(): string {
    return trimmed(process.env.OIDC_SCOPES) ?? 'openid profile email';
  },
  get OIDC_ALLOWED_EMAILS(): string[] {
    return parseList(process.env.OIDC_ALLOWED_EMAILS).map((entry) =>
      entry.toLowerCase(),
    );
  },

  // Catalog refresh
  get MODEL_CATALOG_REFRESH_MIN_MS(): number {
    return parseNonNegativeNumber(
      process.env.MODEL_CATALOG_REFRESH_MIN_MS,
      DEFAULT_REFRESH_MIN_MS,
    );
  },
};
