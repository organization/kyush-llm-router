import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';

import { initDb } from '../../src/config/database';
import { initAnalyticsDb } from '../../src/config/analytics-db';
import adminAuthRoutes from '../../src/routes/admin-auth';
import adminRoutes from '../../src/routes/admin';
import apiRoutes from '../../src/routes/api';
import analyticsRoutes from '../../src/routes/analytics';
import { initRequestLogsDb } from '../../src/config/request-logs-db';
import { getUtcTimestamp } from '../../src/utils/time';
import {
  requireAdminAccess,
  requireSessionCsrf,
} from '../../src/utils/adminAuth';
import { ModelCatalogService } from '../../src/services/ModelCatalogService';

import type { AppEnv } from '../../src/types/hono';

export function createTestApp(): OpenAPIHono<AppEnv> {
  initDb();
  initAnalyticsDb();
  initRequestLogsDb();
  ModelCatalogService.reset();
  void ModelCatalogService.initialize();

  const app = new OpenAPIHono<AppEnv>();

  app.use('*', cors());

  app.route('/admin/auth', adminAuthRoutes);
  app.use('/admin/analytics/*', requireAdminAccess, requireSessionCsrf);
  app.route('/admin/analytics', analyticsRoutes);
  app.use('/admin/*', requireAdminAccess, requireSessionCsrf);
  app.route('/admin', adminRoutes);
  app.route('/v1', apiRoutes);

  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: getUtcTimestamp() }),
  );

  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  app.onError((err, c) => {
    console.error('Error:', err.message);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  });

  return app;
}
