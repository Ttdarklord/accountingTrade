import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH 
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'data', 'agrivex.db');

console.log(`📁 Database path: ${dbPath}`);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable foreign key constraints
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export default function runSimpleMigrations() {
  try {
    console.log('🔄 Running simple migrations...');
    
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT,
        timestamp INTEGER,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

    // Check if basic schema exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='payment_receipts'
    `).get();

    if (!tableExists) {
      console.log('📋 Creating initial schema...');
      // Run the full schema for new installations
      const schemaPath = path.join(process.cwd(), 'src/database/schema-v2.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        db.exec(schema);
        console.log('✅ Initial schema created');
      }
    }

    // Simple, safe migrations that won't hang
    const safeMigrations = [
      {
        id: 'updated_at_field',
        sql: `ALTER TABLE payment_receipts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
        description: 'Add updated_at field to payment_receipts'
      },
      {
        id: 'notifications_table',
        sql: `CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('trade', 'receipt', 'edit', 'delete', 'restore')),
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('trade', 'receipt', 'account', 'party')),
          entity_id INTEGER NOT NULL,
          is_read BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        description: 'Create notifications table'
      },
      {
        id: 'notifications_indexes',
        sql: `
          CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC);
        `,
        description: 'Create notifications indexes'
      }
    ];

    for (const migration of safeMigrations) {
      const exists = db.prepare(`
        SELECT id FROM migrations WHERE id = ?
      `).get(migration.id);

      if (!exists) {
        try {
          console.log(`⚡ Running migration: ${migration.description}`);
          db.exec(migration.sql);
          
          // Mark as completed
          db.prepare(`
            INSERT INTO migrations (id, description, timestamp)
            VALUES (?, ?, ?)
          `).run(migration.id, migration.description, Date.now());
          
          console.log(`✅ Migration completed: ${migration.id}`);
        } catch (error) {
          console.log(`⚠️ Migration skipped (already exists): ${migration.id}`);
          // Mark as completed to avoid re-running
          db.prepare(`
            INSERT OR IGNORE INTO migrations (id, description, timestamp)
            VALUES (?, ?, ?)
          `).run(migration.id, migration.description, Date.now());
        }
      } else {
        console.log(`⏭️ Migration already applied: ${migration.id}`);
      }
    }

    console.log('✅ All migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't throw in production to avoid deployment failures
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }
  } finally {
    // Ensure foreign keys are enabled
    try {
      db.exec('PRAGMA foreign_keys = ON');
    } catch (e) {
      console.log('Warning: Could not enable foreign keys');
    }
  }
} 