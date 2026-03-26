import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDir, getCoreDbPath } from './db-paths';

let db: Database.Database;

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function runCoreMigrations(database: Database.Database): void {
  if (hasColumn(database, 'model_rewrites', 'force') === false) {
    database.exec('ALTER TABLE model_rewrites ADD COLUMN force BOOLEAN DEFAULT 0');
  }
}

export function getDb(): Database.Database {
  if (!db) {
    const coreDbPath = getCoreDbPath();
    ensureDir(path.dirname(coreDbPath));

    db = new Database(coreDbPath);
    db.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    runCoreMigrations(db);
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
  runCoreMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}
