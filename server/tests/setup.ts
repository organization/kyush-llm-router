import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

// Test database paths
const TEST_CORE_DB_PATH = path.join(__dirname, '..', 'data', 'test-core.db');
const TEST_ANALYTICS_DB_PATH = path.join(__dirname, '..', 'data', 'test-analytics.db');

// Set environment variables for test databases
process.env.CORE_DB_PATH = TEST_CORE_DB_PATH;
process.env.ANALYTICS_DB_PATH = TEST_ANALYTICS_DB_PATH;

// Clear test databases before all tests
beforeAll(() => {
  try {
    execSync(`rm -f "${TEST_CORE_DB_PATH}" "${TEST_ANALYTICS_DB_PATH}"`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors if files don't exist
  }
});

// Clean up after all tests
afterAll(() => {
  import('../src/config/database').then(({ closeDb }) => closeDb()).catch(() => {});
  import('../src/config/analytics-db').then(({ closeAnalyticsDb }) => closeAnalyticsDb()).catch(() => {});
  
  // Remove test databases
  try {
    execSync(`rm -f "${TEST_CORE_DB_PATH}" "${TEST_ANALYTICS_DB_PATH}"`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors
  }
});
