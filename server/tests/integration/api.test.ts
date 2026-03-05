import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { initDb } from '../../src/config/database';

describe('Auth & Proxy API', () => {
  let app: ReturnType<typeof createTestApp>;
  let userApiKey: string;
  let backendId: number;

  beforeAll(() => {
    // Ensure DB is initialized
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    // Create a user
    const userResponse = await request(app).post('/admin/users').send({ name: 'Test User for API' });
    userApiKey = userResponse.body.api_key;
    
    // Create a backend
    const backendResponse = await request(app).post('/admin/backends').send({ 
      name: 'Backend for API Test', 
      base_url: 'http://localhost:8005/v1' 
    });
    backendId = backendResponse.body.id;
    
    // Grant permission
    await request(app)
      .post('/admin/permissions')
      .send({ user_id: userResponse.body.id, backend_id: backendId });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /v1/chat/completions without auth', () => {
    it('should return 401 without API key', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({ model: 'test', messages: [] });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with invalid API key', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', 'Bearer invalid-key')
        .send({ model: 'test', messages: [] });
      
      expect(response.status).toBe(401);
    });
  });

  describe('POST /v1/chat/completions with valid auth', () => {
    it('should return 502 when backend is unreachable (but auth passes)', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ 
          model: 'test-model', 
          messages: [{ role: 'user', content: 'Hello' }] 
        });
      
      // Should authenticate successfully but fail to connect to backend
      expect(response.status).toBe(502);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /v1/models without permission', () => {
    it('should return 403 for user without backend permission', async () => {
      // Create a user without permissions
      const userResponse = await request(app).post('/admin/users').send({ name: 'User Without Permission' });
      const invalidApiKey = userResponse.body.api_key;
      
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${invalidApiKey}`);
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Analytics Logging', () => {
    it('should log requests to analytics', async () => {
      // Make a request that will fail (backend unreachable) but should be logged
      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ 
          model: 'test-model', 
          messages: [{ role: 'user', content: 'Test message' }] 
        });
      
      // Check analytics
      const analyticsResponse = await request(app).get('/admin/analytics/requests?limit=10');
      
      expect(analyticsResponse.status).toBe(200);
      expect(Array.isArray(analyticsResponse.body)).toBe(true);
      
      // Find our logged request
      const loggedRequest = analyticsResponse.body.find((r: any) => 
        r.status_code === 502 && r.endpoint === '/v1/chat/completions'
      );
      
      expect(loggedRequest).toBeDefined();
    });
  });
});
