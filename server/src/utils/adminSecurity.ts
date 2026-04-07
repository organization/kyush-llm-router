import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import {
  getAdminPasswordHash,
  getAdminSessionTtlHours,
  getCookieSecure,
  hashOpaqueToken,
} from '../config/admin-auth.js';

import type { Context } from 'hono';

const SESSION_COOKIE_NAME = 'kyush_admin_session';

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

export function createCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashAdminToken(token: string): string {
  return hashOpaqueToken(token);
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12);
}

/**
 * Cookie writes go through hono's `setCookie`/`deleteCookie` helpers — Hono
 * handles the Set-Cookie serialisation, multiple-header concatenation, and
 * SameSite/Secure flag bookkeeping for us. We never touch the raw header.
 */
export function issueAdminSessionCookie(
  c: Context,
  sessionToken: string,
  maxAgeMs: number,
): void {
  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: getCookieSecure(),
    maxAge: Math.max(1, Math.floor(maxAgeMs / 1000)),
  });
}

export function clearAdminSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: getCookieSecure(),
  });
}

/**
 * Reads the admin session cookie via Hono's `getCookie` helper. Returns null
 * if the cookie is absent or empty so the auth middleware can short-circuit.
 */
export function getSessionTokenFromContext(c: Context): string | null {
  const value = getCookie(c, SESSION_COOKIE_NAME);
  return value && value.length > 0 ? value : null;
}

export function verifyAdminPassword(password: string): boolean {
  const storedHash = getAdminPasswordHash();
  if (!storedHash) return false;

  if (storedHash.startsWith('sha256$')) {
    const expected = storedHash.slice('sha256$'.length);
    const actual = createHash('sha256').update(password).digest('hex');
    return safeStringEqual(actual, expected);
  }

  if (storedHash.startsWith('scrypt$')) {
    const [, saltHex, expectedHex] = storedHash.split('$');
    if (!saltHex || !expectedHex) return false;
    const derived = scryptSync(
      password,
      Buffer.from(saltHex, 'hex'),
      expectedHex.length / 2,
    );
    return timingSafeEqual(derived, Buffer.from(expectedHex, 'hex'));
  }

  return false;
}

export function computeExpiry(
  hours: number = getAdminSessionTtlHours(),
): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
