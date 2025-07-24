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
function createDatabase() {
  const database = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  });

  // Enable foreign key constraints
  database.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrent access
  database.pragma('journal_mode = WAL');
  
  return database;
}

// @ts-ignore - Database export type issue with better-sqlite3
export const db = createDatabase();
export default db; 