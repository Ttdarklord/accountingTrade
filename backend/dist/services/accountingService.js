"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingService = void 0;
const connection_1 = __importDefault(require("../database/connection"));
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
class AccountingService {
    /**
     * Create journal entry for a currency purchase
     * When buying AED with Toman:
     * - Debit: Currency Inventory - AED (Asset)
     * - Credit: Accounts Payable - Toman (Liability) or Cash - Toman (Asset)
     */
    static createPurchaseEntry(tradeId, amount, baseCurrency, rate, totalValue, entryDate) {
        const entryNumber = `JE-${(0, date_fns_1.format)(new Date(), 'yyyyMMdd')}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const insertEntry = connection_1.default.prepare(`
      INSERT INTO journal_entries (entry_number, trade_id, description, entry_date)
      VALUES (?, ?, ?, ?)
    `);
        const description = `Purchase ${amount.toLocaleString()} ${baseCurrency} at rate ${rate}`;
        const result = insertEntry.run(entryNumber, tradeId, description, entryDate);
        const journalEntryId = result.lastInsertRowid;
        // Create journal entry lines
        const lines = [];
        if (baseCurrency === 'AED') {
            // Buying AED with Toman
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1202',
                account_name: 'Currency Inventory - AED',
                debit_amount: amount,
                credit_amount: 0,
                currency: 'AED'
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '2001',
                account_name: 'Accounts Payable - Toman',
                debit_amount: 0,
                credit_amount: totalValue,
                currency: 'TOMAN'
            });
        }
        else {
            // Buying Toman with AED
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1201',
                account_name: 'Currency Inventory - Toman',
                debit_amount: amount,
                credit_amount: 0,
                currency: 'TOMAN'
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '2002',
                account_name: 'Accounts Payable - AED',
                debit_amount: 0,
                credit_amount: totalValue,
                currency: 'AED'
            });
        }
        // Insert journal entry lines
        const insertLine = connection_1.default.prepare(`
      INSERT INTO journal_entry_lines 
      (journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (const line of lines) {
            insertLine.run(line.journal_entry_id, line.account_code, line.account_name, line.debit_amount, line.credit_amount, line.currency);
        }
        return this.getJournalEntry(journalEntryId);
    }
    /**
     * Create journal entry for a currency sale
     * When selling AED for Toman:
     * - Debit: Accounts Receivable - Toman (Asset) or Cash - Toman (Asset)
     * - Credit: Currency Inventory - AED (Asset)
     * - If profitable: Credit: Trading Revenue - Currency Exchange (Revenue)
     */
    static createSaleEntry(tradeId, amount, baseCurrency, rate, totalValue, costBasis, profit, entryDate) {
        const entryNumber = `JE-${(0, date_fns_1.format)(new Date(), 'yyyyMMdd')}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const insertEntry = connection_1.default.prepare(`
      INSERT INTO journal_entries (entry_number, trade_id, description, entry_date)
      VALUES (?, ?, ?, ?)
    `);
        const description = `Sale ${amount.toLocaleString()} ${baseCurrency} at rate ${rate}`;
        const result = insertEntry.run(entryNumber, tradeId, description, entryDate);
        const journalEntryId = result.lastInsertRowid;
        const lines = [];
        if (baseCurrency === 'AED') {
            // Selling AED for Toman
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1101',
                account_name: 'Accounts Receivable - Toman',
                debit_amount: totalValue,
                credit_amount: 0,
                currency: 'TOMAN'
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1202',
                account_name: 'Currency Inventory - AED',
                debit_amount: 0,
                credit_amount: amount,
                currency: 'AED'
            });
            // Record profit/loss
            if (profit > 0) {
                lines.push({
                    journal_entry_id: journalEntryId,
                    account_code: '4001',
                    account_name: 'Trading Revenue - Currency Exchange',
                    debit_amount: 0,
                    credit_amount: profit,
                    currency: 'TOMAN'
                });
            }
            else if (profit < 0) {
                lines.push({
                    journal_entry_id: journalEntryId,
                    account_code: '5001',
                    account_name: 'Trading Expenses',
                    debit_amount: Math.abs(profit),
                    credit_amount: 0,
                    currency: 'TOMAN'
                });
            }
        }
        else {
            // Selling Toman for AED
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1102',
                account_name: 'Accounts Receivable - AED',
                debit_amount: totalValue,
                credit_amount: 0,
                currency: 'AED'
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: '1201',
                account_name: 'Currency Inventory - Toman',
                debit_amount: 0,
                credit_amount: amount,
                currency: 'TOMAN'
            });
            // Record profit/loss in AED
            if (profit > 0) {
                lines.push({
                    journal_entry_id: journalEntryId,
                    account_code: '4001',
                    account_name: 'Trading Revenue - Currency Exchange',
                    debit_amount: 0,
                    credit_amount: profit,
                    currency: 'AED'
                });
            }
            else if (profit < 0) {
                lines.push({
                    journal_entry_id: journalEntryId,
                    account_code: '5001',
                    account_name: 'Trading Expenses',
                    debit_amount: Math.abs(profit),
                    credit_amount: 0,
                    currency: 'AED'
                });
            }
        }
        // Insert journal entry lines
        const insertLine = connection_1.default.prepare(`
      INSERT INTO journal_entry_lines 
      (journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (const line of lines) {
            insertLine.run(line.journal_entry_id, line.account_code, line.account_name, line.debit_amount, line.credit_amount, line.currency);
        }
        return this.getJournalEntry(journalEntryId);
    }
    /**
     * Create journal entry for payment made
     */
    static createPaymentEntry(paymentId, amount, currency, isOutgoing, entryDate) {
        const entryNumber = `JE-${(0, date_fns_1.format)(new Date(), 'yyyyMMdd')}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const insertEntry = connection_1.default.prepare(`
      INSERT INTO journal_entries (entry_number, description, entry_date)
      VALUES (?, ?, ?)
    `);
        const description = `${isOutgoing ? 'Payment made' : 'Payment received'} ${amount.toLocaleString()} ${currency}`;
        const result = insertEntry.run(entryNumber, description, entryDate);
        const journalEntryId = result.lastInsertRowid;
        const lines = [];
        if (isOutgoing) {
            // Payment made
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: currency === 'AED' ? '2002' : '2001',
                account_name: `Accounts Payable - ${currency}`,
                debit_amount: amount,
                credit_amount: 0,
                currency
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: currency === 'AED' ? '1002' : '1001',
                account_name: `Cash - ${currency}`,
                debit_amount: 0,
                credit_amount: amount,
                currency
            });
        }
        else {
            // Payment received
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: currency === 'AED' ? '1002' : '1001',
                account_name: `Cash - ${currency}`,
                debit_amount: amount,
                credit_amount: 0,
                currency
            });
            lines.push({
                journal_entry_id: journalEntryId,
                account_code: currency === 'AED' ? '1102' : '1101',
                account_name: `Accounts Receivable - ${currency}`,
                debit_amount: 0,
                credit_amount: amount,
                currency
            });
        }
        // Insert journal entry lines
        const insertLine = connection_1.default.prepare(`
      INSERT INTO journal_entry_lines 
      (journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        for (const line of lines) {
            insertLine.run(line.journal_entry_id, line.account_code, line.account_name, line.debit_amount, line.credit_amount, line.currency);
        }
        return this.getJournalEntry(journalEntryId);
    }
    /**
     * Get journal entry with lines
     */
    static getJournalEntry(journalEntryId) {
        const getEntry = connection_1.default.prepare(`
      SELECT * FROM journal_entries WHERE id = ?
    `);
        const getLines = connection_1.default.prepare(`
      SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
    `);
        const entry = getEntry.get(journalEntryId);
        const lines = getLines.all(journalEntryId);
        return { ...entry, lines };
    }
    /**
     * Update company balances
     */
    static updateCompanyBalance(currency, amount, isSafeBalance = false) {
        const field = isSafeBalance ? 'safe_balance' : 'balance';
        const updateBalance = connection_1.default.prepare(`
      UPDATE company_balances 
      SET ${field} = ${field} + ?, updated_at = CURRENT_TIMESTAMP
      WHERE currency = ?
    `);
        updateBalance.run(amount, currency);
    }
    /**
     * Get account balances summary
     */
    static getAccountBalances() {
        const query = connection_1.default.prepare(`
      SELECT 
        coa.account_code,
        coa.account_name,
        coa.account_type,
        jel.currency,
        SUM(jel.debit_amount - jel.credit_amount) as balance
      FROM journal_entry_lines jel
      JOIN chart_of_accounts coa ON jel.account_code = coa.account_code
      WHERE coa.is_active = 1
      GROUP BY coa.account_code, coa.account_name, coa.account_type, jel.currency
      HAVING balance != 0
      ORDER BY coa.account_code
    `);
        return query.all();
    }
}
exports.AccountingService = AccountingService;
//# sourceMappingURL=accountingService.js.map