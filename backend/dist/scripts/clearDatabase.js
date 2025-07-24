"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearDatabase = clearDatabase;
const connection_1 = __importDefault(require("../database/connection"));
function clearDatabase() {
    console.log('🧹 Clearing database data...');
    try {
        // Temporarily disable foreign key constraints
        connection_1.default.exec('PRAGMA foreign_keys = OFF');
        // Clear all user-generated data tables
        console.log('Clearing counterpart statement lines...');
        connection_1.default.exec('DELETE FROM counterpart_statement_lines');
        console.log('Clearing counterpart balances...');
        connection_1.default.exec('DELETE FROM counterpart_balances');
        console.log('Clearing trade settlements...');
        connection_1.default.exec('DELETE FROM trade_settlements');
        console.log('Clearing payment receipts...');
        connection_1.default.exec('DELETE FROM payment_receipts');
        console.log('Clearing payment instructions...');
        connection_1.default.exec('DELETE FROM payment_instructions');
        console.log('Clearing journal entry lines...');
        connection_1.default.exec('DELETE FROM journal_entry_lines');
        console.log('Clearing journal entries...');
        connection_1.default.exec('DELETE FROM journal_entries');
        console.log('Clearing trade positions...');
        connection_1.default.exec('DELETE FROM trade_positions');
        console.log('Clearing trades...');
        connection_1.default.exec('DELETE FROM trades');
        console.log('Clearing bank accounts...');
        connection_1.default.exec('DELETE FROM bank_accounts');
        console.log('Clearing trading parties...');
        connection_1.default.exec('DELETE FROM trading_parties');
        // Reset company balances to zero
        console.log('Resetting company balances...');
        connection_1.default.exec(`
      UPDATE company_balances 
      SET balance = 0, safe_balance = 0, updated_at = CURRENT_TIMESTAMP
    `);
        // Reset auto-increment sequences for cleared tables
        console.log('Resetting auto-increment sequences...');
        connection_1.default.exec(`DELETE FROM sqlite_sequence WHERE name IN (
      'trading_parties', 'trades', 'trade_positions', 'payment_instructions', 
      'payment_receipts', 'journal_entries', 'journal_entry_lines', 'bank_accounts',
      'counterpart_balances', 'counterpart_statement_lines', 'trade_settlements'
    )`);
        // Re-enable foreign key constraints
        connection_1.default.exec('PRAGMA foreign_keys = ON');
        console.log('✅ Database cleared successfully!');
        console.log('📊 All user data removed, schema preserved');
        console.log('🔄 Ready for fresh data entry');
    }
    catch (error) {
        // Re-enable foreign key constraints on error
        connection_1.default.exec('PRAGMA foreign_keys = ON');
        console.error('❌ Error clearing database:', error);
        console.log('💡 If this fails, you may need to restart the backend after clearing.');
        throw error;
    }
}
// Run if called directly
if (require.main === module) {
    clearDatabase();
}
//# sourceMappingURL=clearDatabase.js.map