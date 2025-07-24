import { db } from '../database/connection';
import { Currency, Trade } from '../types';

interface TradeBucket {
  tradeId: number;
  tradeNumber: string;
  size: number; // Total amount required
  fill: number; // Current amount filled
  createdAt: string;
}

interface PaymentEvent {
  receiptId: number;
  amount: number; // Positive = payment in, Negative = payment out/reversed
  receiptDate: string;
  createdAt: string;
  isDeleted: boolean;
}

interface CounterpartyProgressResult {
  counterpartyId: number;
  currency: Currency;
  tradeProgress: Map<number, number>; // tradeId -> progress (0-1)
}

export class SettlementProgressService {
  /**
   * Calculate settlement progress for all trades using bucket-and-pour algorithm
   * This is completely stateless and recalculated every time
   */
  static calculateProgressForTrades(trades: Trade[]): Map<number, { progressAED: number; progressTOMAN: number }> {
    const result = new Map<number, { progressAED: number; progressTOMAN: number }>();
    
    // Initialize all trades with 0% progress
    trades.forEach(trade => {
      result.set(trade.id, { progressAED: 0, progressTOMAN: 0 });
    });
    
    // Process each trade individually to handle directional payments correctly
    trades.forEach(trade => {
      if (!trade.counterparty_id) return; // Skip trades without counterparty
      
      // Calculate progress for each currency based on this specific trade's obligations
      const aedProgress = this.calculateProgressForTradeAndCurrency(trade, 'AED');
      const tomanProgress = this.calculateProgressForTradeAndCurrency(trade, 'TOMAN');
      
      result.set(trade.id, { 
        progressAED: aedProgress, 
        progressTOMAN: tomanProgress 
      });
    });
    
    return result;
  }
  
  /**
   * Calculate progress for a specific trade and currency combination
   */
  private static calculateProgressForTradeAndCurrency(trade: Trade, currency: Currency): number {
    // Determine the trade's obligation in this currency
    const obligation = this.getTradeObligationForCurrency(trade, currency);
    if (obligation.amount === 0) return 0; // No obligation in this currency
    
    // Get all payments for this counterparty-currency combination
    const payments = this.getPaymentEventsForCounterparty(trade.counterparty_id!, currency);
    
    // Apply payments to this specific trade using FIFO logic
    const settlement = this.calculateTradeSettlement(trade, currency, obligation, payments);
    
    // Calculate progress percentage
    return Math.min(Math.max(settlement / obligation.amount, 0), 1); // Clamp between 0% and 100%
  }
  
  /**
   * Determine what this trade obligates in a specific currency
   */
  private static getTradeObligationForCurrency(trade: Trade, currency: Currency): { 
    amount: number; 
    direction: 'we_owe_them' | 'they_owe_us' 
  } {
    if (trade.trade_type === 'BUY') {
      if (currency === trade.base_currency) {
        // BUY trade: Counterparty owes us the base currency (AED)
        return { amount: trade.amount, direction: 'they_owe_us' };
      } else if (currency === trade.quote_currency) {
        // BUY trade: We owe counterparty the quote currency (TOMAN)
        return { amount: trade.total_value, direction: 'we_owe_them' };
      }
    } else if (trade.trade_type === 'SELL') {
      if (currency === trade.base_currency) {
        // SELL trade: We owe counterparty the base currency (AED)
        return { amount: trade.amount, direction: 'we_owe_them' };
      } else if (currency === trade.quote_currency) {
        // SELL trade: Counterparty owes us the quote currency (TOMAN)
        return { amount: trade.total_value, direction: 'they_owe_us' };
      }
    }
    
    return { amount: 0, direction: 'they_owe_us' }; // No obligation
  }
  
  /**
   * Get payment events for a counterparty-currency combination
   */
  private static getPaymentEventsForCounterparty(counterpartyId: number, currency: Currency): PaymentEvent[] {
    let query = '';
    let params: any[] = [];
    
    if (currency === 'TOMAN') {
      query = `
        SELECT 
          id as receiptId,
          amount,
          receipt_date as receiptDate,
          created_at as createdAt,
          is_deleted as isDeleted,
          payer_id,
          receiver_account_id
        FROM payment_receipts 
        WHERE currency = 'TOMAN' 
        AND (
          payer_id = ? 
          OR receiver_account_id IN (
            SELECT id FROM bank_accounts WHERE counterpart_id = ?
          )
        )
        ORDER BY receipt_date ASC, created_at ASC
      `;
      params = [counterpartyId, counterpartyId];
    } else {
      query = `
        SELECT 
          id as receiptId,
          amount,
          receipt_date as receiptDate,
          created_at as createdAt,
          is_deleted as isDeleted,
          receipt_type,
          trading_party_id
        FROM payment_receipts 
        WHERE currency = 'AED' 
        AND trading_party_id = ?
        ORDER BY receipt_date ASC, created_at ASC
      `;
      params = [counterpartyId];
    }
    
    const rawEvents = db.prepare(query).all(...params) as any[];
    const events: PaymentEvent[] = [];
    
    rawEvents.forEach(event => {
      let netAmount = 0;
      
      if (currency === 'TOMAN') {
        if (event.payer_id === counterpartyId) {
          // Counterparty paid us TOMAN
          netAmount = event.amount;
        } else {
          // We paid counterparty TOMAN  
          netAmount = -event.amount;
        }
      } else {
        if (event.receipt_type === 'receive') {
          // We received AED from counterparty
          netAmount = event.amount;
        } else {
          // We paid AED to counterparty
          netAmount = -event.amount;
        }
      }
      
      // Handle deleted receipts
      if (event.isDeleted) {
        netAmount = -netAmount;
      }
      
      if (netAmount !== 0) {
        events.push({
          receiptId: event.receiptId,
          amount: netAmount,
          receiptDate: event.receiptDate,
          createdAt: event.createdAt,
          isDeleted: event.isDeleted
        });
      }
    });
    
    return events;
  }
  
  /**
   * Calculate settlement for a specific trade based on its obligations and payment history
   */
  private static calculateTradeSettlement(
    trade: Trade,
    currency: Currency, 
    obligation: { amount: number; direction: 'we_owe_them' | 'they_owe_us' },
    payments: PaymentEvent[]
  ): number {
    // Get all trades for this counterparty in chronological order (for FIFO)
    const allTrades = db.prepare(`
      SELECT * FROM trades 
      WHERE counterparty_id = ? 
      ORDER BY created_at ASC
    `).all(trade.counterparty_id) as Trade[];
    
    // Find position of this trade in the FIFO queue
    const tradeIndex = allTrades.findIndex(t => t.id === trade.id);
    if (tradeIndex === -1) return 0;
    
    // Calculate net settlement for this obligation type
    let netSettlement = 0;
    
    // Apply payments chronologically - calculate net effect based on obligation direction
    for (const payment of payments) {
      if (obligation.direction === 'they_owe_us') {
        // They owe us money - positive payments reduce their debt, negative payments increase their debt
        netSettlement += payment.amount; // Net effect: +payment.amount
      } else {
        // We owe them money - negative payments reduce our debt, positive payments increase our debt  
        netSettlement += -payment.amount; // Net effect: -payment.amount (flip the sign)
      }
    }
    
    // Ensure net settlement is non-negative for progress calculation
    if (netSettlement < 0) {
      return 0; // Negative settlement means the debt increased rather than decreased
    }
    
    // Apply FIFO logic: settlement goes to earlier trades first
    let availableSettlement = netSettlement;
    
    for (let i = 0; i < tradeIndex; i++) {
      const earlierTrade = allTrades[i];
      // Get the obligation for the earlier trade in the same currency
      const earlierObligation = this.getTradeObligationForCurrency(earlierTrade, currency);
      
      if (earlierObligation.direction === obligation.direction && earlierObligation.amount > 0) {
        // This earlier trade has the same type of obligation
        const settlementUsedByEarlierTrade = Math.min(availableSettlement, earlierObligation.amount);
        availableSettlement -= settlementUsedByEarlierTrade;
      }
    }
    
    // Whatever settlement remains goes to this trade
    return Math.min(availableSettlement, obligation.amount);
  }
} 