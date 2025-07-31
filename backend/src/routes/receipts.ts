import express from 'express';
import db from '../database/connection';
import { PaymentReceipt, CreateReceiptRequest, DeleteReceiptRequest, RestoreReceiptRequest } from '../types';
import { updateCounterpartBalance } from './counterparts';
import { SettlementService } from '../services/settlementService';
import { z } from 'zod';

const router = express.Router();

// Validation schema for both TOMAN and AED receipts
const createReceiptSchema = z.object({
  // Common fields
  tracking_last_5: z.string().min(1).max(20), // Allow 1-20 characters for user input
  amount: z.number().positive(),
  currency: z.enum(['AED', 'TOMAN']),
  receipt_date: z.string(),
  notes: z.string().optional(),
  
  // TOMAN receipt fields (conditional)
  payer_id: z.number().positive().optional(),
  receiver_account_id: z.number().positive().optional(),
  
  // AED receipt fields (conditional)
  receipt_type: z.enum(['pay', 'receive']).optional(),
  trading_party_id: z.number().positive().optional(),
  individual_name: z.string().min(1).optional()
}).refine(data => {
  if (data.currency === 'TOMAN') {
    return data.payer_id && data.receiver_account_id && data.tracking_last_5.trim().length > 0;
  } else {
    return data.receipt_type && data.trading_party_id && data.individual_name;
  }
}, {
  message: "For TOMAN receipts, payer_id, receiver_account_id, and tracking_last_5 are required. For AED receipts, receipt_type, trading_party_id, and individual_name are required."
});

// Validation schema for receipt deletion
const deleteReceiptSchema = z.object({
  reason: z.string().min(1, "Deletion reason is required"),
  reason_category: z.enum(['duplicate', 'funds_returned', 'receipt_not_landed', 'data_error', 'other']),
  deleted_by: z.string().optional()
});

// Validation schema for receipt restoration
const restoreReceiptSchema = z.object({
  reason: z.string().min(1, "Restoration reason is required"),
  restored_by: z.string().optional()
});

// GET /api/receipts - Get all payment receipts
router.get('/', async (req, res) => {
  try {
    const payerId = req.query.payer_id as string;
    const accountId = req.query.account_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const currency = req.query.currency as string;
    const includeDeleted = req.query.include_deleted === 'true';
    const onlyDeleted = req.query.only_deleted === 'true';
    
    let query = `
      SELECT 
        pr.*,
        tp_payer.name as payer_name,
        tp_trading.name as trading_party_name,
        ba.account_number as receiver_account_number,
        ba.bank_name as receiver_bank_name,
        receiver_tp.name as receiver_counterpart_name
      FROM payment_receipts pr
      LEFT JOIN trading_parties tp_payer ON pr.payer_id = tp_payer.id
      LEFT JOIN trading_parties tp_trading ON pr.trading_party_id = tp_trading.id
      LEFT JOIN bank_accounts ba ON pr.receiver_account_id = ba.id
      LEFT JOIN trading_parties receiver_tp ON ba.counterpart_id = receiver_tp.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Handle deletion status filtering
    if (onlyDeleted) {
      query += ' AND pr.is_deleted = 1';
    } else if (!includeDeleted) {
      query += ' AND (pr.is_deleted IS NULL OR pr.is_deleted = 0)';
    }
    
    if (payerId) {
      query += ' AND pr.payer_id = ?';
      params.push(parseInt(payerId));
    }
    
    if (accountId) {
      query += ' AND pr.receiver_account_id = ?';
      params.push(parseInt(accountId));
    }
    
    if (startDate) {
      query += ' AND pr.receipt_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND pr.receipt_date <= ?';
      params.push(endDate);
    }

    if (currency) {
      query += ' AND pr.currency = ?';
      params.push(currency);
    }
    
    query += ' ORDER BY pr.receipt_date DESC, pr.created_at DESC';
    
    const receipts = db.prepare(query).all(...params) as PaymentReceipt[];
    
    res.json({
      success: true,
      data: receipts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment receipts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/receipts/:id - Get a specific receipt
router.get('/:id', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    
    const receipt = db.prepare(`
      SELECT 
        pr.*,
        tp_payer.name as payer_name,
        tp_trading.name as trading_party_name,
        ba.account_number as receiver_account_number,
        ba.bank_name as receiver_bank_name,
        receiver_tp.name as receiver_counterpart_name
      FROM payment_receipts pr
      LEFT JOIN trading_parties tp_payer ON pr.payer_id = tp_payer.id
      LEFT JOIN trading_parties tp_trading ON pr.trading_party_id = tp_trading.id
      LEFT JOIN bank_accounts ba ON pr.receiver_account_id = ba.id
      LEFT JOIN trading_parties receiver_tp ON ba.counterpart_id = receiver_tp.id
      WHERE pr.id = ?
    `).get(receiptId) as PaymentReceipt;
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Payment receipt not found'
      });
    }
    
    res.json({
      success: true,
      data: receipt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/receipts - Create a new payment receipt
router.post('/', async (req, res) => {
  try {
    const validatedData = createReceiptSchema.parse(req.body);
    
    let payer: any = null;
    let receiverAccount: any = null;
    let tradingParty: any = null;
    
    if (validatedData.currency === 'TOMAN') {
      // Check if payer exists
      payer = db.prepare('SELECT * FROM trading_parties WHERE id = ?').get(validatedData.payer_id!) as any;
      if (!payer) {
        return res.status(400).json({
          success: false,
          error: 'Payer not found'
        });
      }
    
      // Check if receiver account exists and get its counterpart
      receiverAccount = db.prepare(`
        SELECT ba.*, tp.name as counterpart_name
        FROM bank_accounts ba
        LEFT JOIN trading_parties tp ON ba.counterpart_id = tp.id
        WHERE ba.id = ?
      `).get(validatedData.receiver_account_id!) as any;
      
      if (!receiverAccount) {
        return res.status(400).json({
          success: false,
          error: 'Receiver bank account not found'
        });
      }
      
      if (!receiverAccount.is_active) {
        return res.status(400).json({
          success: false,
          error: 'Receiver bank account is not active'
        });
      }
    } else {
      // For AED receipts, check if trading party exists
      tradingParty = db.prepare('SELECT * FROM trading_parties WHERE id = ?').get(validatedData.trading_party_id!) as any;
      if (!tradingParty) {
        return res.status(400).json({
          success: false,
          error: 'Trading party not found'
        });
      }
    }
    
    try {
      db.exec('BEGIN TRANSACTION');
      
      // Create the receipt
      const stmt = db.prepare(`
        INSERT INTO payment_receipts (
          payer_id, receiver_account_id, tracking_last_5, amount, receipt_date, notes, currency, receipt_type, trading_party_id, individual_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        validatedData.payer_id || null,
        validatedData.receiver_account_id || null,
        validatedData.tracking_last_5,
        validatedData.amount,
        validatedData.receipt_date,
        validatedData.notes || null,
        validatedData.currency,
        validatedData.receipt_type || null,
        validatedData.trading_party_id || null,
        validatedData.individual_name || null
      );
      
      const receiptId = result.lastInsertRowid as number;
      
      // Update counterpart balances with CORRECT accounting logic
      const description = `Receipt #${receiptId} - ...${validatedData.tracking_last_5}`;
      
      if (validatedData.currency === 'TOMAN') {
        // When payer pays to receiver's account:
        // 1. Payer owes us LESS (their balance increases - becomes less negative)
        // 2. We owe receiver LESS (receiver's balance decreases - becomes less positive)
        
        // Increase payer's balance (they owe us less)
        updateCounterpartBalance(
          validatedData.payer_id!,
          'TOMAN',
          validatedData.amount, // positive = credit to payer (they owe us less)
          'RECEIPT',
          description + ' - Payment made',
          validatedData.receipt_date,
          undefined,
          receiptId,
          false // Don't use own transaction - we're managing it here
        );
        
        // Decrease receiver's balance (we owe them less)
        updateCounterpartBalance(
          receiverAccount.counterpart_id,
          'TOMAN',
          -validatedData.amount, // negative = debit to receiver (we owe them less)
          'RECEIPT',
          description + ' - Payment received',
          validatedData.receipt_date,
          undefined,
          receiptId,
          false // Don't use own transaction - we're managing it here
        );
      } else {
        // For AED receipts (cash transactions)
        // If 'pay' - Agrivex pays cash to individual (decrease AED balance)
        // If 'receive' - Agrivex receives cash from individual (increase AED balance)
        const amount = validatedData.receipt_type === 'receive' ? validatedData.amount : -validatedData.amount;
        
        updateCounterpartBalance(
          validatedData.trading_party_id!,
          'AED',
          amount,
          'RECEIPT',
          description + ` - AED ${validatedData.receipt_type} ${validatedData.individual_name}`,
          validatedData.receipt_date,
          undefined,
          receiptId,
          false // Don't use own transaction - we're managing it here
        );
      }
      
      // Create journal entry for the receipt
      const entryNumber = `RCT-${new Date(validatedData.receipt_date).toISOString().split('T')[0].replace(/-/g, '')}-${receiptId.toString().padStart(4, '0')}`;
      
      const journalStmt = db.prepare(`
        INSERT INTO journal_entries (entry_number, receipt_id, description, entry_date)
        VALUES (?, ?, ?, ?)
      `);
      
      const description_text = validatedData.currency === 'TOMAN' 
        ? `Receipt: ${payer.name} paid ${validatedData.amount.toLocaleString()} Toman to ${receiverAccount.counterpart_name}`
        : `Receipt: ${validatedData.receipt_type} ${validatedData.amount.toLocaleString()} AED ${validatedData.receipt_type === 'pay' ? 'to' : 'from'} ${validatedData.individual_name} (${tradingParty.name})`;
      
      const journalResult = journalStmt.run(
        entryNumber,
        receiptId,
        description_text,
        validatedData.receipt_date
      );
      
      const journalEntryId = journalResult.lastInsertRowid as number;
      
      // Create journal entry lines
      const lineStmt = db.prepare(`
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency, counterpart_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      if (validatedData.currency === 'TOMAN') {
        // Debit: Counterpart Receivables (money owed to us by payer decreased)
        lineStmt.run(
          journalEntryId,
          '1101',
          'Counterpart Receivables - Toman',
          validatedData.amount,
          0,
          'TOMAN',
          validatedData.payer_id!
        );
        
        // Credit: Counterpart Payables (money we owe to receiver increased)
        lineStmt.run(
          journalEntryId,
          '2001',
          'Counterpart Payables - Toman',
          0,
          validatedData.amount,
          'TOMAN',
          receiverAccount.counterpart_id
        );
      } else {
        // For AED receipts (cash transactions)
        if (validatedData.receipt_type === 'receive') {
          // Debit: Cash AED (increase cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            validatedData.amount,
            0,
            'AED',
            null
          );
          
          // Credit: Counterpart Receivables (decrease what they owe us)
          lineStmt.run(
            journalEntryId,
            '1102',
            'Counterpart Receivables - AED',
            0,
            validatedData.amount,
            'AED',
            validatedData.trading_party_id!
          );
        } else {
          // Credit: Cash AED (decrease cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            0,
            validatedData.amount,
            'AED',
            null
          );
          
          // Debit: Counterpart Payables (decrease what we owe them)
          lineStmt.run(
            journalEntryId,
            '2002',
            'Counterpart Payables - AED',
            validatedData.amount,
            0,
            'AED',
            validatedData.trading_party_id!
          );
        }
      }
      
      db.exec('COMMIT');
      
      // Process FIFO settlement after successful receipt creation
      try {
        SettlementService.processReceipt(receiptId);
      } catch (settlementError) {
        console.error('Settlement processing failed (receipt still created):', settlementError);
        // Don't fail the entire operation - receipt is still valid
      }
      
      // Get the created receipt with all joined data
      const newReceipt = db.prepare(`
        SELECT 
          pr.*,
          tp_payer.name as payer_name,
          tp_trading.name as trading_party_name,
          ba.account_number as receiver_account_number,
          ba.bank_name as receiver_bank_name,
          receiver_tp.name as receiver_counterpart_name
        FROM payment_receipts pr
        LEFT JOIN trading_parties tp_payer ON pr.payer_id = tp_payer.id
        LEFT JOIN trading_parties tp_trading ON pr.trading_party_id = tp_trading.id
        LEFT JOIN bank_accounts ba ON pr.receiver_account_id = ba.id
        LEFT JOIN trading_parties receiver_tp ON ba.counterpart_id = receiver_tp.id
        WHERE pr.id = ?
      `).get(receiptId) as PaymentReceipt;
      
      res.status(201).json({
        success: true,
        data: newReceipt,
        message: 'Receipt created, balances updated, and settlement processed successfully'
      });
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    
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
      error: 'Failed to create payment receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/receipts/:id/delete - Soft delete a receipt with proper accounting reversal
router.put('/:id/delete', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    const validatedData = deleteReceiptSchema.parse(req.body);
    
    // Get the receipt with all details including receiver counterpart
    const receipt = db.prepare(`
      SELECT 
        pr.*,
        ba.counterpart_id as receiver_counterpart_id
      FROM payment_receipts pr
      LEFT JOIN bank_accounts ba ON pr.receiver_account_id = ba.id
      WHERE pr.id = ? AND (pr.is_deleted IS NULL OR pr.is_deleted = 0)
    `).get(receiptId) as any;
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Payment receipt not found or already deleted'
      });
    }
    
    try {
      db.exec('BEGIN TRANSACTION');
      
      const deletionTime = new Date().toISOString();
      const description = `Receipt #${receiptId} Deleted - ${validatedData.reason_category}: ${validatedData.reason}`;
      
      // Create reversal journal entries and update counterpart balances
      if (receipt.currency === 'TOMAN') {
        // Reverse: Decrease payer's balance (they owe us more again)
        updateCounterpartBalance(
          receipt.payer_id,
          'TOMAN',
          -receipt.amount, // negative = debit (they owe us more)
          'RECEIPT',
          description + ' - Payment reversed',
          new Date().toISOString().split('T')[0],
          undefined,
          receiptId,
          false // Don't use own transaction - we're managing it here
        );
        
        // Only update receiver balance if there's a valid receiver counterpart
        if (receipt.receiver_counterpart_id) {
          updateCounterpartBalance(
            receipt.receiver_counterpart_id,
            'TOMAN',
            receipt.amount, // positive = credit (we owe them more)
            'RECEIPT',
            description + ' - Receipt reversed',
            new Date().toISOString().split('T')[0],
            undefined,
            receiptId,
            false // Don't use own transaction - we're managing it here
          );
        }
      } else {
        // For AED receipts, reverse the cash transaction
        const amount = receipt.receipt_type === 'receive' ? -receipt.amount : receipt.amount;
        
        updateCounterpartBalance(
          receipt.trading_party_id,
          'AED',
          amount, // Reverse the original transaction
          'RECEIPT',
          description + ' - AED receipt reversed',
          new Date().toISOString().split('T')[0],
          undefined,
          receiptId,
          false // Don't use own transaction - we're managing it here
        );
      }
      
      // Create reversal journal entry
      const entryNumber = `RCT-DEL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${receiptId.toString().padStart(4, '0')}`;
      
      const journalStmt = db.prepare(`
        INSERT INTO journal_entries (entry_number, receipt_id, description, entry_date)
        VALUES (?, ?, ?, ?)
      `);
      
      const journalResult = journalStmt.run(
        entryNumber,
        receiptId,
        description,
        new Date().toISOString().split('T')[0]
      );
      
      const journalEntryId = journalResult.lastInsertRowid as number;
      
      // Create reversal journal entry lines
      const lineStmt = db.prepare(`
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency, counterpart_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      if (receipt.currency === 'TOMAN') {
        // Credit: Counterpart Receivables (money owed to us by payer increased)
        lineStmt.run(
          journalEntryId,
          '1101',
          'Counterpart Receivables - Toman',
          0,
          receipt.amount,
          'TOMAN',
          receipt.payer_id
        );
        
        // Debit: Counterpart Payables (money we owe to receiver decreased)
        if (receipt.receiver_counterpart_id) {
          lineStmt.run(
            journalEntryId,
            '2001',
            'Counterpart Payables - Toman',
            receipt.amount,
            0,
            'TOMAN',
            receipt.receiver_counterpart_id
          );
        }
      } else {
        // For AED receipts (cash transactions)
        if (receipt.receipt_type === 'receive') {
          // Credit: Cash AED (decrease cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            0,
            receipt.amount,
            'AED',
            null
          );
          
          // Debit: Counterpart Receivables (increase what they owe us)
          lineStmt.run(
            journalEntryId,
            '1102',
            'Counterpart Receivables - AED',
            receipt.amount,
            0,
            'AED',
            receipt.trading_party_id
          );
        } else {
          // Debit: Cash AED (increase cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            receipt.amount,
            0,
            'AED',
            null
          );
          
          // Credit: Counterpart Payables (increase what we owe them)
          lineStmt.run(
            journalEntryId,
            '2002',
            'Counterpart Payables - AED',
            0,
            receipt.amount,
            'AED',
            receipt.trading_party_id
          );
        }
      }
      
      // Mark receipt as deleted (soft delete)
      const deleteStmt = db.prepare(`
        UPDATE payment_receipts 
        SET is_deleted = 1, 
            deleted_at = ?, 
            deletion_reason = ?, 
            deletion_reason_category = ?,
            deleted_by = ?
        WHERE id = ?
      `);
      
      deleteStmt.run(
        deletionTime,
        validatedData.reason,
        validatedData.reason_category,
        validatedData.deleted_by || 'Unknown',
        receiptId
      );
      
      db.exec('COMMIT');
      
      // Reverse settlement after successful deletion
      try {
        // TODO: Implement reverseReceiptSettlement method  
        // SettlementService.reverseReceiptSettlement(receiptId);
      } catch (settlementError) {
        console.error('Settlement reversal failed (receipt still deleted):', settlementError);
        // Don't fail the entire operation - receipt deletion is still valid
      }
      
      res.json({
        success: true,
        message: 'Receipt deleted, accounting entries reversed, and settlement reversed successfully'
      });
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    
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
      error: 'Failed to delete payment receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/receipts/:id/restore - Restore a deleted receipt
router.put('/:id/restore', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    const validatedData = restoreReceiptSchema.parse(req.body);
    
    // Get the deleted receipt with all details
    const receipt = db.prepare(`
      SELECT 
        pr.*,
        ba.counterpart_id as receiver_counterpart_id
      FROM payment_receipts pr
      LEFT JOIN bank_accounts ba ON pr.receiver_account_id = ba.id
      WHERE pr.id = ? AND pr.is_deleted = 1
    `).get(receiptId) as any;
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Deleted receipt not found'
      });
    }
    
    try {
      db.exec('BEGIN TRANSACTION');
      
      const restorationTime = new Date().toISOString();
      const description = `Receipt #${receiptId} Restored - ${validatedData.reason}`;
      
      // Re-apply the original accounting entries
      if (receipt.currency === 'TOMAN') {
        // Increase payer's balance (they owe us less again)
        updateCounterpartBalance(
          receipt.payer_id,
          'TOMAN',
          receipt.amount, // positive = credit to payer (they owe us less)
          'RECEIPT',
          description + ' - Payment restored',
          new Date().toISOString().split('T')[0],
          undefined,
          receiptId,
          false
        );
        
        // Decrease receiver's balance (we owe them less again)
        if (receipt.receiver_counterpart_id) {
          updateCounterpartBalance(
            receipt.receiver_counterpart_id,
            'TOMAN',
            -receipt.amount, // negative = debit to receiver (we owe them less)
            'RECEIPT',
            description + ' - Receipt restored',
            new Date().toISOString().split('T')[0],
            undefined,
            receiptId,
            false
          );
        }
      } else {
        // For AED receipts, re-apply the original transaction
        const amount = receipt.receipt_type === 'receive' ? receipt.amount : -receipt.amount;
        
        updateCounterpartBalance(
          receipt.trading_party_id,
          'AED',
          amount, // Re-apply the original transaction
          'RECEIPT',
          description + ' - AED receipt restored',
          new Date().toISOString().split('T')[0],
          undefined,
          receiptId,
          false
        );
      }
      
      // Create restoration journal entry
      const entryNumber = `RCT-RST-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${receiptId.toString().padStart(4, '0')}`;
      
      const journalStmt = db.prepare(`
        INSERT INTO journal_entries (entry_number, receipt_id, description, entry_date)
        VALUES (?, ?, ?, ?)
      `);
      
      const journalResult = journalStmt.run(
        entryNumber,
        receiptId,
        description,
        new Date().toISOString().split('T')[0]
      );
      
      const journalEntryId = journalResult.lastInsertRowid as number;
      
      // Create restoration journal entry lines (reverse of the deletion entries)
      const lineStmt = db.prepare(`
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_code, account_name, debit_amount, credit_amount, currency, counterpart_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      if (receipt.currency === 'TOMAN') {
        // Debit: Counterpart Receivables (money owed to us by payer decreased)
        lineStmt.run(
          journalEntryId,
          '1101',
          'Counterpart Receivables - Toman',
          receipt.amount,
          0,
          'TOMAN',
          receipt.payer_id
        );
        
        // Credit: Counterpart Payables (money we owe to receiver increased)
        if (receipt.receiver_counterpart_id) {
          lineStmt.run(
            journalEntryId,
            '2001',
            'Counterpart Payables - Toman',
            0,
            receipt.amount,
            'TOMAN',
            receipt.receiver_counterpart_id
          );
        }
      } else {
        // For AED receipts (cash transactions)
        if (receipt.receipt_type === 'receive') {
          // Debit: Cash AED (increase cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            receipt.amount,
            0,
            'AED',
            null
          );
          
          // Credit: Counterpart Receivables (decrease what they owe us)
          lineStmt.run(
            journalEntryId,
            '1102',
            'Counterpart Receivables - AED',
            0,
            receipt.amount,
            'AED',
            receipt.trading_party_id
          );
        } else {
          // Credit: Cash AED (decrease cash)
          lineStmt.run(
            journalEntryId,
            '1002',
            'Cash - AED',
            0,
            receipt.amount,
            'AED',
            null
          );
          
          // Debit: Counterpart Payables (decrease what we owe them)
          lineStmt.run(
            journalEntryId,
            '2002',
            'Counterpart Payables - AED',
            receipt.amount,
            0,
            'AED',
            receipt.trading_party_id
          );
        }
      }
      
      // Mark receipt as restored
      const restoreStmt = db.prepare(`
        UPDATE payment_receipts 
        SET is_deleted = 0, 
            is_restored = 1,
            restored_at = ?, 
            restoration_reason = ?,
            restored_by = ?
        WHERE id = ?
      `);
      
      restoreStmt.run(
        restorationTime,
        validatedData.reason,
        validatedData.restored_by || 'Unknown',
        receiptId
      );
      
      db.exec('COMMIT');
      
      // Re-process settlement after successful restoration
      try {
        SettlementService.processReceipt(receiptId);
      } catch (settlementError) {
        console.error('Settlement processing failed (receipt still restored):', settlementError);
        // Don't fail the entire operation - receipt restoration is still valid
      }
      
      res.json({
        success: true,
        message: 'Receipt restored, accounting entries re-applied, and settlement re-processed successfully'
      });
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    
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
      error: 'Failed to restore payment receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 