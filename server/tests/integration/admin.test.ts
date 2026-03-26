import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../utils/testApp';
import { createAdminClient } from '../utils/adminClient';
import { createMockBackend } from '../utils/mockBackend';

let app: ReturnType<typeof createTestApp>;
let admin: Awaited<ReturnType<typeof createAdminClient>>;

beforeAll(() => {
  app = createTestApp();
});

beforeAll(async () => {
  admin = await createAdminClient(app);
});

describe('Admin API - User Management', () => {
  describe('GET /admin/users', () => {
    it('should return empty array initially', async () => {
      const response = await admin.get('/admin/users');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/users', () => {
    it('should create a new user', async () => {
      const userData = { name: 'Test User', email: 'test@example.com' };
      const response = await admin.post('/admin/users').send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body).toHaveProperty('api_key');
      expect(response.body.api_key).toMatch(/^sk-/);
    });

    it('should create a user with a manually supplied api key', async () => {
      const userData = { name: 'Migrated User', api_key: 'legacy-user-key-001' };
      const response = await admin.post('/admin/users').send(userData);

      expect(response.status).toBe(201);
      expect(response.body.api_key).toBe(userData.api_key);
    });

    it('should return 409 if a manually supplied api key already exists', async () => {
      await admin.post('/admin/users').send({ name: 'Duplicate Key Source', api_key: 'legacy-duplicate-key' });
      const response = await admin.post('/admin/users').send({ name: 'Duplicate Key Target', api_key: 'legacy-duplicate-key' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('API key already exists');
    });

    it('should return 400 if name is missing', async () => {
      const response = await admin.post('/admin/users').send({ email: 'test@example.com' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/users').send({ name: 'User for Get' });
      userId = response.body.id;
    });

    it('should return a user by id', async () => {
      const response = await admin.get(`/admin/users/${userId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body).toHaveProperty('api_key');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await admin.get('/admin/users/99999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/users').send({ name: 'User for Update' });
      userId = response.body.id;
    });

    it('should update user', async () => {
      const response = await admin
        .put(`/admin/users/${userId}`)
        .send({ name: 'Updated Name', email: 'updated@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.email).toBe('updated@example.com');
    });

    it('should update user api key manually', async () => {
      const response = await admin
        .put(`/admin/users/${userId}`)
        .send({ api_key: 'legacy-updated-key-001' });

      expect(response.status).toBe(200);
      expect(response.body.api_key).toBe('legacy-updated-key-001');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await admin.put('/admin/users/99999').send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /admin/users/:id/regenerate-api-key', () => {
    let userId: number;
    let oldApiKey: string;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/users').send({ name: 'User for Key Regen' });
      userId = response.body.id;
      oldApiKey = response.body.api_key;
    });

    it('should regenerate API key', async () => {
      const response = await admin.post(`/admin/users/${userId}/regenerate-api-key`);
      
      expect(response.status).toBe(200);
      expect(response.body.api_key).toMatch(/^sk-/);
      expect(response.body.api_key).not.toBe(oldApiKey);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/users').send({ name: 'User for Delete' });
      userId = response.body.id;
    });

    it('should delete a user', async () => {
      const response = await admin.delete(`/admin/users/${userId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted user', async () => {
      const response = await admin.delete(`/admin/users/${userId}`);
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Admin API - Backend Management', () => {
  describe('GET /admin/backends', () => {
    it('should return empty array initially', async () => {
      const response = await admin.get('/admin/backends');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/backends', () => {
    it('should create a new backend', async () => {
      const backendData = { 
        name: 'Test Backend', 
        base_url: 'http://localhost:8000/v1',
        api_key: 'backend-key-123'
      };
      const response = await admin.post('/admin/backends').send(backendData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(backendData.name);
      expect(response.body.base_url).toBe(backendData.base_url);
      expect(response.body.api_key).toBe(backendData.api_key);
    });

    it('should return 400 if name or base_url is missing', async () => {
      const response = await admin.post('/admin/backends').send({ name: 'Test' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/backends').send({ 
        name: 'Backend for Get', 
        base_url: 'http://localhost:8001/v1' 
      });
      backendId = response.body.id;
    });

    it('should return a backend by id', async () => {
      const response = await admin.get(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(backendId);
    });

    it('should return 404 for non-existent backend', async () => {
      const response = await admin.get('/admin/backends/99999');
      
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/backends').send({ 
        name: 'Backend for Update', 
        base_url: 'http://localhost:8002/v1' 
      });
      backendId = response.body.id;
    });

    it('should update backend', async () => {
      const response = await admin
        .put(`/admin/backends/${backendId}`)
        .send({ name: 'Updated Backend', is_active: false });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Backend');
      expect(response.body.is_active).toBe(false);
      expect(response.body.model_cache_state).toBe('inactive');
    });

    it('should return 404 for non-existent backend', async () => {
      const response = await admin.put('/admin/backends/99999').send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await admin.post('/admin/backends').send({ 
        name: 'Backend for Delete', 
        base_url: 'http://localhost:8003/v1' 
      });
      backendId = response.body.id;
    });

    it('should delete a backend', async () => {
      const response = await admin.delete(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted backend', async () => {
      const response = await admin.delete(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('Backend model cache endpoints', () => {
    it('should expose backend cache details and allow manual refresh for active backends', async () => {
      const { server, port } = createMockBackend({
        modelsResponse: [{ id: 'admin-refresh-model', object: 'model' }],
      });

      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Backend Cache Admin Test',
        base_url: `http://localhost:${port}`,
      });
      const backendId = backendResponse.body.id;

      const beforeRefresh = await admin.get(`/admin/backends/${backendId}/models`);
      expect(beforeRefresh.status).toBe(200);
      expect(beforeRefresh.body.cache.state).toBe('uninitialized');

      const refreshResponse = await admin.post(`/admin/backends/${backendId}/models/refresh`);
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.models).toContain('admin-refresh-model');

      const cacheOverview = await admin.get('/admin/models/cache');
      expect(cacheOverview.status).toBe(200);
      expect(Array.isArray(cacheOverview.body.models)).toBe(true);

      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('should reject manual refresh for inactive backends', async () => {
      const backendResponse = await admin.post('/admin/backends').send({
        name: 'Inactive Refresh Reject',
        base_url: 'http://localhost:8041',
      });

      await admin.put(`/admin/backends/${backendResponse.body.id}`).send({ is_active: false });
      const refreshResponse = await admin.post(`/admin/backends/${backendResponse.body.id}/models/refresh`);
      expect(refreshResponse.status).toBe(409);
    });
  });
});

describe('Admin API - Model Rewrite Management', () => {
  it('should create, update, list, and delete model rewrite rules', async () => {
    const createResponse = await admin.post('/admin/model-rewrites').send({
      source_model: 'gpt-3.5-turbo-admin-test',
      target_model: 'gpt-3.5-admin-test',
      force: true,
      note: 'fallback alias',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.source_model).toBe('gpt-3.5-turbo-admin-test');
    expect(createResponse.body.force).toBe(true);

    const listResponse = await admin.get('/admin/model-rewrites');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.some((rule: any) => rule.source_model === 'gpt-3.5-turbo-admin-test')).toBe(true);

    const updateResponse = await admin.put(`/admin/model-rewrites/${createResponse.body.id}`).send({
      target_model: 'gpt-3.5-mini-admin-test',
      is_active: false,
      force: false,
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.target_model).toBe('gpt-3.5-mini-admin-test');
    expect(updateResponse.body.is_active).toBe(false);
    expect(updateResponse.body.force).toBe(false);

    const deleteResponse = await admin.delete(`/admin/model-rewrites/${createResponse.body.id}`);
    expect(deleteResponse.status).toBe(204);
  });
});

describe('Admin API - Permission Management', () => {
  let userId: number;
  let backendId: number;

  beforeAll(async () => {
    const userResponse = await admin.post('/admin/users').send({ name: 'User for Permission' });
    userId = userResponse.body.id;
    
    const backendResponse = await admin.post('/admin/backends').send({ 
      name: 'Backend for Permission', 
      base_url: 'http://localhost:8004/v1' 
    });
    backendId = backendResponse.body.id;
  });

  describe('GET /admin/permissions', () => {
    it('should return empty array initially', async () => {
      const response = await admin.get('/admin/permissions');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/permissions', () => {
    it('should create a new permission', async () => {
      const response = await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.user_id).toBe(userId);
      expect(response.body.backend_id).toBe(backendId);
    });

    it('should return 409 if permission already exists', async () => {
      const response = await admin
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });
      
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if user_id or backend_id is missing', async () => {
      const response = await admin.post('/admin/permissions').send({ user_id: userId });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /admin/permissions/user/:userId', () => {
    it('should return permissions for user', async () => {
      const response = await admin.get(`/admin/permissions/user/${userId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /admin/permissions/backend/:backendId', () => {
    it('should return permissions for backend', async () => {
      const response = await admin.get(`/admin/permissions/backend/${backendId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /admin/permissions', () => {
    it('should delete a permission', async () => {
      const response = await admin
        .delete(`/admin/permissions?user_id=${userId}&backend_id=${backendId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted permission', async () => {
      const response = await admin
        .delete(`/admin/permissions?user_id=${userId}&backend_id=${backendId}`);
      
      expect(response.status).toBe(404);
    });
  });
});
