import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDir, getAnalyticsDbPath } from './db-paths';

function hasIndex(database: Database.Database, tableName: string, indexName: string): boolean {
  const result = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?`).get(tableName, indexName) as { name: string } | undefined;
  return Boolean(result);
}

function ensureAnalyticsIndexes(db: Database.Database): void {
  const indexes: Array<{ name: string; table: string; sql: string }> = [
    { name: 'idx_usage_stats_backend_date', table: 'usage_stats', sql: 'CREATE INDEX IF NOT EXISTS idx_usage_stats_backend_date ON usage_stats(backend_id, date)' },
    { name: 'idx_usage_stats_user_backend_date', table: 'usage_stats', sql: 'CREATE INDEX IF NOT EXISTS idx_usage_stats_user_backend_date ON usage_stats(user_id, backend_id, date)' },
    { name: 'idx_backend_metrics_backend_date', table: 'backend_metrics', sql: 'CREATE INDEX IF NOT EXISTS idx_backend_metrics_backend_date ON backend_metrics(backend_id, date)' },
  ];

  for (const { name, table, sql } of indexes) {
    if (!hasIndex(db, table, name)) {
      db.exec(sql);
    }
  }
}

let db: Database.Database;

export function getAnalyticsDb(): Database.Database {
  if (!db) {
    const analyticsDbPath = getAnalyticsDbPath();
    ensureDir(path.dirname(analyticsDbPath));

    db = new Database(analyticsDbPath);
    db.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'analytics-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    ensureAnalyticsIndexes(db);
  }
  return db;
}

export function initAnalyticsDb(): Database.Database {
  // Close existing connection if any
  if (db) {
    db.close();
  }
  
  const analyticsDbPath = getAnalyticsDbPath();
  ensureDir(path.dirname(analyticsDbPath));

  db = new Database(analyticsDbPath);
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'analytics-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

export function closeAnalyticsDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}
