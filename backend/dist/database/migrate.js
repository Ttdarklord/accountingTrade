"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = __importDefault(require("./connection"));
const migrations = [
    {
        id: 'counterpart_schema_v2',
        description: 'Update to counterpart-based accounting schema',
        timestamp: Date.now() - 86400000 // Yesterday
    },
    {
        id: 'aed_receipts_support',
        description: 'Add support for AED receipts with additional fields',
        timestamp: Date.now()
    },
    {
        id: 'receipt_soft_deletion',
        description: 'Add soft deletion and audit fields to payment_receipts',
        timestamp: Date.now() + 3600000 // In the future to run after others
    },
    {
        id: 'trade_settlement_tracking',
        description: 'Add settlement tracking fields to trades and create trade_settlements table',
        timestamp: Date.now() + 7200000 // After soft deletion migration
    },
    {
        id: 'credit_application_support',
        description: 'Add credit application support to trade_settlements table',
        timestamp: Date.now() + 10800000 // After settlement tracking migration
    }
];
function hasMigrationRun(migration) {
    try {
        const result = connection_1.default.prepare('SELECT id FROM migrations WHERE id = ?').get(migration.id);
        return !!result;
    }
    catch (error) {
        // Table doesn't exist yet, create it
        connection_1.default.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        return false;
    }
}
function markMigrationCompleted(migration) {
    connection_1.default.prepare('INSERT INTO migrations (id, description, timestamp) VALUES (?, ?, ?)').run(migration.id, migration.description, migration.timestamp);
}
function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        connection_1.default.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT,
        timestamp INTEGER,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Disable foreign key constraints during migration
        connection_1.default.exec('PRAGMA foreign_keys = OFF');
        const counterpartMigration = migrations[0];
        const aedReceiptsMigration = migrations[1];
        // Run counterpart schema migration
        if (!hasMigrationRun(counterpartMigration)) {
            console.log('Running counterpart schema migration...');
            // First, backup existing data if any
            let existingAccounts = [];
            let existingReceipts = [];
            try {
                existingAccounts = connection_1.default.prepare('SELECT * FROM bank_accounts').all();
                existingReceipts = connection_1.default.prepare('SELECT * FROM payment_receipts').all();
            }
            catch (e) {
                // Tables might not exist yet, that's okay
                console.log('No existing data found to backup');
            }
            // Drop and recreate with new schema
            const schemaV2Path = path_1.default.join(__dirname, 'schema-v2.sql');
            const schemaV2 = fs_1.default.readFileSync(schemaV2Path, 'utf-8');
            // Start transaction for migration
            connection_1.default.exec('BEGIN TRANSACTION');
            try {
                // Drop old tables that need to be recreated (order matters for foreign keys)
                connection_1.default.exec('DROP TABLE IF EXISTS payment_receipts');
                connection_1.default.exec('DROP TABLE IF EXISTS bank_accounts');
                connection_1.default.exec('DROP INDEX IF EXISTS idx_payment_receipts_tracking');
                // Create new tables from v2 schema
                console.log('Creating new schema from schema-v2.sql...');
                // Execute the entire schema file at once to handle dependencies properly
                connection_1.default.exec(schemaV2);
                console.log('✅ New schema created successfully');
                console.log('⚠️  Note: Bank accounts and receipts need to be re-created with counterpart assignments');
                connection_1.default.exec('COMMIT');
                markMigrationCompleted(counterpartMigration);
                console.log('Counterpart schema migration completed');
            }
            catch (error) {
                connection_1.default.exec('ROLLBACK');
                throw error;
            }
        }
        // Run AED receipts migration (skip if payment_receipts table already has the columns)
        if (!hasMigrationRun(aedReceiptsMigration)) {
            console.log('Running AED receipts support migration...');
            connection_1.default.exec('BEGIN TRANSACTION');
            try {
                // Check if table exists and get its structure
                let tableInfo = [];
                try {
                    tableInfo = connection_1.default.prepare("PRAGMA table_info(payment_receipts)").all();
                }
                catch (e) {
                    console.log('payment_receipts table does not exist yet, will be created by schema');
                    connection_1.default.exec('COMMIT');
                    markMigrationCompleted(aedReceiptsMigration);
                    return;
                }
                const existingColumns = tableInfo.map(col => col.name);
                const newColumns = [
                    { name: 'currency', definition: 'TEXT NOT NULL DEFAULT \'TOMAN\' CHECK(currency IN (\'AED\', \'TOMAN\'))' },
                    { name: 'receipt_type', definition: 'TEXT CHECK(receipt_type IN (\'pay\', \'receive\'))' },
                    { name: 'trading_party_id', definition: 'INTEGER REFERENCES trading_parties(id)' },
                    { name: 'individual_name', definition: 'TEXT' }
                ];
                // Add missing columns
                for (const column of newColumns) {
                    if (!existingColumns.includes(column.name)) {
                        console.log(`Adding column: ${column.name}`);
                        connection_1.default.exec(`ALTER TABLE payment_receipts ADD COLUMN ${column.name} ${column.definition}`);
                    }
                    else {
                        console.log(`Column ${column.name} already exists, skipping`);
                    }
                }
                // Make payer_id and receiver_account_id nullable for AED receipts
                // SQLite doesn't support modifying column constraints directly, so we'll handle this in application logic
                connection_1.default.exec('COMMIT');
                markMigrationCompleted(aedReceiptsMigration);
                console.log('✅ AED receipts support migration completed');
            }
            catch (error) {
                connection_1.default.exec('ROLLBACK');
                throw error;
            }
        }
        // Run soft deletion migration
        const softDeletionMigration = migrations[2];
        if (!hasMigrationRun(softDeletionMigration)) {
            console.log('Running soft deletion fields migration...');
            connection_1.default.exec('BEGIN TRANSACTION');
            try {
                // Check if table exists and get its structure
                let tableInfo = [];
                try {
                    tableInfo = connection_1.default.prepare("PRAGMA table_info(payment_receipts)").all();
                }
                catch (e) {
                    console.log('payment_receipts table does not exist yet, will be created by schema');
                    connection_1.default.exec('COMMIT');
                    markMigrationCompleted(softDeletionMigration);
                    return;
                }
                const existingColumns = tableInfo.map(col => col.name);
                const softDeletionColumns = [
                    { name: 'is_deleted', definition: 'BOOLEAN DEFAULT 0' },
                    { name: 'deleted_at', definition: 'DATETIME' },
                    { name: 'deletion_reason', definition: 'TEXT' },
                    { name: 'deletion_reason_category', definition: 'TEXT CHECK(deletion_reason_category IN (\'duplicate\', \'funds_returned\', \'receipt_not_landed\', \'data_error\', \'other\'))' },
                    { name: 'deleted_by', definition: 'TEXT' },
                    { name: 'is_restored', definition: 'BOOLEAN DEFAULT 0' },
                    { name: 'restored_at', definition: 'DATETIME' },
                    { name: 'restoration_reason', definition: 'TEXT' },
                    { name: 'restored_by', definition: 'TEXT' }
                ];
                // Add missing columns
                for (const column of softDeletionColumns) {
                    if (!existingColumns.includes(column.name)) {
                        console.log(`Adding soft deletion column: ${column.name}`);
                        connection_1.default.exec(`ALTER TABLE payment_receipts ADD COLUMN ${column.name} ${column.definition}`);
                    }
                    else {
                        console.log(`Column ${column.name} already exists, skipping`);
                    }
                }
                connection_1.default.exec('COMMIT');
                markMigrationCompleted(softDeletionMigration);
                console.log('✅ Soft deletion fields migration completed');
            }
            catch (error) {
                connection_1.default.exec('ROLLBACK');
                throw error;
            }
        }
        // Run trade settlement tracking migration
        const settlementMigration = migrations[3];
        if (!hasMigrationRun(settlementMigration)) {
            console.log('Running trade settlement tracking migration...');
            connection_1.default.exec('BEGIN TRANSACTION');
            try {
                // Check if trades table has settlement tracking columns
                let tradesTableInfo = [];
                try {
                    tradesTableInfo = connection_1.default.prepare("PRAGMA table_info(trades)").all();
                }
                catch (e) {
                    console.log('trades table does not exist yet, will be created by schema');
                    connection_1.default.exec('COMMIT');
                    markMigrationCompleted(settlementMigration);
                    return;
                }
                const existingColumns = tradesTableInfo.map(col => col.name);
                const settlementColumns = [
                    { name: 'base_settled_amount', definition: 'DECIMAL(15, 2) NOT NULL DEFAULT 0' },
                    { name: 'quote_settled_amount', definition: 'DECIMAL(15, 2) NOT NULL DEFAULT 0' },
                    { name: 'is_base_fully_settled', definition: 'BOOLEAN DEFAULT 0' },
                    { name: 'is_quote_fully_settled', definition: 'BOOLEAN DEFAULT 0' },
                    { name: 'last_settlement_date', definition: 'DATE' }
                ];
                // Add missing settlement tracking columns to trades table
                for (const column of settlementColumns) {
                    if (!existingColumns.includes(column.name)) {
                        console.log(`Adding settlement column: ${column.name}`);
                        connection_1.default.exec(`ALTER TABLE trades ADD COLUMN ${column.name} ${column.definition}`);
                    }
                    else {
                        console.log(`Settlement column ${column.name} already exists, skipping`);
                    }
                }
                // Create trade_settlements table if it doesn't exist
                const settlementTableExists = connection_1.default.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='trade_settlements'
        `).get();
                if (!settlementTableExists) {
                    console.log('Creating trade_settlements table...');
                    connection_1.default.exec(`
            CREATE TABLE IF NOT EXISTS trade_settlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id INTEGER NOT NULL,
                receipt_id INTEGER NOT NULL,
                currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
                settled_amount DECIMAL(15, 2) NOT NULL,
                settlement_type TEXT NOT NULL CHECK(settlement_type IN ('BASE', 'QUOTE')),
                settlement_date DATE NOT NULL,
                fifo_sequence INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (trade_id) REFERENCES trades(id),
                FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id),
                
                UNIQUE(trade_id, receipt_id, settlement_type)
            )
          `);
                }
                else {
                    console.log('trade_settlements table already exists, skipping');
                }
                connection_1.default.exec('COMMIT');
                markMigrationCompleted(settlementMigration);
                console.log('✅ Trade settlement tracking migration completed');
            }
            catch (error) {
                connection_1.default.exec('ROLLBACK');
                throw error;
            }
        }
        // Run credit application support migration
        const creditMigration = migrations[4];
        if (!hasMigrationRun(creditMigration)) {
            console.log('Running credit application support migration...');
            connection_1.default.exec('BEGIN TRANSACTION');
            try {
                // Make receipt_id nullable for credit applications
                connection_1.default.exec(`
          CREATE TABLE IF NOT EXISTS trade_settlements_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_id INTEGER NOT NULL,
            receipt_id INTEGER, -- Made nullable for credit applications
            currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
            settled_amount DECIMAL(15, 2) NOT NULL,
            settlement_type TEXT NOT NULL CHECK(settlement_type IN ('BASE', 'QUOTE')),
            settlement_date DATE NOT NULL,
            fifo_sequence INTEGER NOT NULL,
            is_credit_application BOOLEAN DEFAULT 0, -- Flag for credit applications
            counterpart_balance_id INTEGER, -- Reference to the counterpart balance used
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (trade_id) REFERENCES trades(id),
            FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id),
            FOREIGN KEY (counterpart_balance_id) REFERENCES counterpart_balances(id),
            
            -- Modified unique constraint to allow multiple credit applications per trade
            UNIQUE(trade_id, receipt_id, settlement_type)
          )
        `);
                // Copy existing data
                const existingData = connection_1.default.prepare('SELECT COUNT(*) as count FROM trade_settlements').get();
                if (existingData.count > 0) {
                    console.log(`Migrating ${existingData.count} existing settlement records...`);
                    connection_1.default.exec(`
            INSERT INTO trade_settlements_new (
              id, trade_id, receipt_id, currency, settled_amount, settlement_type, 
              settlement_date, fifo_sequence, is_credit_application, created_at
            )
            SELECT 
              id, trade_id, receipt_id, currency, settled_amount, settlement_type,
              settlement_date, fifo_sequence, 0, created_at
            FROM trade_settlements
          `);
                }
                // Drop old table and rename new one
                connection_1.default.exec('DROP TABLE IF EXISTS trade_settlements');
                connection_1.default.exec('ALTER TABLE trade_settlements_new RENAME TO trade_settlements');
                // Recreate indexes
                connection_1.default.exec('CREATE INDEX IF NOT EXISTS idx_trade_settlements_trade_id ON trade_settlements(trade_id)');
                connection_1.default.exec('CREATE INDEX IF NOT EXISTS idx_trade_settlements_receipt_id ON trade_settlements(receipt_id)');
                connection_1.default.exec('CREATE INDEX IF NOT EXISTS idx_trade_settlements_counterpart_balance ON trade_settlements(counterpart_balance_id)');
                connection_1.default.exec('COMMIT');
                markMigrationCompleted(creditMigration);
                console.log('✅ Credit application support migration completed');
            }
            catch (error) {
                connection_1.default.exec('ROLLBACK');
                throw error;
            }
        }
        // Re-enable foreign key constraints
        connection_1.default.exec('PRAGMA foreign_keys = ON');
        console.log('Database migrations completed successfully');
    }
    catch (error) {
        console.error('Migration failed:', error);
        // Re-enable foreign keys even if migration fails
        try {
            connection_1.default.exec('PRAGMA foreign_keys = ON');
        }
        catch (e) {
            // Ignore cleanup errors
        }
        throw error;
    }
}
// Run if called directly
if (require.main === module) {
    runMigrations();
}
//# sourceMappingURL=migrate.js.map