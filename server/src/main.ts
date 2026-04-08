import { serve } from '@hono/node-server';

import { env } from './config/env';
import app from './index';
import { logger } from './utils/logger';

serve(
  {
    fetch: app.fetch,
    port: env.SERVER_PORT,
  },
  () => {
    logger.info(`Server running on port ${env.SERVER_PORT}`);
    logger.info(`Admin API: http://localhost:${env.SERVER_PORT}/admin`);
    logger.info(`Admin UI: http://localhost:${env.SERVER_PORT}/dashboard`);
    logger.info(`OpenAI API: http://localhost:${env.SERVER_PORT}/v1`);
    logger.info(`API Docs: http://localhost:${env.SERVER_PORT}/admin/docs`);
  },
);
