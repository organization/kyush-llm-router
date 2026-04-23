import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../utils/testApp';
import { initDb } from '../../src/config/database';
import { RequestLogService } from '../../src/services/RequestLogService';
import { AnalyticsService } from '../../src/services/AnalyticsService';
import { createAdminClient } from '../utils/adminClient';
import { getLocalDateKey, getUtcTimestamp } from '../../src/utils/time';

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

    it('should expose chart-friendly analytics endpoints', async () => {
      const primaryDate = getLocalDateKey();
      const secondarySourceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const secondaryDate = getLocalDateKey(secondarySourceDate);

      AnalyticsService.logRequest({
        user_id: 7001,
        backend_id: backendId,
        endpoint: '/v1/chat/completions',
        request_model: 'gpt-4o-mini',
        routed_model: 'gpt-4o-mini',
        response_model: 'gpt-4o-mini',
        completion_tokens: 120,
        total_tokens: 240,
        response_time_ms: 380,
        status_code: 200,
        local_date: primaryDate,
        created_at: getUtcTimestamp(),
      });

      AnalyticsService.logRequest({
        user_id: 7002,
        backend_id: backendId,
        endpoint: '/v1/chat/completions',
        request_model: 'gpt-4.1-mini',
        routed_model: 'gpt-4.1-mini',
        response_model: 'gpt-4.1-mini',
        completion_tokens: 60,
        total_tokens: 190,
        response_time_ms: 510,
        status_code: 500,
        error_message: 'synthetic-error',
        local_date: secondaryDate,
        created_at: getUtcTimestamp(secondarySourceDate),
      });

      const [dailyTotals, backendQuality, modelTrends, histogram, boxPlot] = await Promise.all([
        admin.get(`/admin/analytics/daily-totals?backendId=${backendId}&days=30`),
        admin.get(`/admin/analytics/backend-quality?backendId=${backendId}&days=30`),
        admin.get(`/admin/analytics/model-trends?backendId=${backendId}&days=30&limit=8`),
        admin.get(`/admin/analytics/response-length-histogram?backendId=${backendId}&days=30&bins=6`),
        admin.get(`/admin/analytics/response-length-box-plot?backendId=${backendId}&days=30`),
      ]);

      expect(dailyTotals.status).toBe(200);
      expect(Array.isArray(dailyTotals.body)).toBe(true);
      expect(dailyTotals.body.some((row: any) => row.total_requests >= 1 && typeof row.total_tokens === 'number')).toBe(true);

      expect(backendQuality.status).toBe(200);
      expect(Array.isArray(backendQuality.body)).toBe(true);
      expect(backendQuality.body.some((row: any) => row.backend_id === backendId && typeof row.error_count === 'number')).toBe(true);

      expect(modelTrends.status).toBe(200);
      expect(Array.isArray(modelTrends.body)).toBe(true);
      expect(modelTrends.body.some((row: any) => row.model === 'gpt-4o-mini')).toBe(true);

      expect(histogram.status).toBe(200);
      expect(Array.isArray(histogram.body)).toBe(true);
      expect(histogram.body.every((row: any) => typeof row.count === 'number')).toBe(true);

      expect(boxPlot.status).toBe(200);
      expect(Array.isArray(boxPlot.body)).toBe(true);
      expect(boxPlot.body.some((row: any) => row.date === primaryDate && row.median === 120)).toBe(true);
    });

    it('should expose dashboard summary data for the ops cockpit', async () => {
      const response = await admin.get('/admin/dashboard/summary?days=30');

      expect(response.status).toBe(200);
      expect(response.body.window_days).toBe(30);
      expect(response.body.overview.total_users).toBeGreaterThanOrEqual(1);
      expect(response.body.overview.total_backends).toBeGreaterThanOrEqual(1);
      expect(response.body.overview.total_permissions).toBeGreaterThanOrEqual(1);
      expect(response.body.overview.total_scripts).toBeGreaterThanOrEqual(0);
      expect(response.body.health.public_health.status).toBe('ok');
      expect(response.body.health.admin_health.status).toBe('ok');
      expect(Array.isArray(response.body.series.daily_totals)).toBe(true);
      expect(Array.isArray(response.body.series.backend_quality)).toBe(true);
      expect(Array.isArray(response.body.series.model_trends)).toBe(true);
      expect(typeof response.body.logging.users_with_detail_logging).toBe('number');
      expect(typeof response.body.access.users_without_permissions).toBe('number');
    });

    it('should keep dashboard summary stable for empty datasets', async () => {
      const emptyUser = await admin.post('/admin/users').send({ name: 'Dashboard Empty User' });
      const emptyBackend = await admin.post('/admin/backends').send({
        name: 'Dashboard Empty Backend',
        base_url: 'http://localhost:8999/v1',
      });

      const response = await admin.get('/admin/dashboard/summary?days=7');

      expect(response.status).toBe(200);
      expect(response.body.window_days).toBe(7);
      expect(response.body.overview.total_users).toBeGreaterThanOrEqual(2);
      expect(response.body.overview.total_backends).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(response.body.health.stale_backends)).toBe(true);
      expect(response.body.health.cache_state_counts.uninitialized).toBeGreaterThanOrEqual(1);
      expect(response.body.access.users_without_permissions).toBeGreaterThanOrEqual(1);

      await admin.delete(`/admin/users/${emptyUser.body.id}`);
      await admin.delete(`/admin/backends/${emptyBackend.body.id}`);
    });
  });
});
