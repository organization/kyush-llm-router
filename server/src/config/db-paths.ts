import fs from 'fs';
import path from 'path';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'data');

export function getDbRootDir(): string {
  return process.env.DB_DIR || process.env.DB_PATH || DEFAULT_DB_DIR;
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

