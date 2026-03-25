import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDir, getCoreDbPath } from './db-paths';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const coreDbPath = getCoreDbPath();
    ensureDir(path.dirname(coreDbPath));

    db = new Database(coreDbPath);
    db.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }
  return db;
}

export function initDb(): Database.Database {
  // Close existing connection if any
  if (db) {
    db.close();
  }
  
  const coreDbPath = getCoreDbPath();
  ensureDir(path.dirname(coreDbPath));

  db = new Database(coreDbPath);
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}
