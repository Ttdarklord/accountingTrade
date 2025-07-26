import express from 'express';
import db from '../database/connection';
import { JournalEntry, JournalEntryLine } from '../types';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/journal/entries - Get journal entries
 */
router.get('/entries', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const entries = db.prepare(`
      SELECT je.*, t.trade_number 
      FROM journal_entries je
      LEFT JOIN trades t ON je.trade_id = t.id
      ORDER BY je.entry_date DESC, je.id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as JournalEntry[];
    
    // Get lines for each entry
    for (const entry of entries) {
      const lines = db.prepare(`
        SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
      `).all(entry.id) as JournalEntryLine[];
      (entry as any).lines = lines;
    }
    
    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries'
    });
  }
});

/**
 * GET /api/journal/balances - Get account balances
 */
router.get('/balances', requireAuth, async (req, res) => {
  try {
    // Calculate balances from journal entry lines
    const balanceData = db.prepare(`
      SELECT 
        jel.account_code,
        jel.account_name,
        jel.currency,
        SUM(jel.debit_amount - jel.credit_amount) as balance
      FROM journal_entry_lines jel
      GROUP BY jel.account_code, jel.account_name, jel.currency
      HAVING SUM(jel.debit_amount - jel.credit_amount) != 0
      ORDER BY jel.account_code, jel.currency
    `).all() as any[];
    
    const balances = balanceData.map((row, index) => ({
      id: index + 1,
      account_code: row.account_code,
      account_name: row.account_name,
      currency: row.currency,
      balance: Number(row.balance) || 0,
      updated_at: new Date().toISOString()
    }));
    
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    console.error('Error fetching account balances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account balances'
    });
  }
});

/**
 * GET /api/journal - Get journal entries (legacy endpoint)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const entries = db.prepare(`
      SELECT je.*, t.trade_number 
      FROM journal_entries je
      LEFT JOIN trades t ON je.trade_id = t.id
      ORDER BY je.entry_date DESC, je.id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as JournalEntry[];
    
    // Get lines for each entry
    for (const entry of entries) {
      const lines = db.prepare(`
        SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
      `).all(entry.id) as JournalEntryLine[];
      (entry as any).lines = lines;
    }
    
    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries'
    });
  }
});

/**
 * GET /api/journal/:id - Get specific journal entry
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const entry = db.prepare(`
      SELECT je.*, t.trade_number 
      FROM journal_entries je
      LEFT JOIN trades t ON je.trade_id = t.id
      WHERE je.id = ?
    `).get(id) as JournalEntry | undefined;
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Journal entry not found'
      });
    }
    
    const lines = db.prepare(`
      SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
    `).all(id) as JournalEntryLine[];
    (entry as any).lines = lines;
    
    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entry'
    });
  }
});

export default router; 