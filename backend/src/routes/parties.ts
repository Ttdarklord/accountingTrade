import express from 'express';
import db from '../database/connection';
import { TradingParty } from '../types';
import { z } from 'zod';

const router = express.Router();

const createPartySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  national_id: z.string().optional(),
  notes: z.string().optional()
});

const updatePartySchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  national_id: z.string().optional(),
  notes: z.string().optional()
});

// GET /api/parties - Get all trading parties
router.get('/', async (req, res) => {
  try {
    const parties = db.prepare('SELECT * FROM trading_parties ORDER BY name').all() as TradingParty[];
    
    res.json({
      success: true,
      data: parties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading parties',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/parties/:id - Get trading party by ID
router.get('/:id', async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid party ID'
      });
    }
    
    const party = db.prepare('SELECT * FROM trading_parties WHERE id = ?').get(partyId) as TradingParty;
    
    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Trading party not found'
      });
    }
    
    res.json({
      success: true,
      data: party
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading party',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/parties - Create new trading party
router.post('/', async (req, res) => {
  try {
    const validatedData = createPartySchema.parse(req.body);
    
    const insertParty = db.prepare(`
      INSERT INTO trading_parties (name, phone, email, national_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = insertParty.run(
      validatedData.name,
      validatedData.phone || null,
      validatedData.email || null,
      validatedData.national_id || null,
      validatedData.notes || null
    );
    
    const newParty = db.prepare('SELECT * FROM trading_parties WHERE id = ?').get(result.lastInsertRowid) as TradingParty;
    
    res.status(201).json({
      success: true,
      data: newParty,
      message: 'Trading party created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create trading party',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/parties/:id - Update trading party
router.put('/:id', async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid party ID'
      });
    }
    
    const validatedData = updatePartySchema.parse(req.body);
    
    // Check if party exists
    const existingParty = db.prepare('SELECT id FROM trading_parties WHERE id = ?').get(partyId);
    if (!existingParty) {
      return res.status(404).json({
        success: false,
        error: 'Trading party not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (validatedData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(validatedData.name);
    }
    if (validatedData.phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(validatedData.phone);
    }
    if (validatedData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(validatedData.email);
    }
    if (validatedData.national_id !== undefined) {
      updateFields.push('national_id = ?');
      updateValues.push(validatedData.national_id);
    }
    if (validatedData.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(validatedData.notes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    updateValues.push(partyId);
    
    const updateQuery = `UPDATE trading_parties SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...updateValues);
    
    const updatedParty = db.prepare('SELECT * FROM trading_parties WHERE id = ?').get(partyId) as TradingParty;
    
    res.json({
      success: true,
      data: updatedParty,
      message: 'Trading party updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update trading party',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/parties/:id - Delete trading party
router.delete('/:id', async (req, res) => {
  try {
    const partyId = parseInt(req.params.id);
    if (isNaN(partyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid party ID'
      });
    }
    
    // Check if party exists
    const existingParty = db.prepare('SELECT id FROM trading_parties WHERE id = ?').get(partyId);
    if (!existingParty) {
      return res.status(404).json({
        success: false,
        error: 'Trading party not found'
      });
    }
    
    // Check if party is used in any trades
    const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades WHERE counterparty_id = ?').get(partyId) as { count: number };
    if (tradeCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete trading party that has associated trades',
        details: `This party is associated with ${tradeCount.count} trade(s)`
      });
    }
    
    db.prepare('DELETE FROM trading_parties WHERE id = ?').run(partyId);
    
    res.json({
      success: true,
      message: 'Trading party deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete trading party',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 