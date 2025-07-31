import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use DATABASE_PATH environment variable if provided, otherwise default to current behavior
const dbPath = process.env.DATABASE_PATH 
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'data', 'agrivex.db');

console.log(`📁 Database path: ${dbPath}`);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
}

// Create database connection
const database = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable foreign key constraints
database.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrent access
database.pragma('journal_mode = WAL');

// Export as any to avoid type naming issues during build
export const db = database as any;
export default database as any; 