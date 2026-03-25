import express from 'express';
import cors from 'cors';
import { initDb } from '../../src/config/database';
import { initAnalyticsDb } from '../../src/config/analytics-db';
import adminAuthRoutes from '../../src/routes/admin-auth';
import adminRoutes from '../../src/routes/admin';
import apiRoutes from '../../src/routes/api';
import analyticsRoutes from '../../src/routes/analytics';
import { initRequestLogsDb } from '../../src/config/request-logs-db';
import { getUtcTimestamp } from '../../src/utils/time';
import { requireAdminAccess, requireSessionCsrf } from '../../src/utils/adminAuth';

export function createTestApp() {
  // Initialize both databases
  initDb();
  initAnalyticsDb();
  initRequestLogsDb();
  
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  app.use('/admin/auth', adminAuthRoutes);
  app.use('/admin/analytics', requireAdminAccess, requireSessionCsrf, analyticsRoutes);
  app.use('/admin', requireAdminAccess, requireSessionCsrf, adminRoutes);
  app.use('/v1', apiRoutes);
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: getUtcTimestamp() });
  });
  
  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });
  
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  return app;
}
