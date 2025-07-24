import { Trade } from '../types';
export declare class SettlementProgressService {
    /**
     * Calculate settlement progress for all trades using bucket-and-pour algorithm
     * This is completely stateless and recalculated every time
     */
    static calculateProgressForTrades(trades: Trade[]): Map<number, {
        progressAED: number;
        progressTOMAN: number;
    }>;
    /**
     * Calculate progress for a specific trade and currency combination
     */
    private static calculateProgressForTradeAndCurrency;
    /**
     * Determine what this trade obligates in a specific currency
     */
    private static getTradeObligationForCurrency;
    /**
     * Get payment events for a counterparty-currency combination
     */
    private static getPaymentEventsForCounterparty;
    /**
     * Calculate settlement for a specific trade based on its obligations and payment history
     */
    private static calculateTradeSettlement;
}
//# sourceMappingURL=settlementProgressService.d.ts.map