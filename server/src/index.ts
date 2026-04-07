import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import dotenv from 'dotenv';

import adminRoutes from './routes/admin.js';
import adminAuthRoutes from './routes/admin-auth.js';
import apiRoutes from './routes/api.js';
import analyticsRoutes from './routes/analytics.js';
import { requireAdminAccess, requireSessionCsrf } from './utils/adminAuth.js';
import { getUtcTimestamp } from './utils/time.js';
import { ModelCatalogService } from './services/ModelCatalogService.js';

import type { AppEnv } from './types/hono.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPathCandidates = [
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];
const resolvedEnvPath = envPathCandidates.find((candidate) =>
  fs.existsSync(candidate),
);

dotenv.config({
  path: resolvedEnvPath,
  quiet: true,
});

const MAX_BODY_SIZE = 30 * 1024 * 1024; // 30mb

export function createApp(): OpenAPIHono<AppEnv> {
  void ModelCatalogService.initialize();
  const app = new OpenAPIHono<AppEnv>();

  const adminDistCandidates = [
    path.resolve(__dirname, '..', '..', '..', 'client', 'dist'),
    path.resolve(__dirname, '..', '..', '..', '..', 'client', 'dist'),
  ];
  const adminDistPath = adminDistCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
      ];

  app.use(
    '*',
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  app.use(
    '*',
    bodyLimit({
      maxSize: MAX_BODY_SIZE,
    }),
  );

  // Public admin auth endpoints
  app.route('/admin/auth', adminAuthRoutes);

  // Protected admin endpoints
  app.use('/admin/analytics/*', requireAdminAccess, requireSessionCsrf);
  app.route('/admin/analytics', analyticsRoutes);
  app.use('/admin/*', requireAdminAccess, requireSessionCsrf);
  app.route('/admin', adminRoutes);

  // Public v1 API
  app.route('/v1', apiRoutes);

  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: getUtcTimestamp() }),
  );

  // OpenAPI document + Swagger UI (admin-only)
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'adminSession', {
    type: 'apiKey',
    in: 'cookie',
    name: 'kyush_admin_session',
  });

  app.use('/admin/openapi.json', requireAdminAccess);
  app.doc('/admin/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Kyush LLM Router', version: '1.0.0' },
    servers: [{ url: '/' }],
  });

  app.use('/admin/docs', requireAdminAccess);
  app.get('/admin/docs', swaggerUI({ url: '/admin/openapi.json' }));

  // Static dashboard SPA
  if (adminDistPath) {
    const adminDistRel = path
      .relative(process.cwd(), adminDistPath)
      .replaceAll('\\', '/');
    app.use(
      '/dashboard/*',
      serveStatic({
        root: adminDistRel,
        rewriteRequestPath: (p) => p.replace(/^\/dashboard/, ''),
      }),
    );
    const indexHtml = (): string =>
      fs.readFileSync(path.join(adminDistPath, 'index.html'), 'utf8');
    app.get('/dashboard', (c) => c.html(indexHtml()));
    app.get('/dashboard/*', (c) => {
      // SPA fallback for routes without file extension
      if (path.extname(c.req.path)) {
        return c.notFound();
      }
      return c.html(indexHtml());
    });
  }

  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  return app;
}

const app = createApp();
export default app;
