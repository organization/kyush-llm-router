import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { createAdminClient } from '../utils/adminClient';

describe('Admin Authentication', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should reject unauthenticated admin access', async () => {
    const response = await request(app).get('/admin/users');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Admin authentication required');
  });

  it('should establish an admin session through ENV login', async () => {
    const admin = await createAdminClient(app);
    const response = await admin.get('/admin/auth/session');
    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(true);
    expect(response.body.principal.provider).toBe('env');
    expect(typeof response.body.csrfToken).toBe('string');
  });

  it('should require CSRF for session-based writes', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/auth/login').send({ username: 'admin', password: 'password' }).expect(200);

    const response = await agent.post('/admin/users').send({ name: 'Blocked By Csrf' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Invalid CSRF token');
  });
});
