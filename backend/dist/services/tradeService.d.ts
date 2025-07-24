import { Trade, TradePosition, CreateTradeRequest, SellFromPositionRequest, Currency } from '../types';
export declare class TradeService {
    /**
     * Create a new trade (buy, sell, or combined buy-sell)
     */
    static createTrade(request: CreateTradeRequest): Trade;
    /**
     * Get trades with comprehensive filtering and bucket-and-pour progress calculation
     */
    static getTrades(limit?: number, offset?: number, counterpartyId?: number, status?: string, baseCurrency?: Currency, quoteCurrency?: Currency, startDate?: string, endDate?: string): {
        trades: Trade[];
        total: number;
    };
    /**
     * Get trade by ID with bucket-and-pour progress calculation
     */
    static getTradeById(id: number): Trade;
    /**
     * Apply bucket-and-pour progress calculation to trades
     */
    private static applyProgressCalculation;
    /**
     * Create a trade position for tracking future sales
     */
    private static createTradePosition;
    /**
     * Get available positions for selling
     */
    private static getAvailablePositions;
    /**
     * Calculate profit from selling positions using FIFO
     */
    private static calculateProfitFromPositions;
    /**
     * Reduce position amounts after sale (FIFO)
     */
    private static reducePositions;
    /**
     * Sell from a specific position
     */
    static sellFromPosition(request: SellFromPositionRequest): Trade;
    /**
     * Get outstanding positions
     */
    static getOutstandingPositions(): TradePosition[];
}
//# sourceMappingURL=tradeService.d.ts.map