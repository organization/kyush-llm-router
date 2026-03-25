import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';

let app: ReturnType<typeof createTestApp>;

beforeAll(() => {
  app = createTestApp();
});

describe('Admin API - User Management', () => {
  describe('GET /admin/users', () => {
    it('should return empty array initially', async () => {
      const response = await request(app).get('/admin/users');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/users', () => {
    it('should create a new user', async () => {
      const userData = { name: 'Test User', email: 'test@example.com' };
      const response = await request(app).post('/admin/users').send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body).toHaveProperty('api_key');
      expect(response.body.api_key).toMatch(/^sk-/);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app).post('/admin/users').send({ email: 'test@example.com' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/users').send({ name: 'User for Get' });
      userId = response.body.id;
    });

    it('should return a user by id', async () => {
      const response = await request(app).get(`/admin/users/${userId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body).toHaveProperty('api_key');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/admin/users/99999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/users').send({ name: 'User for Update' });
      userId = response.body.id;
    });

    it('should update user', async () => {
      const response = await request(app)
        .put(`/admin/users/${userId}`)
        .send({ name: 'Updated Name', email: 'updated@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.email).toBe('updated@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).put('/admin/users/99999').send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /admin/users/:id/regenerate-api-key', () => {
    let userId: number;
    let oldApiKey: string;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/users').send({ name: 'User for Key Regen' });
      userId = response.body.id;
      oldApiKey = response.body.api_key;
    });

    it('should regenerate API key', async () => {
      const response = await request(app).post(`/admin/users/${userId}/regenerate-api-key`);
      
      expect(response.status).toBe(200);
      expect(response.body.api_key).toMatch(/^sk-/);
      expect(response.body.api_key).not.toBe(oldApiKey);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    let userId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/users').send({ name: 'User for Delete' });
      userId = response.body.id;
    });

    it('should delete a user', async () => {
      const response = await request(app).delete(`/admin/users/${userId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted user', async () => {
      const response = await request(app).delete(`/admin/users/${userId}`);
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Admin API - Backend Management', () => {
  describe('GET /admin/backends', () => {
    it('should return empty array initially', async () => {
      const response = await request(app).get('/admin/backends');
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
      const response = await request(app).post('/admin/backends').send(backendData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(backendData.name);
      expect(response.body.base_url).toBe(backendData.base_url);
      expect(response.body.api_key).toBe(backendData.api_key);
    });

    it('should return 400 if name or base_url is missing', async () => {
      const response = await request(app).post('/admin/backends').send({ name: 'Test' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/backends').send({ 
        name: 'Backend for Get', 
        base_url: 'http://localhost:8001/v1' 
      });
      backendId = response.body.id;
    });

    it('should return a backend by id', async () => {
      const response = await request(app).get(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(backendId);
    });

    it('should return 404 for non-existent backend', async () => {
      const response = await request(app).get('/admin/backends/99999');
      
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/backends').send({ 
        name: 'Backend for Update', 
        base_url: 'http://localhost:8002/v1' 
      });
      backendId = response.body.id;
    });

    it('should update backend', async () => {
      const response = await request(app)
        .put(`/admin/backends/${backendId}`)
        .send({ name: 'Updated Backend', is_active: false });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Backend');
      expect(response.body.is_active).toBe(false);
    });

    it('should return 404 for non-existent backend', async () => {
      const response = await request(app).put('/admin/backends/99999').send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin/backends/:id', () => {
    let backendId: number;
    
    beforeAll(async () => {
      const response = await request(app).post('/admin/backends').send({ 
        name: 'Backend for Delete', 
        base_url: 'http://localhost:8003/v1' 
      });
      backendId = response.body.id;
    });

    it('should delete a backend', async () => {
      const response = await request(app).delete(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted backend', async () => {
      const response = await request(app).delete(`/admin/backends/${backendId}`);
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Admin API - Permission Management', () => {
  let userId: number;
  let backendId: number;

  beforeAll(async () => {
    const userResponse = await request(app).post('/admin/users').send({ name: 'User for Permission' });
    userId = userResponse.body.id;
    
    const backendResponse = await request(app).post('/admin/backends').send({ 
      name: 'Backend for Permission', 
      base_url: 'http://localhost:8004/v1' 
    });
    backendId = backendResponse.body.id;
  });

  describe('GET /admin/permissions', () => {
    it('should return empty array initially', async () => {
      const response = await request(app).get('/admin/permissions');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /admin/permissions', () => {
    it('should create a new permission', async () => {
      const response = await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.user_id).toBe(userId);
      expect(response.body.backend_id).toBe(backendId);
    });

    it('should return 409 if permission already exists', async () => {
      const response = await request(app)
        .post('/admin/permissions')
        .send({ user_id: userId, backend_id: backendId });
      
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if user_id or backend_id is missing', async () => {
      const response = await request(app).post('/admin/permissions').send({ user_id: userId });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /admin/permissions/user/:userId', () => {
    it('should return permissions for user', async () => {
      const response = await request(app).get(`/admin/permissions/user/${userId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /admin/permissions/backend/:backendId', () => {
    it('should return permissions for backend', async () => {
      const response = await request(app).get(`/admin/permissions/backend/${backendId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /admin/permissions', () => {
    it('should delete a permission', async () => {
      const response = await request(app)
        .delete(`/admin/permissions?user_id=${userId}&backend_id=${backendId}`);
      
      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted permission', async () => {
      const response = await request(app)
        .delete(`/admin/permissions?user_id=${userId}&backend_id=${backendId}`);
      
      expect(response.status).toBe(404);
    });
  });
});
