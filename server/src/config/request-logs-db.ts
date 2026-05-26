import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ensureDir, getRequestLogsDbPath, getRequestLogsDir } from './db-paths';
import { getLocalMonthKey } from '../utils/time';

const connections = new Map<string, Database.Database>();

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function initRequestLogsSchema(db: Database.Database): void {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'request-logs-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  if (hasColumn(db, 'request_logs', 'routed_model') === false) {
    db.exec('ALTER TABLE request_logs ADD COLUMN routed_model TEXT');
  }
}

function ensureRequestLogsIndexes(db: Database.Database): void {
  const existingIndexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'request_logs'").all() as Array<{ name: string }>;
  const indexNames = new Set(existingIndexes.map((idx) => idx.name));

  const indexes = [
    ['idx_request_logs_local_date_backend', 'CREATE INDEX IF NOT EXISTS idx_request_logs_local_date_backend ON request_logs(local_date, backend_id)'],
    ['idx_request_logs_completion_tokens', 'CREATE INDEX IF NOT EXISTS idx_request_logs_completion_tokens ON request_logs(completion_tokens)'],
  ];

  for (const [name, sql] of indexes) {
    if (!indexNames.has(name)) {
      db.exec(sql);
    }
  }
}

export function getRequestLogsDb(monthKey: string = getLocalMonthKey()): Database.Database {
  const existing = connections.get(monthKey);
  if (existing) {
    return existing;
  }

  const dbPath = getRequestLogsDbPath(monthKey);
  ensureDir(path.dirname(dbPath));

  const db = new Database(dbPath);
  initRequestLogsSchema(db);
  ensureRequestLogsIndexes(db);
  connections.set(monthKey, db);
  return db;
}

export function initRequestLogsDb(monthKey: string = getLocalMonthKey()): Database.Database {
  const existing = connections.get(monthKey);
  if (existing) {
    existing.close();
    connections.delete(monthKey);
  }

  return getRequestLogsDb(monthKey);
}

export function listRequestLogMonths(): string[] {
  const requestLogsDir = getRequestLogsDir();
  ensureDir(requestLogsDir);

  return fs
    .readdirSync(requestLogsDir)
    .map((entry) => /^request_logs_(\d{4}-\d{2})\.db$/.exec(entry)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));
}

export function closeRequestLogsDbs(): void {
  for (const db of connections.values()) {
    db.close();
  }
  connections.clear();
}
