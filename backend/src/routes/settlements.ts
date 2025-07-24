import express from 'express';
import { SettlementService } from '../services/settlementService';

const router = express.Router();

// GET /api/settlements/summary - Get settlement summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const summary = SettlementService.getSettlementSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settlement summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/settlements/trade/:id - Get settlement progress for a specific trade
router.get('/trade/:id', async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id);
    
    if (isNaN(tradeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade ID'
      });
    }
    
    const progress = SettlementService.getTradeSettlementProgress(tradeId);
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Trade not found') {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trade settlement progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/settlements/process/:receiptId - Manually trigger settlement processing for a receipt
router.post('/process/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt ID'
      });
    }
    
    SettlementService.processReceiptSettlement(receiptId);
    
    res.json({
      success: true,
      message: 'Settlement processing completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process settlement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/settlements/reverse/:receiptId - Manually reverse settlement for a receipt
router.delete('/reverse/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt ID'
      });
    }
    
    SettlementService.reverseReceiptSettlement(receiptId);
    
    res.json({
      success: true,
      message: 'Settlement reversal completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reverse settlement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/settlements/reprocess - Reprocess all receipts for settlement
router.post('/reprocess', async (req, res) => {
  try {
    SettlementService.reprocessAllReceipts();
    
    res.json({
      success: true,
      message: 'All receipts reprocessed for settlement'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reprocess receipts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 