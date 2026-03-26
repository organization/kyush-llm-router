import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { initDb } from '../../src/config/database';
import { RequestLogService } from '../../src/services/RequestLogService';
import { createAdminClient } from '../utils/adminClient';

describe('Auth & Proxy API', () => {
  let app: ReturnType<typeof createTestApp>;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let userApiKey: string;
  let backendId: number;

  beforeAll(() => {
    // Ensure DB is initialized
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);
  });

  beforeAll(async () => {
    // Create a user
    const userResponse = await admin.post('/admin/users').send({ name: 'Test User for API' });
    userApiKey = userResponse.body.api_key;
    
    // Create a backend
    const backendResponse = await admin.post('/admin/backends').send({ 
      name: 'Backend for API Test', 
      base_url: 'http://localhost:8005/v1' 
    });
    backendId = backendResponse.body.id;
    
    // Grant permission
    await admin
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
    it('should return 404 when model catalog cannot confirm the requested model', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userApiKey}`)
        .send({ 
          model: 'test-model', 
          messages: [{ role: 'user', content: 'Hello' }] 
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('request_model', 'test-model');
    });
  });

  describe('GET /v1/models without permission', () => {
    it('should return 403 for user without backend permission', async () => {
      // Create a user without permissions
      const userResponse = await admin.post('/admin/users').send({ name: 'User Without Permission' });
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
      const analyticsResponse = await admin.get('/admin/analytics/requests?limit=10');
      
      expect(analyticsResponse.status).toBe(200);
      expect(Array.isArray(analyticsResponse.body.rows)).toBe(true);
      expect(typeof analyticsResponse.body.total).toBe('number');
      
      // Find our logged request
      const loggedRequest = analyticsResponse.body.rows.find((r: any) => 
        r.status_code === 404 && r.endpoint === '/v1/chat/completions'
      );
      
      expect(loggedRequest).toBeDefined();
    });

    it('should paginate across months when month/date are not specified', async () => {
      RequestLogService.logRequest({
        user_id: 9991,
        backend_id: 9991,
        endpoint: '/v1/chat/completions',
        request_model: 'cross-month-test-model',
        status_code: 200,
        detail_logged: false,
        error_message: 'cross-month-test-marker',
        local_date: '2026-02-20',
        created_at: '2026-02-20T10:00:00.000Z',
      });

      RequestLogService.logRequest({
        user_id: 9992,
        backend_id: 9992,
        endpoint: '/v1/chat/completions',
        request_model: 'cross-month-test-model',
        status_code: 200,
        detail_logged: false,
        error_message: 'cross-month-test-marker',
        local_date: '2026-03-20',
        created_at: '2026-03-20T10:00:00.000Z',
      });

      const firstPage = await admin.get('/admin/analytics/requests?limit=1&offset=0&q=cross-month-test-marker');
      const secondPage = await admin.get('/admin/analytics/requests?limit=1&offset=1&q=cross-month-test-marker');

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      expect(firstPage.body.total).toBe(2);
      expect(secondPage.body.total).toBe(2);
      expect(firstPage.body.rows[0].user_id).toBe(9992);
      expect(secondPage.body.rows[0].user_id).toBe(9991);
    });
  });
});
