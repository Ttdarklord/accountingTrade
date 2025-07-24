import express from 'express';
import db from '../database/connection';
import { DashboardData } from '../types';

const router = express.Router();

// GET /api/dashboard - Get dashboard data
router.get('/', async (req, res) => {
    try {
    // Calculate company balances from journal entries (Cash accounts)
    const balanceQuery = db.prepare(`
      SELECT 
        jel.currency,
        SUM(CASE WHEN jel.account_code = '1001' THEN jel.debit_amount - jel.credit_amount ELSE 0 END) as toman_balance,
        SUM(CASE WHEN jel.account_code = '1002' THEN jel.debit_amount - jel.credit_amount ELSE 0 END) as aed_balance,
        SUM(CASE WHEN jel.account_code = '1003' THEN jel.debit_amount - jel.credit_amount ELSE 0 END) as toman_safe,
        SUM(CASE WHEN jel.account_code = '1004' THEN jel.debit_amount - jel.credit_amount ELSE 0 END) as aed_safe
      FROM journal_entry_lines jel
      WHERE jel.account_code IN ('1001', '1002', '1003', '1004')
      GROUP BY jel.currency
    `).all() as any[];
    
    // Format balances for dashboard
    const balances = [];
    const tomanRow = balanceQuery.find(row => row.currency === 'TOMAN');
    const aedRow = balanceQuery.find(row => row.currency === 'AED');
    
    balances.push({
      id: 1,
      currency: 'TOMAN' as const,
      balance: Number(tomanRow?.toman_balance || 0),
      safe_balance: Number(tomanRow?.toman_safe || 0),
      updated_at: new Date().toISOString()
    });
    
    balances.push({
      id: 2,
      currency: 'AED' as const,
      balance: Number(aedRow?.aed_balance || 0),
      safe_balance: Number(aedRow?.aed_safe || 0),
      updated_at: new Date().toISOString()
    });
    
    // Get pending trades
    const pendingTrades = db.prepare(`
      SELECT t.*, tp.name as counterparty_name
      FROM trades t
      LEFT JOIN trading_parties tp ON t.counterparty_id = tp.id
      WHERE t.status = 'PENDING'
      ORDER BY t.created_at DESC
      LIMIT 10
    `).all() as any[];
    
    // Get outstanding positions
    const outstandingPositions = db.prepare(`
      SELECT tp.*, t.trade_number, t.trade_date
      FROM trade_positions tp
      JOIN trades t ON tp.original_trade_id = t.id
      WHERE tp.remaining_amount > 0
      ORDER BY tp.created_at ASC
    `).all() as any[];
    
    // Get recent transactions
    const recentTransactions = db.prepare(`
      SELECT t.*, tp.name as counterparty_name
      FROM trades t
      LEFT JOIN trading_parties tp ON t.counterparty_id = tp.id
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all() as any[];
    
    // Calculate profit summary
    const profitSummary = db.prepare(`
      SELECT 
        SUM(profit_toman) as total_profit_toman,
        SUM(profit_aed) as total_profit_aed,
        SUM(CASE WHEN DATE(created_at) >= DATE('now', 'start of month') THEN profit_toman ELSE 0 END) as monthly_profit_toman,
        SUM(CASE WHEN DATE(created_at) >= DATE('now', 'start of month') THEN profit_aed ELSE 0 END) as monthly_profit_aed
      FROM trades
      WHERE status IN ('PENDING', 'COMPLETED', 'PARTIAL')
    `).get() as any;

    // Get trade status counts
    const tradeStatusCounts = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'PARTIAL' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count
      FROM trades
    `).get() as any;

    const dashboardData: DashboardData = {
      balances,
      pending_trades: pendingTrades,
      outstanding_positions: outstandingPositions,
      recent_transactions: recentTransactions,
      profit_summary: {
        total_profit_toman: (profitSummary?.total_profit_toman as number) || 0,
        total_profit_aed: (profitSummary?.total_profit_aed as number) || 0,
        monthly_profit_toman: (profitSummary?.monthly_profit_toman as number) || 0,
        monthly_profit_aed: (profitSummary?.monthly_profit_aed as number) || 0
      },
      trade_status_counts: {
        pending_count: (tradeStatusCounts?.pending_count as number) || 0,
        partial_count: (tradeStatusCounts?.partial_count as number) || 0,
        completed_count: (tradeStatusCounts?.completed_count as number) || 0
      }
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 