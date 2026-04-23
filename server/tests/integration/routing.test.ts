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
    delete process.env.MODEL_LIST_INCLUDE_ROUTING_METADATA;

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

    it('should follow force rewrite chains before upstream forwarding', async () => {
      let receivedModel: string | undefined;
      const { server, port } = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            receivedModel = req.body.model;
          }
        },
        chatResponse: {
          id: 'force-chain-success',
          model: 'chain-final-c',
          choices: [{ index: 0, message: { role: 'assistant', content: 'chain' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'chain-final-c', object: 'model' }],
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Force Chain User 8-10' });
      const userApiKey = userResponse.body.api_key;
      const userId = userResponse.body.id;
      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Force Chain Backend 8-10',
        base_url: `http://localhost:${port}`,
      });

      await admin.post('/admin/permissions').send({ user_id: userId, backend_id: backendResponse.body.id });
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'chain-start-a', target_model: 'chain-mid-b', force: true })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'chain-mid-b', target_model: 'chain-final-c', force: true })).status).toBe(201);

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ model: 'chain-start-a', messages: [] });

      expect(response.status).toBe(200);
      expect(receivedModel).toBe('chain-final-c');
    });

    it('should continue a mixed chain only when the current fallback model is unavailable', async () => {
      let unavailableReceivedModel: string | undefined;
      const unavailableBackend = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            unavailableReceivedModel = req.body.model;
          }
        },
        chatResponse: {
          id: 'mixed-chain-unavailable',
          model: 'mixed-final-e',
          choices: [{ index: 0, message: { role: 'assistant', content: 'fallback-chain' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'mixed-final-e', object: 'model' }],
      });
      mockServer = unavailableBackend.server;
      mockPort = unavailableBackend.port;

      const unavailableUser = await admin.post('/admin/users').send({ name: 'Mixed Chain Missing User 8-11' });
      const unavailableBackendResponse = await admin.post('/admin/backends').send({
        name: 'Mixed Chain Missing Backend 8-11',
        base_url: `http://localhost:${unavailableBackend.port}`,
      });
      await admin.post('/admin/permissions').send({ user_id: unavailableUser.body.id, backend_id: unavailableBackendResponse.body.id });
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-missing-a', target_model: 'mixed-missing-b', force: true })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-missing-b', target_model: 'mixed-missing-c', force: true })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-missing-c', target_model: 'mixed-missing-d', force: false })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-missing-d', target_model: 'mixed-final-e', force: true })).status).toBe(201);

      const unavailableResponse = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${unavailableUser.body.api_key}`)
        .send({ model: 'mixed-missing-a', messages: [] });

      expect(unavailableResponse.status).toBe(200);
      expect(unavailableReceivedModel).toBe('mixed-final-e');

      let availableReceivedModel: string | undefined;
      const availableBackend = createMockBackend({
        onRequest: (req) => {
          if (req.path === '/v1/chat/completions') {
            availableReceivedModel = req.body.model;
          }
        },
        chatResponse: {
          id: 'mixed-chain-available',
          model: 'mixed-available-c',
          choices: [{ index: 0, message: { role: 'assistant', content: 'available-chain' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        modelsResponse: [{ id: 'mixed-available-c', object: 'model' }, { id: 'mixed-available-e', object: 'model' }],
      });

      try {
        const availableUser = await admin.post('/admin/users').send({ name: 'Mixed Chain Available User 8-12' });
        const availableBackendResponse = await admin.post('/admin/backends').send({
          name: 'Mixed Chain Available Backend 8-12',
          base_url: `http://localhost:${availableBackend.port}`,
        });
        await admin.post('/admin/permissions').send({ user_id: availableUser.body.id, backend_id: availableBackendResponse.body.id });
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-available-a', target_model: 'mixed-available-b', force: true })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-available-b', target_model: 'mixed-available-c', force: true })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-available-c', target_model: 'mixed-available-d', force: false })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'mixed-available-d', target_model: 'mixed-available-e', force: true })).status).toBe(201);

        const availableResponse = await request(app)
          .post('/v1/chat/completions')
          .set('Authorization', `Bearer ${availableUser.body.api_key}`)
          .send({ model: 'mixed-available-a', messages: [] });

        expect(availableResponse.status).toBe(200);
        expect(availableReceivedModel).toBe('mixed-available-c');
      } finally {
        await new Promise<void>((resolve) => availableBackend.server.close(() => resolve()));
      }
    });

    it('should expose only requestable native models and rewrite aliases from /v1/models', async () => {
      const allowedBackend = createMockBackend({
        modelsResponse: [
          { id: 'models-visible-final', object: 'model' },
          { id: 'models-native-forced-away', object: 'model' },
        ],
      });
      const deniedBackend = createMockBackend({
        modelsResponse: [{ id: 'models-denied-final', object: 'model' }],
      });
      mockServer = allowedBackend.server;
      mockPort = allowedBackend.port;

      try {
        const userResponse = await admin.post('/admin/users').send({ name: 'Requestable Models User 8-13' });
        const allowedBackendResponse = await admin.post('/admin/backends').send({
          name: 'Requestable Models Allowed Backend 8-13',
          base_url: `http://localhost:${allowedBackend.port}`,
        });
        await admin.post('/admin/backends').send({
          name: 'Requestable Models Denied Backend 8-13',
          base_url: `http://localhost:${deniedBackend.port}`,
        });
        await admin.post('/admin/permissions').send({ user_id: userResponse.body.id, backend_id: allowedBackendResponse.body.id });
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'models-visible-alias', target_model: 'models-visible-final', force: true })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'models-missing-alias', target_model: 'models-missing-final', force: true })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'models-denied-alias', target_model: 'models-denied-final', force: true })).status).toBe(201);
        expect((await admin.post('/admin/model-rewrites').send({ source_model: 'models-native-forced-away', target_model: 'models-missing-final', force: true })).status).toBe(201);

        const response = await request(app)
          .get('/v1/models')
          .set('Authorization', `Bearer ${userResponse.body.api_key}`);

        expect(response.status).toBe(200);
        const ids = response.body.data.map((item: any) => item.id);
        expect(ids).toContain('models-visible-final');
        expect(ids).toContain('models-visible-alias');
        expect(ids).not.toContain('models-missing-alias');
        expect(ids).not.toContain('models-denied-alias');
        expect(ids).not.toContain('models-native-forced-away');
        expect(response.body.data.every((item: any) => item.kyush_router === undefined)).toBe(true);
      } finally {
        await new Promise<void>((resolve) => deniedBackend.server.close(() => resolve()));
      }
    });

    it('should include kyush_router metadata for /v1/models when enabled', async () => {
      process.env.MODEL_LIST_INCLUDE_ROUTING_METADATA = 'true';

      const { server, port } = createMockBackend({
        modelsResponse: [
          { id: 'metadata-native', object: 'model' },
          { id: 'metadata-final', object: 'model' },
          { id: 'metadata-skip-current', object: 'model' },
        ],
      });
      mockServer = server;
      mockPort = port;

      const userResponse = await admin.post('/admin/users').send({ name: 'Model Metadata User 8-14' });
      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Model Metadata Backend 8-14',
        base_url: `http://localhost:${port}`,
      });
      await admin.post('/admin/permissions').send({ user_id: userResponse.body.id, backend_id: backendResponse.body.id });
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'metadata-alias-a', target_model: 'metadata-alias-b', force: true })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'metadata-alias-b', target_model: 'metadata-missing-c', force: true })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'metadata-missing-c', target_model: 'metadata-final', force: false })).status).toBe(201);
      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'metadata-skip-current', target_model: 'metadata-skip-target', force: false })).status).toBe(201);

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${userResponse.body.api_key}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((item: any) => item.kyush_router && !('backend_ids' in item.kyush_router))).toBe(true);

      const native = response.body.data.find((item: any) => item.id === 'metadata-native');
      expect(native.kyush_router).toEqual({
        requested_model: 'metadata-native',
        routed_model: 'metadata-native',
        was_rewritten: false,
        rule_type: 'none',
        rewrite_path: [],
      });

      const alias = response.body.data.find((item: any) => item.id === 'metadata-alias-a');
      expect(alias.kyush_router).toEqual({
        requested_model: 'metadata-alias-a',
        routed_model: 'metadata-final',
        was_rewritten: true,
        rule_type: 'chain',
        rewrite_path: [
          { source_model: 'metadata-alias-a', target_model: 'metadata-alias-b', mode: 'force' },
          { source_model: 'metadata-alias-b', target_model: 'metadata-missing-c', mode: 'force' },
          { source_model: 'metadata-missing-c', target_model: 'metadata-final', mode: 'fallback' },
        ],
      });

      const skippedFallback = response.body.data.find((item: any) => item.id === 'metadata-skip-current');
      expect(skippedFallback.kyush_router).toEqual({
        requested_model: 'metadata-skip-current',
        routed_model: 'metadata-skip-current',
        was_rewritten: false,
        rule_type: 'none',
        rewrite_path: [],
      });
    });

    it('should reject active rewrite cycles while allowing inactive cycles until activation', async () => {
      const selfLoop = await admin.post('/admin/model-rewrites').send({
        source_model: 'cycle-self-a',
        target_model: 'cycle-self-a',
        force: true,
      });
      expect(selfLoop.status).toBe(409);
      expect(selfLoop.body.error).toBe('Model rewrite cycle detected');

      expect((await admin.post('/admin/model-rewrites').send({ source_model: 'cycle-active-a', target_model: 'cycle-active-b', force: true })).status).toBe(201);
      const activeCycle = await admin.post('/admin/model-rewrites').send({
        source_model: 'cycle-active-b',
        target_model: 'cycle-active-a',
        force: true,
      });
      expect(activeCycle.status).toBe(409);

      const inactiveA = await admin.post('/admin/model-rewrites').send({
        source_model: 'cycle-inactive-a',
        target_model: 'cycle-inactive-b',
        is_active: false,
        force: true,
      });
      const inactiveB = await admin.post('/admin/model-rewrites').send({
        source_model: 'cycle-inactive-b',
        target_model: 'cycle-inactive-a',
        is_active: false,
        force: true,
      });
      expect(inactiveA.status).toBe(201);
      expect(inactiveB.status).toBe(201);

      const activation = await admin.put(`/admin/model-rewrites/${inactiveA.body.id}`).send({ is_active: true });
      expect(activation.status).toBe(200);
      const secondActivation = await admin.put(`/admin/model-rewrites/${inactiveB.body.id}`).send({ is_active: true });
      expect(secondActivation.status).toBe(409);
    });
  });
});
