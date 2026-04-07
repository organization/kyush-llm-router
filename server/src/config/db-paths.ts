import fs from 'node:fs';
import path from 'node:path';

import { env } from './env.js';

export function getDbRootDir(): string {
  return env.DB_DIR;
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getCoreDbPath(): string {
  return path.join(getDbRootDir(), 'core.db');
}

export function getAnalyticsDbPath(): string {
  return path.join(getDbRootDir(), 'analytics.db');
}

export function getRequestLogsDir(): string {
  return path.join(getDbRootDir(), 'request_logs');
}

export function getRequestLogsDbPath(monthKey: string): string {
  return path.join(getRequestLogsDir(), `request_logs_${monthKey}.db`);
}
