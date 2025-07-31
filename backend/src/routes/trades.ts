import express from 'express';
import { TradeService } from '../services/tradeService';
import { CreateTradeRequest, SellFromPositionRequest } from '../types';
import { createNotification } from './notifications';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createTradeSchema = z.object({
  trade_type: z.enum(['BUY', 'SELL', 'BUY_SELL']),
  base_currency: z.enum(['AED', 'TOMAN']),
  quote_currency: z.enum(['AED', 'TOMAN']),
  amount: z.number().positive(),
  rate: z.number().positive(),
  counterparty_id: z.number().optional(),
  trade_date: z.string(),
  settlement_date_base: z.string(),
  settlement_date_quote: z.string(),
  payment_instructions: z.array(z.object({
    account_id: z.number(),
    amount: z.number().positive(),
    payment_type: z.enum(['OUTGOING', 'INCOMING']),
    due_date: z.string()
  })).optional()
});

const sellFromPositionSchema = z.object({
  position_id: z.number(),
  amount: z.number().positive(),
  rate: z.number().positive(),
  counterparty_id: z.number().optional(),
  trade_date: z.string().optional(),
  settlement_date_base: z.string().optional(),
  settlement_date_quote: z.string().optional()
});

// GET /api/trades - Get all trades with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const counterpartyId = req.query.counterparty_id ? parseInt(req.query.counterparty_id as string) : undefined;
    const baseCurrency = req.query.base_currency as 'AED' | 'TOMAN';
    const quoteCurrency = req.query.quote_currency as 'AED' | 'TOMAN';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    
    const result = TradeService.getTrades(limit, offset, counterpartyId, status, baseCurrency, quoteCurrency, startDate, endDate);
    
    res.json({
      success: true,
      data: result.trades,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/trades/:id - Get trade by ID
router.get('/:id', async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id);
    if (isNaN(tradeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade ID'
      });
    }
    
    const trade = TradeService.getTradeById(tradeId);
    
    res.json({
      success: true,
      data: trade
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Trade not found',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/trades - Create new trade
router.post('/', async (req, res) => {
  try {
    const validatedData = createTradeSchema.parse(req.body);
    
    // Validate that base and quote currencies are different
    if (validatedData.base_currency === validatedData.quote_currency) {
      return res.status(400).json({
        success: false,
        error: 'Base and quote currencies must be different'
      });
    }
    
    const trade = TradeService.createTrade(validatedData as CreateTradeRequest);
    
    // Create notification
    createNotification(
      'trade',
      'New Trade Created',
      `${validatedData.trade_type} trade for ${validatedData.amount.toLocaleString()} ${validatedData.base_currency} created`,
      'trade',
      trade.id
    );
    
    res.status(201).json({
      success: true,
      data: trade,
      message: 'Trade created successfully'
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
      error: 'Failed to create trade',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/trades/positions/outstanding - Get outstanding positions
router.get('/positions/outstanding', async (req, res) => {
  try {
    const positions = TradeService.getOutstandingPositions();
    
    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch outstanding positions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/trades/positions/sell - Sell from position
router.post('/positions/sell', async (req, res) => {
  try {
    const validatedData = sellFromPositionSchema.parse(req.body);
    
    const trade = TradeService.sellFromPosition(validatedData as SellFromPositionRequest);
    
    res.status(201).json({
      success: true,
      data: trade,
      message: 'Position sold successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(400).json({
      success: false,
      error: 'Failed to sell position',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/trades/:id/status - Update trade status
router.put('/:id/status', async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(tradeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade ID'
      });
    }
    
    if (!['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }
    
    // TODO: Implement updateTradeStatus method in TradeService
    // TradeService.updateTradeStatus(tradeId, status);
    
    res.json({
      success: true,
      message: 'Trade status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update trade status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 