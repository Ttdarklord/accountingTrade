import express from 'express';
import db from '../database/connection';
import { BankAccount, CreateBankAccountRequest, UpdateBankAccountRequest } from '../types';
import { z } from 'zod';

const router = express.Router();

// Validation schema
const createAccountSchema = z.object({
  account_number: z.string().min(1),
  bank_name: z.string().min(1),
  currency: z.enum(['AED', 'TOMAN']),
  counterpart_id: z.number().positive()
});

const updateAccountSchema = z.object({
  account_number: z.string().min(1).optional(),
  bank_name: z.string().min(1).optional(),
  currency: z.enum(['AED', 'TOMAN']).optional(),
  counterpart_id: z.number().positive().optional(),
  is_active: z.boolean().optional()
});

// GET /api/accounts - Get all bank accounts with counterpart info and receipt counts
router.get('/', async (req, res) => {
  try {
    const currency = req.query.currency as string;
    const isActive = req.query.active;
    const counterpartId = req.query.counterpart_id as string;
    
    let query = `
      SELECT 
        ba.*,
        tp.name as counterpart_name,
        COUNT(pr.id) as receipt_count
      FROM bank_accounts ba
      LEFT JOIN trading_parties tp ON ba.counterpart_id = tp.id
      LEFT JOIN payment_receipts pr ON ba.id = pr.receiver_account_id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (currency) {
      query += ' AND ba.currency = ?';
      params.push(currency);
    }
    
    if (isActive !== undefined) {
      query += ' AND ba.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }
    
    if (counterpartId) {
      query += ' AND ba.counterpart_id = ?';
      params.push(parseInt(counterpartId));
    }
    
    query += ` 
      GROUP BY ba.id, tp.name
      ORDER BY ba.is_active DESC, tp.name, ba.bank_name
    `;
    
    const accounts = db.prepare(query).all(...params) as BankAccount[];
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bank accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/accounts/:id - Get a specific bank account with receipt history
router.get('/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const payerId = req.query.payer_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const trackingSearch = req.query.tracking_search as string;
    const format = req.query.format as string;
    
    // Get account details
    const account = db.prepare(`
      SELECT 
        ba.*,
        tp.name as counterpart_name
      FROM bank_accounts ba
      LEFT JOIN trading_parties tp ON ba.counterpart_id = tp.id
      WHERE ba.id = ?
    `).get(accountId) as BankAccount;
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }
    
    // Build receipt query with filters
    let receiptQuery = `
      SELECT 
        pr.*,
        tp.name as payer_name
      FROM payment_receipts pr
      LEFT JOIN trading_parties tp ON pr.payer_id = tp.id
      WHERE pr.receiver_account_id = ?
    `;
    const params: any[] = [accountId];
    
    // Add payer filter
    if (payerId && payerId !== '') {
      receiptQuery += ' AND pr.payer_id = ?';
      params.push(parseInt(payerId));
    }
    
    // Add tracking search filter
    if (trackingSearch && trackingSearch !== '') {
      receiptQuery += ' AND pr.tracking_last_5 LIKE ?';
      params.push(`%${trackingSearch}%`);
    }
    
    // Add date range filters
    if (startDate) {
      receiptQuery += ' AND pr.receipt_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      receiptQuery += ' AND pr.receipt_date <= ?';
      params.push(endDate);
    }
    
    receiptQuery += ' ORDER BY pr.receipt_date DESC, pr.created_at DESC';
    
    const receipts = db.prepare(receiptQuery).all(...params) as any[];
    
    // Handle CSV export
    if (format === 'csv') {
      const last5Digits = account.account_number.slice(-5);
      const csvHeader = [
        `Account Details:,${account.bank_name} - Last 5 digits: ${last5Digits}`,
        `Currency:,${account.currency}`,
        payerId ? `Payer Filter:,${receipts.length > 0 ? receipts[0].payer_name : 'Unknown'}` : '',
        trackingSearch ? `Tracking Filter:,${trackingSearch}` : '',
        startDate || endDate ? `Date Range:,${startDate || 'No start'} to ${endDate || 'No end'}` : '',
        `Total Receipts:,${receipts.length}`,
        `Export Date:,${new Date().toISOString().split('T')[0]}`,
        '', // Empty row
        'Receipt ID,Date,Payer,Amount,Currency,Tracking,Notes'
      ].filter(row => row !== ''); // Remove empty filter rows
      
      const csvRows = receipts.map((receipt: any) => [
        receipt.id,
        receipt.receipt_date,
        receipt.payer_name || 'Unknown',
        receipt.amount,
        receipt.currency || 'TOMAN',
        `...${receipt.tracking_last_5}`,
        receipt.notes || ''
      ].join(','));
      
      const csvContent = [...csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${account.bank_name}-${last5Digits}-receipts.csv"`);
      return res.send(csvContent);
    }
    
    res.json({
      success: true,
      data: {
        account,
        receipts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bank account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/accounts - Create a new bank account
router.post('/', async (req, res) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);
    
    // Check if counterpart exists
    const counterpart = db.prepare('SELECT id FROM trading_parties WHERE id = ?').get(validatedData.counterpart_id);
    if (!counterpart) {
      return res.status(400).json({
        success: false,
        error: 'Trading party not found'
      });
    }
    
    // Check if account number already exists
    const existingAccount = db.prepare('SELECT id FROM bank_accounts WHERE account_number = ?').get(validatedData.account_number);
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: 'Account number already exists'
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO bank_accounts (account_number, bank_name, currency, counterpart_id)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      validatedData.account_number,
      validatedData.bank_name,
      validatedData.currency,
      validatedData.counterpart_id
    );
    
    // Get the created account with counterpart info
    const newAccount = db.prepare(`
      SELECT 
        ba.*,
        tp.name as counterpart_name,
        0 as receipt_count
      FROM bank_accounts ba
      LEFT JOIN trading_parties tp ON ba.counterpart_id = tp.id
      WHERE ba.id = ?
    `).get(result.lastInsertRowid) as BankAccount;
    
    res.status(201).json({
      success: true,
      data: newAccount
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create bank account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/accounts/:id - Update a bank account
router.put('/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const validatedData = updateAccountSchema.parse(req.body);
    
    // Check if account exists
    const existingAccount = db.prepare('SELECT id FROM bank_accounts WHERE id = ?').get(accountId);
    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }
    
    // Check if counterpart exists (if provided)
    if (validatedData.counterpart_id) {
      const counterpart = db.prepare('SELECT id FROM trading_parties WHERE id = ?').get(validatedData.counterpart_id);
      if (!counterpart) {
        return res.status(400).json({
          success: false,
          error: 'Trading party not found'
        });
      }
    }
    
    // Check if account number already exists (if updating account number)
    if (validatedData.account_number) {
      const existingAccountNumber = db.prepare('SELECT id FROM bank_accounts WHERE account_number = ? AND id != ?').get(validatedData.account_number, accountId);
      if (existingAccountNumber) {
        return res.status(400).json({
          success: false,
          error: 'Account number already exists'
        });
      }
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (validatedData.account_number) {
      updateFields.push('account_number = ?');
      updateValues.push(validatedData.account_number);
    }
    if (validatedData.bank_name) {
      updateFields.push('bank_name = ?');
      updateValues.push(validatedData.bank_name);
    }
    if (validatedData.currency) {
      updateFields.push('currency = ?');
      updateValues.push(validatedData.currency);
    }
    if (validatedData.counterpart_id) {
      updateFields.push('counterpart_id = ?');
      updateValues.push(validatedData.counterpart_id);
    }
    if (validatedData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(validatedData.is_active ? 1 : 0);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    updateValues.push(accountId);
    
    const stmt = db.prepare(`
      UPDATE bank_accounts 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(...updateValues);
    
    // Get the updated account with counterpart info
    const updatedAccount = db.prepare(`
      SELECT 
        ba.*,
        tp.name as counterpart_name,
        COUNT(pr.id) as receipt_count
      FROM bank_accounts ba
      LEFT JOIN trading_parties tp ON ba.counterpart_id = tp.id
      LEFT JOIN payment_receipts pr ON ba.id = pr.receiver_account_id
      WHERE ba.id = ?
      GROUP BY ba.id, tp.name
    `).get(accountId) as BankAccount;
    
    res.json({
      success: true,
      data: updatedAccount
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update bank account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/accounts/:id - Delete a bank account
router.delete('/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Check if account exists
    const existingAccount = db.prepare('SELECT id FROM bank_accounts WHERE id = ?').get(accountId);
    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }
    
    // Check if account has receipts
    const receiptCount = db.prepare('SELECT COUNT(*) as count FROM payment_receipts WHERE receiver_account_id = ?').get(accountId) as { count: number };
    if (receiptCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete account with existing receipts. Deactivate instead.'
      });
    }
    
    // Check if account has payment instructions
    const instructionCount = db.prepare('SELECT COUNT(*) as count FROM payment_instructions WHERE account_id = ?').get(accountId) as { count: number };
    if (instructionCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete account with existing payment instructions. Deactivate instead.'
      });
    }
    
    const stmt = db.prepare('DELETE FROM bank_accounts WHERE id = ?');
    stmt.run(accountId);
    
    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete bank account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 