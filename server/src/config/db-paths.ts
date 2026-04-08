import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './env';

/* ────────────────────────────────────────────────────────────────────────────
 * Schema files (the .sql sources baked into the repo)
 *
 * Resolved relative to *this module's URL* — counted in one place so the
 * other DB modules don't each carry their own `'..'/'..'/'..'/'database'`
 * path math. Anchoring on `import.meta.url` also means it doesn't care
 * whether we're running from src (tsx) or some future bundler output, as
 * long as this file's relative position to `<repo>/database/` is preserved.
 * ────────────────────────────────────────────────────────────────────────── */

const SCHEMA_DIR_URL = new URL('../../../database/', import.meta.url);

export function getSchemaPath(filename: string): string {
  return fileURLToPath(new URL(filename, SCHEMA_DIR_URL));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Runtime data directories (configurable via env.DB_DIR)
 * ────────────────────────────────────────────────────────────────────────── */

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
