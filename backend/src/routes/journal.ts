import express, { Request, Response } from 'express';
import { db } from '../database/connection';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference?: string;
  lines?: JournalEntryLine[];
}

interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
}

/**
 * GET /api/journal - Get journal entries
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const entries = db.prepare(`
      SELECT * FROM journal_entries 
      ORDER BY date DESC, id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as JournalEntry[];
    
    // Get lines for each entry
    for (const entry of entries) {
      const lines = db.prepare(`
        SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?
      `).all(entry.id) as JournalEntryLine[];
      entry.lines = lines;
    }
    
    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entries'
    });
  }
});

/**
 * GET /api/journal/:id - Get specific journal entry
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    const entry = db.prepare(`
      SELECT * FROM journal_entries WHERE id = ?
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
    entry.lines = lines;
    
    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journal entry'
    });
  }
});

export default router; 