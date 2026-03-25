import { beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const workerId = process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || String(process.pid);
const TEST_DB_DIR = path.join(__dirname, '..', 'data', `test-db-${workerId}`);

process.env.DB_DIR = TEST_DB_DIR;
process.env.TZ = 'Asia/Seoul';

beforeAll(() => {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
});

afterAll(async () => {
  const [{ closeDb }, { closeAnalyticsDb }, { closeRequestLogsDbs }] = await Promise.all([
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
