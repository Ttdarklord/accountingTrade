"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeService = void 0;
const connection_1 = __importDefault(require("../database/connection"));
const accountingService_1 = require("./accountingService");
const settlementProgressService_1 = require("./settlementProgressService");
const counterparts_1 = require("../routes/counterparts");
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
class TradeService {
    /**
     * Create a new trade (buy, sell, or combined buy-sell)
     */
    static createTrade(request) {
        const tradeNumber = `TRD-${(0, date_fns_1.format)(new Date(), 'yyyyMMdd')}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const totalValue = request.amount * request.rate;
        const insertTrade = connection_1.default.prepare(`
      INSERT INTO trades (
        trade_number, trade_type, base_currency, quote_currency, amount, rate, 
        total_value, counterparty_id, trade_date, settlement_date_base, 
        settlement_date_quote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = insertTrade.run(tradeNumber, request.trade_type, request.base_currency, request.quote_currency, request.amount, request.rate, totalValue, request.counterparty_id || null, request.trade_date, request.settlement_date_base, request.settlement_date_quote);
        const tradeId = result.lastInsertRowid;
        // Create accounting entries based on trade type
        if (request.trade_type === 'BUY') {
            // Create purchase journal entry
            accountingService_1.AccountingService.createPurchaseEntry(tradeId, request.amount, request.base_currency, request.rate, totalValue, request.trade_date || new Date().toISOString().split('T')[0]);
            // Create trade position for future sales
            this.createTradePosition(tradeId, request.base_currency, request.amount, request.rate);
        }
        else if (request.trade_type === 'SELL') {
            // For sell orders, we need to match against existing positions
            const positions = this.getAvailablePositions(request.base_currency);
            const { profit, costBasis } = this.calculateProfitFromPositions(positions, request.amount, request.rate);
            // Update the trade with profit information
            const updateProfit = connection_1.default.prepare(`
        UPDATE trades SET 
          profit_toman = CASE WHEN quote_currency = 'TOMAN' THEN ? ELSE profit_toman END,
          profit_aed = CASE WHEN quote_currency = 'AED' THEN ? ELSE profit_aed END
        WHERE id = ?
      `);
            updateProfit.run(profit, profit, tradeId);
            // Create sale journal entry
            accountingService_1.AccountingService.createSaleEntry(tradeId, request.amount, request.base_currency, request.rate, totalValue, costBasis, profit, request.trade_date || new Date().toISOString().split('T')[0]);
            // Reduce positions
            this.reducePositions(request.base_currency, request.amount);
        }
        else if (request.trade_type === 'BUY_SELL') {
            // Handle simultaneous buy-sell transaction
            accountingService_1.AccountingService.createPurchaseEntry(tradeId, request.amount, request.base_currency, request.rate, totalValue, request.trade_date || new Date().toISOString().split('T')[0]);
            // Mark trade as completed since it's a simultaneous transaction
            const updateStatus = connection_1.default.prepare(`UPDATE trades SET status = 'COMPLETED' WHERE id = ?`);
            updateStatus.run(tradeId);
        }
        // Update counterpart balances if counterparty is specified
        if (request.counterparty_id) {
            const tradeDate = request.trade_date || new Date().toISOString().split('T')[0];
            const shortTradeId = tradeNumber.slice(-5);
            if (request.trade_type === 'BUY') {
                (0, counterparts_1.updateCounterpartBalance)(request.counterparty_id, 'TOMAN', totalValue, 'BUY', `BUY ${request.amount.toLocaleString()} ${request.base_currency} @ ${request.rate.toLocaleString()} (#${shortTradeId})`, tradeDate, tradeId, undefined, true);
                (0, counterparts_1.updateCounterpartBalance)(request.counterparty_id, 'AED', -request.amount, 'BUY', `BUY ${request.amount.toLocaleString()} ${request.base_currency} @ ${request.rate.toLocaleString()} (#${shortTradeId})`, tradeDate, tradeId, undefined, true);
            }
            else if (request.trade_type === 'SELL') {
                (0, counterparts_1.updateCounterpartBalance)(request.counterparty_id, 'AED', request.amount, 'SELL', `SELL ${request.amount.toLocaleString()} ${request.base_currency} @ ${request.rate.toLocaleString()} (#${shortTradeId})`, tradeDate, tradeId, undefined, true);
                (0, counterparts_1.updateCounterpartBalance)(request.counterparty_id, 'TOMAN', -totalValue, 'SELL', `SELL ${request.amount.toLocaleString()} ${request.base_currency} @ ${request.rate.toLocaleString()} (#${shortTradeId})`, tradeDate, tradeId, undefined, true);
            }
        }
        return this.getTradeById(tradeId);
    }
    /**
     * Get trades with comprehensive filtering and bucket-and-pour progress calculation
     */
    static getTrades(limit = 50, offset = 0, counterpartyId, status, baseCurrency, quoteCurrency, startDate, endDate) {
        let whereConditions = ['1=1'];
        let params = [];
        if (counterpartyId) {
            whereConditions.push('t.counterparty_id = ?');
            params.push(counterpartyId);
        }
        if (status) {
            whereConditions.push('t.status = ?');
            params.push(status);
        }
        if (baseCurrency) {
            whereConditions.push('t.base_currency = ?');
            params.push(baseCurrency);
        }
        if (quoteCurrency) {
            whereConditions.push('t.quote_currency = ?');
            params.push(quoteCurrency);
        }
        if (startDate) {
            whereConditions.push('t.trade_date >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereConditions.push('t.trade_date <= ?');
            params.push(endDate);
        }
        const whereClause = whereConditions.join(' AND ');
        // Count total matching trades
        const countQuery = `SELECT COUNT(*) as count FROM trades t WHERE ${whereClause}`;
        const countResult = connection_1.default.prepare(countQuery).get(...params);
        // Fetch trades with counterpart information
        const tradesQuery = connection_1.default.prepare(`
      SELECT 
        t.*,
        tp.name as counterparty_name
      FROM trades t
      LEFT JOIN trading_parties tp ON t.counterparty_id = tp.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);
        const rawTrades = tradesQuery.all(...params, limit, offset);
        // Apply bucket-and-pour progress calculation
        const tradesWithProgress = this.applyProgressCalculation(rawTrades);
        return { trades: tradesWithProgress, total: countResult.count };
    }
    /**
     * Get trade by ID with bucket-and-pour progress calculation
     */
    static getTradeById(id) {
        const rawTrade = connection_1.default.prepare(`
      SELECT 
        t.*,
        tp.name as counterparty_name
      FROM trades t
      LEFT JOIN trading_parties tp ON t.counterparty_id = tp.id
      WHERE t.id = ?
    `).get(id);
        if (!rawTrade) {
            throw new Error(`Trade with ID ${id} not found`);
        }
        // Apply bucket-and-pour progress calculation
        const tradesWithProgress = this.applyProgressCalculation([rawTrade]);
        return tradesWithProgress[0];
    }
    /**
     * Apply bucket-and-pour progress calculation to trades
     */
    static applyProgressCalculation(trades) {
        // Get progress calculations for all trades using bucket-and-pour algorithm
        const progressMap = settlementProgressService_1.SettlementProgressService.calculateProgressForTrades(trades);
        // Apply progress to trades
        return trades.map(trade => {
            const progress = progressMap.get(trade.id);
            return {
                ...trade,
                progressAED: progress?.progressAED || 0,
                progressTOMAN: progress?.progressTOMAN || 0
            };
        });
    }
    /**
     * Create a trade position for tracking future sales
     */
    static createTradePosition(tradeId, currency, amount, rate) {
        const insertPosition = connection_1.default.prepare(`
      INSERT INTO trade_positions (original_trade_id, currency, original_amount, remaining_amount, average_cost_rate, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        insertPosition.run(tradeId, currency, amount, amount, rate);
    }
    /**
     * Get available positions for selling
     */
    static getAvailablePositions(currency) {
        const query = connection_1.default.prepare(`
      SELECT * FROM trade_positions 
      WHERE currency = ? AND remaining_amount > 0 
      ORDER BY created_at ASC
    `);
        return query.all(currency);
    }
    /**
     * Calculate profit from selling positions using FIFO
     */
    static calculateProfitFromPositions(positions, sellAmount, sellRate) {
        let totalCostBasis = 0;
        let remainingToSell = sellAmount;
        for (const position of positions) {
            if (remainingToSell <= 0)
                break;
            const amountFromThisPosition = Math.min(remainingToSell, position.remaining_amount);
            totalCostBasis += amountFromThisPosition * position.average_cost_rate;
            remainingToSell -= amountFromThisPosition;
        }
        const totalRevenue = sellAmount * sellRate;
        const profit = totalRevenue - totalCostBasis;
        return { profit, costBasis: totalCostBasis };
    }
    /**
     * Reduce position amounts after sale (FIFO)
     */
    static reducePositions(currency, amount) {
        const positions = this.getAvailablePositions(currency);
        let remainingToReduce = amount;
        const updatePosition = connection_1.default.prepare(`
      UPDATE trade_positions 
      SET remaining_amount = ? 
      WHERE id = ?
    `);
        for (const position of positions) {
            if (remainingToReduce <= 0)
                break;
            const amountFromThisPosition = Math.min(remainingToReduce, position.remaining_amount);
            const newRemainingAmount = position.remaining_amount - amountFromThisPosition;
            updatePosition.run(newRemainingAmount, position.id);
            remainingToReduce -= amountFromThisPosition;
        }
    }
    /**
     * Sell from a specific position
     */
    static sellFromPosition(request) {
        // Get the specific position
        const position = connection_1.default.prepare('SELECT * FROM trade_positions WHERE id = ?').get(request.position_id);
        if (!position) {
            throw new Error('Position not found');
        }
        if (position.remaining_amount < request.amount) {
            throw new Error('Insufficient amount in position');
        }
        // Create the sell trade with reference to the position
        const tradeRequest = {
            trade_type: 'SELL',
            base_currency: position.currency,
            quote_currency: position.currency === 'AED' ? 'TOMAN' : 'AED', // Auto-determine quote currency
            amount: request.amount,
            rate: request.rate,
            counterparty_id: request.counterparty_id,
            trade_date: request.trade_date || new Date().toISOString().split('T')[0],
            settlement_date_base: request.settlement_date_base || new Date().toISOString().split('T')[0],
            settlement_date_quote: request.settlement_date_quote || new Date().toISOString().split('T')[0],
            sell_from_position_id: request.position_id
        };
        const trade = this.createTrade(tradeRequest);
        // Manually reduce the specific position
        const newRemainingAmount = position.remaining_amount - request.amount;
        connection_1.default.prepare('UPDATE trade_positions SET remaining_amount = ? WHERE id = ?')
            .run(newRemainingAmount, request.position_id);
        return trade;
    }
    /**
     * Get outstanding positions
     */
    static getOutstandingPositions() {
        const query = connection_1.default.prepare(`
      SELECT tp.*, t.trade_number, t.trade_date
      FROM trade_positions tp
      JOIN trades t ON tp.original_trade_id = t.id
      WHERE tp.remaining_amount > 0
      ORDER BY tp.created_at ASC
    `);
        return query.all();
    }
}
exports.TradeService = TradeService;
//# sourceMappingURL=tradeService.js.map