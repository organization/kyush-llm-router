import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const CORE_DB_PATH = process.env.CORE_DB_PATH || path.join(process.cwd(), 'data', 'core.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(CORE_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(CORE_DB_PATH);
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
  
  const dataDir = path.dirname(CORE_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(CORE_DB_PATH);
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
