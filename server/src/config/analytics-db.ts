import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { ensureDir, getAnalyticsDbPath, getSchemaPath } from './db-paths';

let db: Database.Database | undefined;

function loadSchema(database: Database.Database): void {
  const schema = fs.readFileSync(
    getSchemaPath('analytics-schema.sql'),
    'utf-8',
  );
  database.exec(schema);
}

function openDb(): Database.Database {
  const analyticsDbPath = getAnalyticsDbPath();
  ensureDir(path.dirname(analyticsDbPath));
  const handle = new Database(analyticsDbPath);
  handle.pragma('foreign_keys = ON');
  loadSchema(handle);
  return handle;
}

export function getAnalyticsDb(): Database.Database {
  db ??= openDb();
  return db;
}

export function initAnalyticsDb(): Database.Database {
  db?.close();
  db = openDb();
  return db;
}

export function closeAnalyticsDb(): void {
  db?.close();
  db = undefined;
}
