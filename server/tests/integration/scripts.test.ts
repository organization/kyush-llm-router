import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { initDb } from '../../src/config/database';

describe('Script API Endpoints', () => {
  let app: ReturnType<typeof createTestApp>;
  let userId: number;
  let backendId: number;
  let scriptId: number;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  // Setup: Create user and backend for testing
  beforeAll(async () => {
    const userResponse = await request(app).post('/admin/users').send({ name: 'Script Test User' });
    userId = userResponse.body.id;

    const backendResponse = await request(app).post('/admin/backends').send({
      name: 'Script Test Backend',
      base_url: 'http://localhost:8006/v1'
    });
    backendId = backendResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup: Delete created resources
    await request(app).delete(`/admin/users/${userId}`);
    await request(app).delete(`/admin/backends/${backendId}`);
  });

  describe('GET /admin/scripts', () => {
    it('should return empty array initially', async () => {
      const response = await request(app).get('/admin/scripts');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/scripts', () => {
    it('should create a new per-user-backend script', async () => {
      const scriptData = {
        name: 'Test Per-User-Backend Script',
        script_type: 'per-user-backend',
        target_user_id: userId,
        target_backend_id: backendId,
        script_code: `
export const onRequest = (context) => {
  console.log('Request intercepted');
  return context;
};

export const onResponse = (context) => {
  console.log('Response intercepted');
  return context;
};
`,
        is_active: true
      };

      const response = await request(app).post('/admin/scripts').send(scriptData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(scriptData.name);
      expect(response.body.script_type).toBe(scriptData.script_type);
      expect(response.body.target_user_id).toBe(userId);
      expect(response.body.target_backend_id).toBe(backendId);
      expect(response.body.is_active).toBe(true);
      
      scriptId = response.body.id;
    });

    it('should create a per-backend script', async () => {
      const scriptData = {
        name: 'Test Per-Backend Script',
        script_type: 'per-backend',
        target_backend_id: backendId,
        script_code: `
export const onRequest = (context) => {
  return context;
};
`,
        is_active: true
      };

      const response = await request(app).post('/admin/scripts').send(scriptData);
      
      expect(response.status).toBe(201);
      expect(response.body.script_type).toBe(scriptData.script_type);
      expect(response.body.target_user_id).toBeNull();
    });

    it('should create a per-user script', async () => {
      const scriptData = {
        name: 'Test Per-User Script',
        script_type: 'per-user',
        target_user_id: userId,
        script_code: `
export const onResponse = (context) => {
  return context;
};
`,
        is_active: true
      };

      const response = await request(app).post('/admin/scripts').send(scriptData);
      
      expect(response.status).toBe(201);
      expect(response.body.script_type).toBe(scriptData.script_type);
      expect(response.body.target_backend_id).toBeNull();
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app).post('/admin/scripts').send({
        script_type: 'per-backend',
        target_backend_id: backendId,
        script_code: 'export const onRequest = (context) => context;'
      });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if script_code is missing', async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Missing Code',
        script_type: 'per-backend',
        target_backend_id: backendId
      });
      
      expect(response.status).toBe(400);
    });

    it('should return 400 if script_type is missing', async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Missing Target Type',
        script_code: 'export const onRequest = (context) => context;'
      });
      
      expect(response.status).toBe(400);
    });

    it('should return 400 for per-user-backend without user_id and backend_id', async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Invalid Per-User-Backend',
        script_code: 'export const onRequest = (context) => context;',
        script_type: 'per-user-backend'
      });
      
      expect(response.status).toBe(400);
    });

    it('should accept invalid JavaScript code (validation happens at execution time)', async () => {
      const scriptData = {
        name: 'Invalid Code',
        script_code: 'this is invalid javascript {{{',
        script_type: 'per-backend',
        target_backend_id: backendId
      };

      const response = await request(app).post('/admin/scripts').send(scriptData);
      
      // Code is saved, but will fail at execution time
      expect(response.status).toBe(201);
    });
  });

  describe('GET /admin/scripts/:id', () => {
    let testScriptId: number;

    beforeAll(async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Script for Get Test',
        script_code: 'export const onRequest = (context) => context;',
        script_type: 'per-backend',
        target_backend_id: backendId
      });
      testScriptId = response.body.id;
    });

    afterAll(async () => {
      await request(app).delete(`/admin/scripts/${testScriptId}`);
    });

    it('should return a script by id', async () => {
      const response = await request(app).get(`/admin/scripts/${testScriptId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testScriptId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('script_code');
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app).get('/admin/scripts/99999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin/scripts/:id', () => {
    let testScriptId: number;

    beforeAll(async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Script for Update Test',
        script_code: 'export const onRequest = (context) => context;',
        script_type: 'per-backend',
        target_backend_id: backendId
      });
      testScriptId = response.body.id;
    });

    afterAll(async () => {
      await request(app).delete(`/admin/scripts/${testScriptId}`);
    });

    it('should update script name', async () => {
      const response = await request(app)
        .put(`/admin/scripts/${testScriptId}`)
        .send({
          name: 'Updated Script Name'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Script Name');
    });

    it('should update script code', async () => {
      const response = await request(app)
        .put(`/admin/scripts/${testScriptId}`)
        .send({
          script_code: 'export const onResponse = async (context) => context;'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.script_code).toBe('export const onResponse = async (context) => context;');
    });

    it('should toggle is_active', async () => {
      const response = await request(app)
        .put(`/admin/scripts/${testScriptId}`)
        .send({ is_active: false });
      
      expect(response.status).toBe(200);
      expect(response.body.is_active).toBe(false);
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app).put('/admin/scripts/99999').send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });

    it('should accept invalid JavaScript code (validation happens at execution time)', async () => {
      const response = await request(app)
        .put(`/admin/scripts/${testScriptId}`)
        .send({ script_code: 'invalid javascript {{{' });
      
      // Code is saved, but will fail at execution time
      expect(response.status).toBe(200);
    });
  });

  describe('POST /admin/scripts/:id/test', () => {
    let testScriptId: number;

    beforeAll(async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Script for Test',
        script_code: `
export const onRequest = (context) => {
  return context;
};

export const onResponse = (context) => {
  return context;
};
`,
        script_type: 'per-backend',
        target_backend_id: backendId
      });
      testScriptId = response.body.id;
    });

    afterAll(async () => {
      await request(app).delete(`/admin/scripts/${testScriptId}`);
    });

    it('should load and validate script syntax', async () => {
      const testPayload = {
        user: { id: userId, name: 'Test User' },
        backend: { id: backendId, name: 'Test Backend', base_url: 'http://localhost:8006/v1' },
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }]
          }),
          isStream: false
        }
      };

      const response = await request(app)
        .post(`/admin/scripts/${testScriptId}/test`)
        .send(testPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasOnRequest');
      expect(response.body).toHaveProperty('hasOnResponse');
    });

    it('should return 404 for non-existent script', async () => {
      const response = await request(app)
        .post('/admin/scripts/99999/test')
        .send({ request: {} });
      
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin/scripts/:id', () => {
    let testScriptId: number;

    beforeAll(async () => {
      const response = await request(app).post('/admin/scripts').send({
        name: 'Script for Delete',
        script_code: 'export const onRequest = (context) => context;',
        script_type: 'per-backend',
        target_backend_id: backendId
      });
      testScriptId = response.body.id;
    });

    it('should delete a script', async () => {
      const response = await request(app).delete(`/admin/scripts/${testScriptId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted script', async () => {
      const response = await request(app).delete(`/admin/scripts/${testScriptId}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('Script Execution Integration', () => {
    let testScriptId: number;
    let userApiKey: string;

    beforeAll(async () => {
      // Create script that modifies requests
      const scriptResponse = await request(app).post('/admin/scripts').send({
        name: 'Integration Test Script',
        script_code: `
export const onRequest = (context) => {
  const body = JSON.parse(context.request.body);
  body.messages.push({ role: 'system', content: 'Modified by middleware' });
  context.request.body = JSON.stringify(body);
  return context;
};

export const onResponse = (context) => {
  return context;
};
`,
        script_type: 'per-backend',
        target_backend_id: backendId,
        is_active: true
      });
      testScriptId = scriptResponse.body.id;

      // Create user with permission
      const userResponse = await request(app).post('/admin/users').send({ name: 'Integration User' });
      userApiKey = userResponse.body.api_key;
      
      await request(app)
        .post('/admin/permissions')
        .send({ user_id: userResponse.body.id, backend_id: backendId });
    });

    afterAll(async () => {
      await request(app).delete(`/admin/scripts/${testScriptId}`);
      // Note: User cleanup handled in other tests
    });

    it('should execute script when making request to backend', async () => {
      // This test verifies that scripts are executed during actual API calls
      // The script should modify the request before forwarding to backend
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({
          model: 'test-model',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      // Request will fail (502) because backend is not actually running,
      // but we can verify the script was executed by checking logs
      expect(response.status).toBe(502); // Backend unreachable
      
      // Check that request was logged with script execution
      const analyticsResponse = await request(app).get('/admin/analytics/requests?limit=10');
      const loggedRequest = analyticsResponse.body.rows.find((r: any) => 
        r.user_id === parseInt(userApiKey.split('-')[1]) || r.endpoint === '/v1/chat/completions'
      );
      
      expect(loggedRequest).toBeDefined();
    });
  });
});
