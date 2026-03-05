import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const ANALYTICS_DB_PATH = process.env.ANALYTICS_DB_PATH || path.join(process.cwd(), 'data', 'analytics.db');

let db: Database.Database;

export function getAnalyticsDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(ANALYTICS_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(ANALYTICS_DB_PATH);
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
  
  const dataDir = path.dirname(ANALYTICS_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(ANALYTICS_DB_PATH);
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
