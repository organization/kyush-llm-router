import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const CORE_DB_PATH = process.env.CORE_DB_PATH || path.join(process.cwd(), 'data', 'core.db');

// Ensure data directory exists
const dataDir = path.dirname(CORE_DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(CORE_DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

export default db;
