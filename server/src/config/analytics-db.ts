import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { ensureDir, getAnalyticsDbPath } from './db-paths';

const moduleDir = import.meta.dirname;

let db: Database.Database | undefined;

function loadSchema(database: Database.Database): void {
  const schemaPath = path.join(
    moduleDir,
    '..',
    '..',
    '..',
    'database',
    'analytics-schema.sql',
  );
  const schema = fs.readFileSync(schemaPath, 'utf-8');
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
