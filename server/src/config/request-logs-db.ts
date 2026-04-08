import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import {
  ensureDir,
  getRequestLogsDbPath,
  getRequestLogsDir,
  getSchemaPath,
} from './db-paths';

import { getLocalMonthKey } from '../utils/time';

const connections = new Map<string, Database.Database>();

function isPragmaColumnRow(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as { name: unknown }).name === 'string'
  );
}

function hasColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some(
    (column) => isPragmaColumnRow(column) && column.name === columnName,
  );
}

function initRequestLogsSchema(db: Database.Database): void {
  const schema = fs.readFileSync(
    getSchemaPath('request-logs-schema.sql'),
    'utf-8',
  );
  db.exec(schema);
  if (!hasColumn(db, 'request_logs', 'routed_model')) {
    db.exec('ALTER TABLE request_logs ADD COLUMN routed_model TEXT');
  }
}

export function getRequestLogsDb(
  monthKey: string = getLocalMonthKey(),
): Database.Database {
  const existing = connections.get(monthKey);
  if (existing) return existing;

  const dbPath = getRequestLogsDbPath(monthKey);
  ensureDir(path.dirname(dbPath));

  const db = new Database(dbPath);
  initRequestLogsSchema(db);
  connections.set(monthKey, db);
  return db;
}

export function initRequestLogsDb(
  monthKey: string = getLocalMonthKey(),
): Database.Database {
  connections.get(monthKey)?.close();
  connections.delete(monthKey);
  return getRequestLogsDb(monthKey);
}

const REQUEST_LOG_FILENAME_PATTERN = /^request_logs_(\d{4}-\d{2})\.db$/;

export function listRequestLogMonths(): string[] {
  const requestLogsDir = getRequestLogsDir();
  ensureDir(requestLogsDir);

  return fs
    .readdirSync(requestLogsDir)
    .map((entry) => REQUEST_LOG_FILENAME_PATTERN.exec(entry)?.[1])
    .filter((value): value is string => value !== undefined)
    .sort((a, b) => b.localeCompare(a));
}

export function closeRequestLogsDbs(): void {
  for (const db of connections.values()) {
    db.close();
  }
  connections.clear();
}
