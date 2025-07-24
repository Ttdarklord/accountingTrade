import express from 'express';
import db from '../database/connection';
import { AccountingService } from '../services/accountingService';

const router = express.Router();

// GET /api/journal/entries - Get journal entries
router.get('/entries', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const entries = db.prepare(`
      SELECT je.*, t.trade_number
      FROM journal_entries je
      LEFT JOIN trades t ON je.trade_id = t.id
      ORDER BY je.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    // Get lines for each entry
    for (const entry of entries) {
      const lines = db.prepare(`
        SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
      `).all(entry.id);
      entry.lines = lines;
    }
    
    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/journal/balances - Get account balances
router.get('/balances', async (req, res) => {
  try {
    const balances = AccountingService.getAccountBalances();
    
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 