import { Router, Request, Response } from 'express';
import { AdminPrincipal, AdminSessionResponse } from '../../../shared/types';
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
import { AdminRequest, requireAdminAccess, requireSessionCsrf, resolveAdminAuth } from '../utils/adminAuth';
import {
  clearAdminSessionCookie,
  createCsrfToken,
  generateOpaqueToken,
  hashAdminToken,
  issueAdminSessionCookie,
  tokenPrefix,
  verifyAdminPassword,
} from '../utils/adminSecurity';

const router: Router = Router();
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

function buildSessionResponse(req: AdminRequest): AdminSessionResponse {
  return {
    authenticated: !!req.adminAuth,
    authMode: getAdminAuthMode(),
    csrfToken: req.adminAuth?.method === 'session' ? req.adminAuth.csrfToken ?? null : null,
    principal: req.adminAuth?.principal ?? null,
  };
}

function createAdminSession(res: Response, principal: AdminPrincipal): AdminSessionResponse {
  const sessionToken = generateOpaqueToken('adm_sess');
  const csrfToken = createCsrfToken();
  const ttlHours = getAdminSessionTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  AdminSessionModel.create({
    sessionTokenHash: hashAdminToken(sessionToken),
    principal,
    csrfToken,
    expiresAt,
  });

  issueAdminSessionCookie(res, sessionToken, ttlHours * 60 * 60 * 1000);
  return {
    authenticated: true,
    authMode: getAdminAuthMode(),
    csrfToken,
    principal,
  };
}

router.get('/session', (req: AdminRequest, res: Response) => {
  resolveAdminAuth(req);
  res.json(buildSessionResponse(req));
});

router.post('/login', (req: Request, res: Response) => {
  if (!isEnvAdminEnabled()) {
    res.status(404).json({ error: 'ENV admin login is disabled' });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  const configuredUsername = getAdminUsername();

  if (!configuredUsername || !username || !password) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  if (username !== configuredUsername || !verifyAdminPassword(password)) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  const principal: AdminPrincipal = {
    provider: 'env',
    subject: `env:${configuredUsername}`,
    username: configuredUsername,
    displayName: configuredUsername,
  };

  res.json(createAdminSession(res, principal));
});

router.post('/logout', requireAdminAccess, requireSessionCsrf, (req: AdminRequest, res: Response) => {
  if (req.adminAuth?.sessionId) {
    AdminSessionModel.revoke(req.adminAuth.sessionId);
  }

  clearAdminSessionCookie(res);
  res.status(204).send();
});

router.get('/oidc/start', async (req: Request, res: Response) => {
  if (!isOidcEnabled()) {
    res.status(404).json({ error: 'OIDC is disabled' });
    return;
  }

  const oidc = getOidcConfig();
  if (!oidc.issuerUrl || !oidc.clientId || !oidc.redirectUri) {
    res.status(500).json({ error: 'OIDC is not configured' });
    return;
  }

  const state = generateOpaqueToken('oidc_state');
  const next = isSafeNextPath(typeof req.query.next === 'string' ? req.query.next : '/dashboard');
  oidcStateStore.set(state, { next, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    const discoveryResponse = await fetch(`${oidc.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
    if (!discoveryResponse.ok) {
      throw new Error('Failed to load OIDC discovery document');
    }

    const discovery = await discoveryResponse.json() as { authorization_endpoint: string };
    const redirect = new URL(discovery.authorization_endpoint);
    redirect.searchParams.set('client_id', oidc.clientId);
    redirect.searchParams.set('response_type', 'code');
    redirect.searchParams.set('scope', oidc.scopes);
    redirect.searchParams.set('redirect_uri', oidc.redirectUri);
    redirect.searchParams.set('state', state);
    res.redirect(redirect.toString());
  } catch (error) {
    oidcStateStore.delete(state);
    res.status(502).json({ error: error instanceof Error ? error.message : 'OIDC discovery failed' });
  }
});

router.get('/oidc/callback', async (req: Request, res: Response) => {
  if (!isOidcEnabled()) {
    res.status(404).json({ error: 'OIDC is disabled' });
    return;
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const stateRecord = oidcStateStore.get(state);
  oidcStateStore.delete(state);

  if (!stateRecord || stateRecord.expiresAt < Date.now() || !code) {
    res.status(400).json({ error: 'Invalid OIDC callback state' });
    return;
  }

  const oidc = getOidcConfig();
  try {
    const discoveryResponse = await fetch(`${oidc.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
    if (!discoveryResponse.ok) {
      throw new Error('Failed to load OIDC discovery document');
    }

    const discovery = await discoveryResponse.json() as {
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

    const tokenPayload = await tokenResponse.json() as { access_token?: string; id_token?: string };

    let email = '';
    let subject = '';
    let displayName = '';

    if (discovery.userinfo_endpoint && tokenPayload.access_token) {
      const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json() as {
          email?: string;
          sub?: string;
          name?: string;
          preferred_username?: string;
        };
        email = userInfo.email ?? '';
        subject = userInfo.sub ?? '';
        displayName = userInfo.name ?? userInfo.preferred_username ?? email ?? subject;
      }
    }

    if ((!email || !subject) && tokenPayload.id_token) {
      const parts = tokenPayload.id_token.split('.');
      if (parts.length >= 2) {
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
          email?: string;
          sub?: string;
          name?: string;
          preferred_username?: string;
        };
        email = email || claims.email || '';
        subject = subject || claims.sub || '';
        displayName = displayName || claims.name || claims.preferred_username || email || subject;
      }
    }

    const normalizedEmail = email.toLowerCase();
    if (!normalizedEmail || !subject || !getAllowedOidcEmails().includes(normalizedEmail)) {
      res.status(403).json({ error: 'OIDC account is not allowed for admin access' });
      return;
    }

    const principal: AdminPrincipal = {
      provider: 'oidc',
      subject: `oidc:${oidc.issuerUrl}:${subject}`,
      email: normalizedEmail,
      displayName: displayName || normalizedEmail,
    };

    createAdminSession(res, principal);
    res.redirect(stateRecord.next);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'OIDC authentication failed' });
  }
});

router.get('/tokens', requireAdminAccess, (req: AdminRequest, res: Response) => {
  res.json(AdminApiTokenModel.listBySubject(req.adminAuth!.principal.subject));
});

router.post('/tokens', requireAdminAccess, requireSessionCsrf, (req: AdminRequest, res: Response) => {
  const { name, expiresInDays } = req.body as { name?: string; expiresInDays?: number };
  const trimmedName = name?.trim();
  if (!trimmedName) {
    res.status(400).json({ error: 'Token name is required' });
    return;
  }

  const ttlDays = Number.isFinite(expiresInDays) && Number(expiresInDays) > 0
    ? Number(expiresInDays)
    : getAdminApiTokenTtlDays();
  const token = generateOpaqueToken('adm_tok');
  const record = AdminApiTokenModel.create({
    tokenHash: hashAdminToken(token),
    tokenPrefix: tokenPrefix(token),
    name: trimmedName,
    principal: req.adminAuth!.principal,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
  });

  res.status(201).json({ token, record });
});

router.delete('/tokens/:id', requireAdminAccess, requireSessionCsrf, (req: AdminRequest, res: Response) => {
  const tokenId = Number(req.params.id);
  if (!Number.isFinite(tokenId)) {
    res.status(400).json({ error: 'Invalid token id' });
    return;
  }

  const success = AdminApiTokenModel.revokeForSubject(tokenId, req.adminAuth!.principal.subject);
  if (!success) {
    res.status(404).json({ error: 'Admin API token not found' });
    return;
  }

  res.status(204).send();
});

export default router;
