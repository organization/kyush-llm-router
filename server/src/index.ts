import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import adminRoutes from './routes/admin';
import adminAuthRoutes from './routes/admin-auth';
import apiRoutes from './routes/api';
import analyticsRoutes from './routes/analytics';
import { requireAdminAccess, requireSessionCsrf } from './utils/adminAuth';
import { logger } from './utils/logger';
import { getUtcTimestamp } from './utils/time';

dotenv.config({
  quiet: true,
});

export function createServer(): Application {
  const app = express();

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:3002'];

  app.use(cors({
    origin: corsOrigins,
    credentials: true,
  }));
  app.use(express.json());

  app.use('/admin/auth', adminAuthRoutes);
  app.use('/admin/analytics', requireAdminAccess, requireSessionCsrf, analyticsRoutes);
  app.use('/admin', requireAdminAccess, requireSessionCsrf, adminRoutes);
  app.use('/v1', apiRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: getUtcTimestamp() });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

const app = createServer();
const PORT = process.env.SERVER_PORT || 3000;

// Only start server if this is the main module (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Admin API: http://localhost:${PORT}/admin`);
    logger.info(`OpenAI API: http://localhost:${PORT}/v1`);
  });
}

export default app;
