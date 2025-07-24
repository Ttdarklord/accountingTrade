"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCounterpartBalance = updateCounterpartBalance;
const express_1 = __importDefault(require("express"));
const connection_1 = __importDefault(require("../database/connection"));
const router = express_1.default.Router();
// GET /api/counterparts/balances - Get all counterpart balances
router.get('/balances', async (req, res) => {
    try {
        const currency = req.query.currency;
        const counterpartId = req.query.counterpart_id;
        let query = `
      SELECT 
        cb.*,
        tp.name as counterpart_name
      FROM counterpart_balances cb
      LEFT JOIN trading_parties tp ON cb.counterpart_id = tp.id
      WHERE 1=1
    `;
        const params = [];
        if (currency) {
            query += ' AND cb.currency = ?';
            params.push(currency);
        }
        if (counterpartId) {
            query += ' AND cb.counterpart_id = ?';
            params.push(parseInt(counterpartId));
        }
        query += ' ORDER BY tp.name, cb.currency';
        const balances = connection_1.default.prepare(query).all(...params);
        res.json({
            success: true,
            data: balances
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch counterpart balances',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// GET /api/counterparts/:id/statement - Get counterpart statement for specific currency
router.get('/:id/statement', async (req, res) => {
    try {
        const counterpartId = parseInt(req.params.id);
        const currency = req.query.currency;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const format = req.query.format;
        if (!currency) {
            return res.status(400).json({
                success: false,
                error: 'Currency parameter is required'
            });
        }
        // Get counterpart info
        const counterpart = connection_1.default.prepare('SELECT * FROM trading_parties WHERE id = ?').get(counterpartId);
        if (!counterpart) {
            return res.status(404).json({
                success: false,
                error: 'Trading party not found'
            });
        }
        // Build query with optional date filtering
        let query = `
      SELECT 
        csl.*,
        t.trade_number,
        pr.tracking_last_5
      FROM counterpart_statement_lines csl
      LEFT JOIN trades t ON csl.trade_id = t.id
      LEFT JOIN payment_receipts pr ON csl.receipt_id = pr.id
      WHERE csl.counterpart_id = ? AND csl.currency = ?
    `;
        const params = [counterpartId, currency];
        if (startDate) {
            query += ' AND csl.transaction_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND csl.transaction_date <= ?';
            params.push(endDate);
        }
        query += ' ORDER BY csl.transaction_date ASC, csl.created_at ASC';
        const lines = connection_1.default.prepare(query).all(...params);
        // Get current balance
        const balance = connection_1.default.prepare(`
      SELECT * FROM counterpart_balances 
      WHERE counterpart_id = ? AND currency = ?
    `).get(counterpartId, currency);
        const responseData = {
            counterpart,
            currency,
            current_balance: balance?.balance || 0,
            statement_lines: lines
        };
        // Handle CSV format request
        if (format === 'csv') {
            const csvHeader = 'Date,Type,Description,Debit,Credit,Balance\n';
            const csvRows = lines.map(line => {
                const date = new Date(line.transaction_date).toLocaleDateString();
                const description = line.description.replace(/,/g, ';'); // Replace commas to avoid CSV issues
                const debit = line.debit_amount || '';
                const credit = line.credit_amount || '';
                const balance = line.balance_after;
                return `${date},${line.transaction_type},"${description}",${debit},${credit},${balance}`;
            }).join('\n');
            const csvContent = csvHeader + csvRows;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${counterpart.name}_${currency}_Statement.csv"`);
            return res.send(csvContent);
        }
        res.json({
            success: true,
            data: responseData
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch counterpart statement',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// GET /api/counterparts/:id/balances - Get all balances for a specific counterpart
router.get('/:id/balances', async (req, res) => {
    try {
        const counterpartId = parseInt(req.params.id);
        // Get counterpart info
        const counterpart = connection_1.default.prepare('SELECT * FROM trading_parties WHERE id = ?').get(counterpartId);
        if (!counterpart) {
            return res.status(404).json({
                success: false,
                error: 'Trading party not found'
            });
        }
        // Get balances for both currencies
        const balances = connection_1.default.prepare(`
      SELECT * FROM counterpart_balances 
      WHERE counterpart_id = ?
      ORDER BY currency
    `).all(counterpartId);
        // Ensure we have entries for both currencies (create if missing)
        const currencies = ['AED', 'TOMAN'];
        const balanceMap = new Map(balances.map(b => [b.currency, b]));
        const result = currencies.map(currency => {
            const existing = balanceMap.get(currency);
            if (existing) {
                return existing;
            }
            // Create missing balance entry
            const stmt = connection_1.default.prepare(`
        INSERT INTO counterpart_balances (counterpart_id, currency, balance)
        VALUES (?, ?, 0)
      `);
            const insertResult = stmt.run(counterpartId, currency);
            return {
                id: insertResult.lastInsertRowid,
                counterpart_id: counterpartId,
                currency,
                balance: 0,
                updated_at: new Date().toISOString()
            };
        });
        res.json({
            success: true,
            data: {
                counterpart,
                balances: result
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch counterpart balances',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Helper function to update counterpart balance and create statement line
function updateCounterpartBalance(counterpartId, currency, amount, // positive for credit, negative for debit
transactionType, description, transactionDate, tradeId, receiptId, useOwnTransaction = true) {
    const executeUpdate = () => {
        // Get or create counterpart balance
        let balance = connection_1.default.prepare(`
      SELECT * FROM counterpart_balances 
      WHERE counterpart_id = ? AND currency = ?
    `).get(counterpartId, currency);
        if (!balance) {
            // Create new balance record
            const stmt = connection_1.default.prepare(`
        INSERT INTO counterpart_balances (counterpart_id, currency, balance)
        VALUES (?, ?, 0)
      `);
            const result = stmt.run(counterpartId, currency);
            balance = {
                id: result.lastInsertRowid,
                counterpart_id: counterpartId,
                currency,
                balance: 0,
                updated_at: new Date().toISOString()
            };
        }
        // Calculate new balance
        const newBalance = balance.balance + amount;
        // Update balance
        connection_1.default.prepare(`
      UPDATE counterpart_balances 
      SET balance = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newBalance, balance.id);
        // Create statement line
        connection_1.default.prepare(`
      INSERT INTO counterpart_statement_lines (
        counterpart_id, currency, transaction_type, trade_id, receipt_id,
        description, debit_amount, credit_amount, balance_after, transaction_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(counterpartId, currency, transactionType, tradeId || null, receiptId || null, description, amount < 0 ? Math.abs(amount) : 0, // debit
        amount > 0 ? amount : 0, // credit
        newBalance, transactionDate);
        return {
            success: true,
            previousBalance: balance.balance,
            newBalance,
            amount
        };
    };
    if (useOwnTransaction) {
        try {
            connection_1.default.exec('BEGIN TRANSACTION');
            const result = executeUpdate();
            connection_1.default.exec('COMMIT');
            return result;
        }
        catch (error) {
            connection_1.default.exec('ROLLBACK');
            throw error;
        }
    }
    else {
        // Execute without managing transaction - assume caller is managing it
        return executeUpdate();
    }
}
exports.default = router;
//# sourceMappingURL=counterparts.js.map