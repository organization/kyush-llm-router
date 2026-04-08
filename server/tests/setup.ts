import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll } from 'vitest';

const moduleDir = import.meta.dirname;

const workerId =
  process.env.VITEST_POOL_ID ||
  process.env.VITEST_WORKER_ID ||
  String(process.pid);
const TEST_DB_DIR = path.join(moduleDir, '..', 'data', `test-db-${workerId}`);

process.env.DB_DIR = TEST_DB_DIR;
process.env.TZ = 'Asia/Seoul';
process.env.ADMIN_AUTH_MODE = 'env';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD_HASH =
  'sha256$5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret';
process.env.ADMIN_SESSION_TTL_HOURS = '12';

beforeAll(() => {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
});

afterAll(async () => {
  const [{ closeDb }, { closeAnalyticsDb }, { closeRequestLogsDbs }] =
    await Promise.all([
      import('../src/config/database'),
      import('../src/config/analytics-db'),
      import('../src/config/request-logs-db'),
    ]);

  closeDb();
  closeAnalyticsDb();
  closeRequestLogsDbs();

  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
});
