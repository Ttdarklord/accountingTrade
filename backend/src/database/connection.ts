import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'agrivex.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
export const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

export default db; 