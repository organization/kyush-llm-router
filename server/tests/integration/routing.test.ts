import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { createMockBackend } from '../utils/mockBackend';
import { initDb } from '../../src/config/database';
import { createAdminClient } from '../utils/adminClient';

describe('Permission-based Routing', () => {
  let app: ReturnType<typeof createTestApp>;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);
  });

  describe('Scenario 1: Authorized backend routing', () => {
    it('should return model-not-available when catalog refresh fails for an authorized backend', async () => {
      const userResponse = await admin.post('/admin/users').send({ name: 'Auth User 1-1' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Auth Backend 1-1',
        base_url: 'http://localhost:8000/v1'
      });
      const backendId = backendResponse.body.id;

      await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Scenario 2: Unauthorized backend access blocked', () => {
    let userAApiKey: string;
    let userBApiKey: string;
    let backendBId: number;

    beforeAll(async () => {
      const userAResponse = await admin.post('/admin/users').send({ name: 'User A 2-2' });
      userAApiKey = userAResponse.body.api_key;

      const userBResponse = await admin.post('/admin/users').send({ name: 'User B 2-2' });
      userBApiKey = userBResponse.body.api_key;
      const userBId = userBResponse.body.id;

      await admin.post('/admin/backends').send({
        name: 'Backend A 2-2',
        base_url: 'http://localhost:8001/v1'
      });

      const backendBResponse = await admin.post('/admin/backends').send({
        name: 'Backend B 2-2',
        base_url: 'http://localhost:8002/v1'
      });
      backendBId = backendBResponse.body.id;

      await admin
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

    it('should return model-not-available when the permitted backend has no cached model match', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userBApiKey}`)
        .send({ model: 'test', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(404);
    });
  });

  describe('Scenario 3: User without any permissions', () => {
    it('should return 403 when user has no permissions', async () => {
      const userResponse = await admin.post('/admin/users').send({ name: 'No Permission User 3-3' });
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
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);
  });

  describe('Scenario 4: Model-aware candidate selection', () => {
    it('should use only backends that serve the requested model', async () => {
      const userResponse = await admin.post('/admin/users').send({ name: 'Multi Backend User 4-4' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendServerA = createMockBackend({
        chatResponse: {
          id: 'candidate-a',
          model: 'model-a',
          choices: [{ index: 0, message: { role: 'assistant', content: 'A' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'model-a', object: 'model' }],
      });
      const backendServerB = createMockBackend({
        chatResponse: {
          id: 'candidate-b',
          model: 'model-b',
          choices: [{ index: 0, message: { role: 'assistant', content: 'B' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'model-b', object: 'model' }],
      });

      const backend1Response = await admin.post('/admin/backends').send({
        name: 'Multi Backend 4-4-1',
        base_url: `http://localhost:${backendServerA.port}`
      });
      const backend1Id = backend1Response.body.id;

      const backend2Response = await admin.post('/admin/backends').send({
        name: 'Multi Backend 4-4-2',
        base_url: `http://localhost:${backendServerB.port}`
      });
      const backend2Id = backend2Response.body.id;

      await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backend1Id });

      await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backend2Id });

      const responseA = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'model-a', messages: [] });
      const responseB = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'model-b', messages: [] });

      expect(responseA.status).toBe(200);
      expect(responseA.body.id).toBe('candidate-a');
      expect(responseB.status).toBe(200);
      expect(responseB.body.id).toBe('candidate-b');

      await new Promise<void>((resolve) => backendServerA.server.close(() => resolve()));
      await new Promise<void>((resolve) => backendServerB.server.close(() => resolve()));
    });
  });
});

describe('Inactive Backend Routing', () => {
  let app: ReturnType<typeof createTestApp>;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);
  });

  describe('Scenario 5: Inactive backends excluded', () => {
    beforeAll(async () => {
      // Deactivate all existing backends before this test
      const allBackendsResponse = await admin.get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }
    });

    afterAll(async () => {
      // Re-activate all backends after this test
      const allBackendsResponse = await admin.get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (!backend.is_active) {
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: true });
        }
      }
    });

    it('should return 403 when only inactive backends are available', async () => {
      const userResponse = await admin.post('/admin/users').send({ name: 'Inactive Test User 5-5-5' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      // Create backend first (default is_active=true)
      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Inactive Backend 5-5-5',
        base_url: 'http://localhost:8020/v1'
      });
      const inactiveBackendId = backendResponse.body.id;

      // Then deactivate it
      await admin.put(`/admin/backends/${inactiveBackendId}`).send({ is_active: false });

      await admin
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
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let mockServer: any;
  let mockPort: number;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);
  });

  afterAll(async () => {
    // Re-activate all backends after tests
    const allBackendsResponse = await admin.get('/admin/backends');
    const allBackends = allBackendsResponse.body;
    for (const backend of allBackends) {
      if (!backend.is_active) {
        await admin.put(`/admin/backends/${backend.id}`).send({ is_active: true });
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
      const allBackendsResponse = await admin.get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }

      const { server, port } = createMockBackend();
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Mock Integration User 6-6' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Mock Backend 6-6',
        base_url: `http://localhost:${mockPort}`
      });
      const backendId = backendResponse.body.id;

      await admin
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
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: true });
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

      const userResponse = await admin.post('/admin/users').send({ name: 'Auth Rewrite User 6-6' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Auth Rewrite Backend 6-6',
        base_url: `http://localhost:${mockPort}`,
        api_key: 'upstream-secret-key',
      });
      const backendId = backendResponse.body.id;

      await admin
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

    it('should preserve multimodal image messages and chat template kwargs when proxying', async () => {
      let receivedBody: any;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            receivedBody = req.body;
          }
        },
        modelsResponse: [{ id: 'vision-test-model', object: 'model' }],
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Vision Payload User 6-6' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Vision Payload Backend 6-6',
        base_url: `http://localhost:${mockPort}`,
      });
      const backendId = backendResponse.body.id;

      await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const imageDataUrl = `data:image/jpeg;base64,${'a'.repeat(128 * 1024)}`;
      const payload = {
        model: 'vision-test-model',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '이 이미지는 무엇인가요?' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        }],
        chat_template_kwargs: {
          enable_thinking: true,
        },
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(receivedBody).toEqual(payload);
    });
  });

  describe('Scenario 7: Models endpoint routing', () => {
    it('should return the union of cached models from allowed active backends', async () => {
      // First, deactivate all existing backends to ensure only our mock backend is selected
      const allBackendsResponse = await admin.get('/admin/backends');
      const allBackends = allBackendsResponse.body;
      for (const backend of allBackends) {
        if (backend.is_active) {
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: false });
        }
      }

      const { server, port } = createMockBackend({
        modelsResponse: [{ id: 'test-model-1', object: 'model' }, { id: 'test-model-2', object: 'model' }]
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Models Test User 7-7' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Models Backend 7-7',
        base_url: `http://localhost:${port}`
      });
      const backendId = backendResponse.body.id;

      await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${userApiKey}`);

      // Re-activate backends for other tests
      for (const backend of allBackends) {
        if (backend.is_active) {
          await admin.put(`/admin/backends/${backend.id}`).send({ is_active: true });
        }
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.map((item: any) => item.id)).toEqual(['test-model-1', 'test-model-2']);
    });

    it('should return 403 for models when user has no permissions', async () => {
      const userResponse = await admin.post('/admin/users').send({ name: 'No Permission Models User 7-7' });
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

      const userResponse = await admin.post('/admin/users').send({ name: 'No Upstream Auth User 7-7' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'No Upstream Auth Backend 7-7',
        base_url: `http://localhost:${port}`,
      });
      const backendId = backendResponse.body.id;

      await admin
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

  describe('Scenario 8: Rewrite-based routing', () => {
    it('should rewrite the requested model before backend selection and upstream forwarding', async () => {
      let receivedModel: string | undefined;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            receivedModel = req.body.model;
          }
        },
        chatResponse: {
          id: 'rewrite-success',
          model: 'gpt-3.5',
          choices: [{ index: 0, message: { role: 'assistant', content: 'rewritten' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'gpt-3.5', object: 'model' }],
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Rewrite Route User 8-8' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Rewrite Backend 8-8',
        base_url: `http://localhost:${port}`,
      });
      const backendId = backendResponse.body.id;

      await admin.post('/admin/permissions').send({ user_id: userId, backend_id: backendId });
      const rewriteResponse = await admin.post('/admin/model-rewrites').send({
        source_model: 'gpt-3.5-turbo',
        target_model: 'gpt-3.5',
        force: true,
      });
      expect(rewriteResponse.status).toBe(201);

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(200);
      expect(receivedModel).toBe('gpt-3.5');
      expect(response.body.model).toBe('gpt-3.5');
    });

    it('should use fallback rewrite only when the original model is unavailable', async () => {
      let receivedModel: string | undefined;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            receivedModel = req.body.model;
          }
        },
        chatResponse: {
          id: 'fallback-success',
          model: 'fallback-model',
          choices: [{ index: 0, message: { role: 'assistant', content: 'fallback' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'fallback-model', object: 'model' }],
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Fallback Route User 8-9' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Fallback Backend 8-9',
        base_url: `http://localhost:${port}`,
      });
      const backendId = backendResponse.body.id;

      await admin.post('/admin/permissions').send({ user_id: userId, backend_id: backendId });
      const rewriteResponse = await admin.post('/admin/model-rewrites').send({
        source_model: 'missing-model',
        target_model: 'fallback-model',
        force: false,
      });
      expect(rewriteResponse.status).toBe(201);

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'missing-model', messages: [{ role: 'user', content: 'Hello' }] });

      expect(response.status).toBe(200);
      expect(receivedModel).toBe('fallback-model');
      expect(response.body.model).toBe('fallback-model');
    });
  });
});
