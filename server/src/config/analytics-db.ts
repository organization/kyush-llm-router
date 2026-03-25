import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDir, getAnalyticsDbPath } from './db-paths';

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
