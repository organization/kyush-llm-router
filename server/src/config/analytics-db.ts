import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { ensureDir, getAnalyticsDbPath } from './db-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

function loadSchema(database: Database.Database): void {
  const schemaPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'database',
    'analytics-schema.sql',
  );
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
}

export function getAnalyticsDb(): Database.Database {
  if (!db) {
    const analyticsDbPath = getAnalyticsDbPath();
    ensureDir(path.dirname(analyticsDbPath));

    db = new Database(analyticsDbPath);
    db.pragma('foreign_keys = ON');
    loadSchema(db);
  }
  return db;
}

export function initAnalyticsDb(): Database.Database {
  if (db) {
    db.close();
  }

  const analyticsDbPath = getAnalyticsDbPath();
  ensureDir(path.dirname(analyticsDbPath));

  db = new Database(analyticsDbPath);
  db.pragma('foreign_keys = ON');
  loadSchema(db);

  return db;
}

export function closeAnalyticsDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}
