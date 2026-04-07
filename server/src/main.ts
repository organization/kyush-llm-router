import { serve } from '@hono/node-server';

import app from './index.js';
import { logger } from './utils/logger.js';

const PORT = Number(process.env.SERVER_PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Admin API: http://localhost:${PORT}/admin`);
    logger.info(`Admin UI: http://localhost:${PORT}/dashboard`);
    logger.info(`OpenAI API: http://localhost:${PORT}/v1`);
    logger.info(`API Docs: http://localhost:${PORT}/admin/docs`);
  },
);
