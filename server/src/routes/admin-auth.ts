import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  AdminLoginInputSchema,
  CreateAdminTokenInputSchema,
} from '@kyush/shared';

import { AdminApiTokenModel } from '../models/AdminApiToken';
import { AdminSessionModel } from '../models/AdminSession';
import {
  getAdminApiTokenTtlDays,
  getAdminAuthMode,
  getAdminSessionTtlHours,
  getAdminUsername,
  getAllowedOidcEmails,
  getOidcConfig,
  isEnvAdminEnabled,
  isOidcEnabled,
} from '../config/admin-auth';
import {
  requireAdminAccess,
  requireSessionCsrf,
  resolveAdminAuth,
} from '../utils/adminAuth';
import {
  clearAdminSessionCookie,
  createCsrfToken,
  generateOpaqueToken,
  hashAdminToken,
  issueAdminSessionCookie,
  tokenPrefix,
  verifyAdminPassword,
} from '../utils/adminSecurity';

import type {
  AdminPrincipal,
  AdminSessionResponse,
} from '../../../shared/types';
import type { AppEnv, AdminAuthContext } from '../types/hono';
import type { Context } from 'hono';

const router = new Hono<AppEnv>();
const oidcStateStore = new Map<string, { next: string; expiresAt: number }>();

function isSafeNextPath(value?: string): string {
  if (!value || value === '/') {
    return '/dashboard';
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  if (value.startsWith('/admin/') || value === '/admin') {
    return '/dashboard';
  }
  if (value === '/dashboard' || value.startsWith('/dashboard/')) {
    return value;
  }
  return '/dashboard';
}

function buildSessionResponse(
  adminAuth: AdminAuthContext | undefined,
): AdminSessionResponse {
  return {
    authenticated: !!adminAuth,
    authMode: getAdminAuthMode(),
    csrfToken:
      adminAuth?.method === 'session' ? (adminAuth.csrfToken ?? null) : null,
    principal: adminAuth?.principal ?? null,
  };
}

function createAdminSession(
  c: Context<AppEnv>,
  principal: AdminPrincipal,
): AdminSessionResponse {
  const sessionToken = generateOpaqueToken('adm_sess');
  const csrfToken = createCsrfToken();
  const ttlHours = getAdminSessionTtlHours();
  const expiresAt = new Date(
    Date.now() + ttlHours * 60 * 60 * 1000,
  ).toISOString();

  AdminSessionModel.create({
    sessionTokenHash: hashAdminToken(sessionToken),
    principal,
    csrfToken,
    expiresAt,
  });

  issueAdminSessionCookie(c, sessionToken, ttlHours * 60 * 60 * 1000);
  return {
    authenticated: true,
    authMode: getAdminAuthMode(),
    csrfToken,
    principal,
  };
}

router.get('/session', (c) => {
  const adminAuth = resolveAdminAuth(c);
  return c.json(buildSessionResponse(adminAuth));
});

router.post('/login', zValidator('json', AdminLoginInputSchema), (c) => {
  if (!isEnvAdminEnabled()) {
    return c.json({ error: 'ENV admin login is disabled' }, 404);
  }

  const { username, password } = c.req.valid('json');
  const configuredUsername = getAdminUsername();

  if (!configuredUsername || !username || !password) {
    return c.json({ error: 'Invalid admin credentials' }, 401);
  }

  if (username !== configuredUsername || !verifyAdminPassword(password)) {
    return c.json({ error: 'Invalid admin credentials' }, 401);
  }

  const principal: AdminPrincipal = {
    provider: 'env',
    subject: `env:${configuredUsername}`,
    username: configuredUsername,
    displayName: configuredUsername,
  };

  return c.json(createAdminSession(c, principal));
});

router.post('/logout', requireAdminAccess, requireSessionCsrf, (c) => {
  const adminAuth = c.get('adminAuth');
  if (adminAuth?.sessionId) {
    AdminSessionModel.revoke(adminAuth.sessionId);
  }

  clearAdminSessionCookie(c);
  return c.body(null, 204);
});

router.get('/oidc/start', async (c) => {
  if (!isOidcEnabled()) {
    return c.json({ error: 'OIDC is disabled' }, 404);
  }

  const oidc = getOidcConfig();
  if (!oidc.issuerUrl || !oidc.clientId || !oidc.redirectUri) {
    return c.json({ error: 'OIDC is not configured' }, 500);
  }

  const state = generateOpaqueToken('oidc_state');
  const next = isSafeNextPath(
    typeof c.req.query('next') === 'string'
      ? c.req.query('next')
      : '/dashboard',
  );
  oidcStateStore.set(state, { next, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    const discoveryResponse = await fetch(
      `${oidc.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`,
    );
    if (!discoveryResponse.ok) {
      throw new Error('Failed to load OIDC discovery document');
    }

    const discovery = (await discoveryResponse.json()) as {
      authorization_endpoint: string;
    };
    const redirect = new URL(discovery.authorization_endpoint);
    redirect.searchParams.set('client_id', oidc.clientId);
    redirect.searchParams.set('response_type', 'code');
    redirect.searchParams.set('scope', oidc.scopes);
    redirect.searchParams.set('redirect_uri', oidc.redirectUri);
    redirect.searchParams.set('state', state);
    return c.redirect(redirect.toString());
  } catch (error) {
    oidcStateStore.delete(state);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'OIDC discovery failed',
      },
      502,
    );
  }
});

router.get('/oidc/callback', async (c) => {
  if (!isOidcEnabled()) {
    return c.json({ error: 'OIDC is disabled' }, 404);
  }

  const state = c.req.query('state') ?? '';
  const code = c.req.query('code') ?? '';
  const stateRecord = oidcStateStore.get(state);
  oidcStateStore.delete(state);

  if (!stateRecord || stateRecord.expiresAt < Date.now() || !code) {
    return c.json({ error: 'Invalid OIDC callback state' }, 400);
  }

  const oidc = getOidcConfig();
  try {
    const discoveryResponse = await fetch(
      `${oidc.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`,
    );
    if (!discoveryResponse.ok) {
      throw new Error('Failed to load OIDC discovery document');
    }

    const discovery = (await discoveryResponse.json()) as {
      token_endpoint: string;
      userinfo_endpoint?: string;
    };

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: oidc.clientId,
        client_secret: oidc.clientSecret,
        redirect_uri: oidc.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange OIDC authorization code');
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
    };

    let email = '';
    let subject = '';
    let displayName = '';

    if (discovery.userinfo_endpoint && tokenPayload.access_token) {
      const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as {
          email?: string;
          sub?: string;
          name?: string;
          preferred_username?: string;
        };
        email = userInfo.email ?? '';
        subject = userInfo.sub ?? '';
        displayName =
          userInfo.name ?? userInfo.preferred_username ?? email ?? subject;
      }
    }

    if ((!email || !subject) && tokenPayload.id_token) {
      const parts = tokenPayload.id_token.split('.');
      if (parts.length >= 2) {
        const claims = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf8'),
        ) as {
          email?: string;
          sub?: string;
          name?: string;
          preferred_username?: string;
        };
        email = email || claims.email || '';
        subject = subject || claims.sub || '';
        displayName =
          displayName ||
          claims.name ||
          claims.preferred_username ||
          email ||
          subject;
      }
    }

    const normalizedEmail = email.toLowerCase();
    if (
      !normalizedEmail ||
      !subject ||
      !getAllowedOidcEmails().includes(normalizedEmail)
    ) {
      return c.json(
        { error: 'OIDC account is not allowed for admin access' },
        403,
      );
    }

    const principal: AdminPrincipal = {
      provider: 'oidc',
      subject: `oidc:${oidc.issuerUrl}:${subject}`,
      email: normalizedEmail,
      displayName: displayName || normalizedEmail,
    };

    createAdminSession(c, principal);
    return c.redirect(stateRecord.next);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'OIDC authentication failed',
      },
      502,
    );
  }
});

router.get('/tokens', requireAdminAccess, (c) => {
  const adminAuth = c.get('adminAuth')!;
  return c.json(AdminApiTokenModel.listBySubject(adminAuth.principal.subject));
});

router.post(
  '/tokens',
  requireAdminAccess,
  requireSessionCsrf,
  zValidator('json', CreateAdminTokenInputSchema),
  (c) => {
    const { name: trimmedName, expiresInDays } = c.req.valid('json');
    const ttlDays = expiresInDays ?? getAdminApiTokenTtlDays();
    const token = generateOpaqueToken('adm_tok');
    const adminAuth = c.get('adminAuth')!;
    const record = AdminApiTokenModel.create({
      tokenHash: hashAdminToken(token),
      tokenPrefix: tokenPrefix(token),
      name: trimmedName,
      principal: adminAuth.principal,
      expiresAt: new Date(
        Date.now() + ttlDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    return c.json({ token, record }, 201);
  },
);

router.delete('/tokens/:id', requireAdminAccess, requireSessionCsrf, (c) => {
  const tokenId = Number(c.req.param('id'));
  if (!Number.isFinite(tokenId)) {
    return c.json({ error: 'Invalid token id' }, 400);
  }

  const adminAuth = c.get('adminAuth')!;
  const success = AdminApiTokenModel.revokeForSubject(
    tokenId,
    adminAuth.principal.subject,
  );
  if (!success) {
    return c.json({ error: 'Admin API token not found' }, 404);
  }

  return c.body(null, 204);
});

export default router;
