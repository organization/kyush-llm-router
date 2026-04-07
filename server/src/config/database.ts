import path from 'node:path';
import fs from 'node:fs';

import Database from 'better-sqlite3';

import { ensureDir, getCoreDbPath } from './db-paths';

// Node 20.11+ exposes import.meta.dirname directly — no fileURLToPath needed.
const moduleDir = import.meta.dirname;

// Lazy singleton — `getDb()` instantiates on first access, `closeDb()` resets
// it back to `undefined` so the next `getDb()` reopens a fresh handle.
let db: Database.Database | undefined;

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

function runCoreMigrations(database: Database.Database): void {
  if (hasColumn(database, 'model_rewrites', 'force') === false) {
    database.exec(
      'ALTER TABLE model_rewrites ADD COLUMN force BOOLEAN DEFAULT 0',
    );
  }
}

function loadSchema(database: Database.Database): void {
  const schemaPath = path.join(
    moduleDir,
    '..',
    '..',
    '..',
    'database',
    'schema.sql',
  );
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
}

function openDb(): Database.Database {
  const coreDbPath = getCoreDbPath();
  ensureDir(path.dirname(coreDbPath));

  const handle = new Database(coreDbPath);
  handle.pragma('foreign_keys = ON');
  loadSchema(handle);
  runCoreMigrations(handle);
  return handle;
}

export function getDb(): Database.Database {
  db ??= openDb();
  return db;
}

export function initDb(): Database.Database {
  db?.close();
  db = openDb();
  return db;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}
