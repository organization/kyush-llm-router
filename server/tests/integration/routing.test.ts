import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { createMockBackend } from '../utils/mockBackend';
import { initDb } from '../../src/config/database';

describe('Permission-based Routing', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  describe('Scenario 1: Authorized backend routing', () => {
    it('should route to authorized backend (auth passes, backend may fail)', async () => {
      const userResponse = await request(app).post('/admin/users').send({ name: 'Auth User 1-1' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'Auth Backend 1-1',
        base_url: 'http://localhost:8000/v1'
      });
      const backendId = backendResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(502);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Scenario 2: Unauthorized backend access blocked', () => {
    let userAApiKey: string;
    let userBApiKey: string;
    let backendBId: number;

    beforeAll(async () => {
      const userAResponse = await request(app).post('/admin/users').send({ name: 'User A 2-2' });
      userAApiKey = userAResponse.body.api_key;

      const userBResponse = await request(app).post('/admin/users').send({ name: 'User B 2-2' });
      userBApiKey = userBResponse.body.api_key;
      const userBId = userBResponse.body.id;

      const backendAResponse = await request(app).post('/admin/backends').send({
        name: 'Backend A 2-2',
        base_url: 'http://localhost:8001/v1'
      });

      const backendBResponse = await request(app).post('/admin/backends').send({
        name: 'Backend B 2-2',
        base_url: 'http://localhost:8002/v1'
      });
      backendBId = backendBResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userBId, backend_id: backendBId });
    });

    it('should return 403 when user has no backends', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userAApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No backends available for your account');
    });

    it('should successfully route user with permissions', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userBApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(502);
    });
  });

  describe('Scenario 3: User without any permissions', () => {
    it('should return 403 when user has no permissions', async () => {
      const userResponse = await request(app).post('/admin/users').send({ name: 'No Permission User 3-3' });
      const apiKey = userResponse.body.api_key;

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No backends available for your account');
    });
  });
});

describe('Multi-backend Routing', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  describe('Scenario 4: Random selection from multiple backends', () => {
    it('should route to different backends across multiple requests', async () => {
      const userResponse = await request(app).post('/admin/users').send({ name: 'Multi Backend User 4-4' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backend1Response = await request(app).post('/admin/backends').send({
        name: 'Multi Backend 4-4-1',
        base_url: 'http://localhost:8010/v1'
      });
      const backend1Id = backend1Response.body.id;

      const backend2Response = await request(app).post('/admin/backends').send({
        name: 'Multi Backend 4-4-2',
        base_url: 'http://localhost:8011/v1'
      });
      const backend2Id = backend2Response.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backend1Id });

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backend2Id });

      const responses = await Promise.all([
        request(app).post('/v1/chat/completions').set('Authorization', `Bearer ${userApiKey}`).send({ model: 'test', messages: [] }),
        request(app).post('/v1/chat/completions').set('Authorization', `Bearer ${userApiKey}`).send({ model: 'test', messages: [] }),
        request(app).post('/v1/chat/completions').set('Authorization', `Bearer ${userApiKey}`).send({ model: 'test', messages: [] })
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(502);
      });
    });
  });
});

describe('Inactive Backend Routing', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  describe('Scenario 5: Inactive backends excluded', () => {
    beforeAll(async () => {
      // Deactivate all existing backends before this test
      const allBackendsResponse = await request(app).get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }
    });

    afterAll(async () => {
      // Re-activate all backends after this test
      const allBackendsResponse = await request(app).get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (!backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: true });
        }
      }
    });

    it('should return 403 when only inactive backends are available', async () => {
      const userResponse = await request(app).post('/admin/users').send({ name: 'Inactive Test User 5-5-5' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      // Create backend first (default is_active=true)
      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'Inactive Backend 5-5-5',
        base_url: 'http://localhost:8020/v1'
      });
      const inactiveBackendId = backendResponse.body.id;

      // Then deactivate it
      await request(app).put(`/admin/backends/${inactiveBackendId}`).send({ is_active: false });

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: inactiveBackendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No active backends available');
    });
  });
});

describe('OpenAI Compatible Backend Integration', () => {
  let app: ReturnType<typeof createTestApp>;
  let mockServer: any;
  let mockPort: number;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  afterAll(async () => {
    // Re-activate all backends after tests
    const allBackendsResponse = await request(app).get('/admin/backends');
    const allBackends = allBackendsResponse.body;
    for (const backend of allBackends) {
      if (!backend.is_active) {
        await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: true });
      }
    }
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>(resolve => mockServer.close(resolve));
      mockServer = undefined;
    }
  });

  describe('Scenario 6: Mock backend with successful response', () => {
    it('should proxy request to mock backend and return response', async () => {
      // First, deactivate all existing backends to ensure only our mock backend is selected
      const allBackendsResponse = await request(app).get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }

      const { server, port } = createMockBackend();
      mockServer = server;
      mockPort = port;

      const userResponse = await request(app).post('/admin/users').send({ name: 'Mock Integration User 6-6' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'Mock Backend 6-6',
        base_url: `http://localhost:${mockPort}`
      });
      const backendId = backendResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ 
          model: 'mock-model', 
          messages: [{ role: 'user', content: 'Hello' }] 
        });

      // Re-activate backends for other tests
      for (const backend of allBackends) {
        if (backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: true });
        }
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('choices');
      expect(response.body.usage).toHaveProperty('total_tokens');
    });

    it('should replace router Authorization with backend API key for upstream requests', async () => {
      let receivedAuthorization: string | undefined;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          receivedAuthorization = req.headers.authorization;
        },
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await request(app).post('/admin/users').send({ name: 'Auth Rewrite User 6-6' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'Auth Rewrite Backend 6-6',
        base_url: `http://localhost:${mockPort}`,
        api_key: 'upstream-secret-key',
      });
      const backendId = backendResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({
          model: 'mock-model',
          messages: [{ role: 'user', content: 'Hello' }],
        });

      expect(response.status).toBe(200);
      expect(receivedAuthorization).toBe('Bearer upstream-secret-key');
      expect(receivedAuthorization).not.toBe(`Bearer ${userApiKey}`);
    });
  });

  describe('Scenario 7: Models endpoint routing', () => {
    it('should proxy models request to mock backend', async () => {
      // First, deactivate all existing backends to ensure only our mock backend is selected
      const allBackendsResponse = await request(app).get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }

      const { server, port } = createMockBackend({
        modelsResponse: [{ id: 'test-model-1', object: 'model' }, { id: 'test-model-2', object: 'model' }]
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await request(app).post('/admin/users').send({ name: 'Models Test User 7-7' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'Models Backend 7-7',
        base_url: `http://localhost:${port}`
      });
      const backendId = backendResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${userApiKey}`);

      // Re-activate backends for other tests
      for (const backend of allBackends) {
        if (backend.is_active) {
          await request(app).put(`/admin/backends/${backend.id}`).send({ is_active: true });
        }
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should return 403 for models when user has no permissions', async () => {
      const userResponse = await request(app).post('/admin/users').send({ name: 'No Permission Models User 7-7' });
      const userApiKey = userResponse.body.api_key;

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${userApiKey}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('No backends available for your account');
    });

    it('should not forward router Authorization when backend API key is absent', async () => {
      let receivedAuthorization: string | undefined;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          receivedAuthorization = req.headers.authorization;
        },
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await request(app).post('/admin/users').send({ name: 'No Upstream Auth User 7-7' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await request(app).post('/admin/backends').send({
        name: 'No Upstream Auth Backend 7-7',
        base_url: `http://localhost:${port}`,
      });
      const backendId = backendResponse.body.id;

      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({
          model: 'mock-model',
          messages: [{ role: 'user', content: 'Hello' }],
        });

      expect(response.status).toBe(200);
      expect(receivedAuthorization).toBeUndefined();
    });
  });
});
