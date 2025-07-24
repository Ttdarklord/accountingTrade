export declare class SettlementService {
    /**
     * Process a payment receipt and apply it to relevant trades
     */
    static processReceipt(receiptId: number): {
        success: boolean;
        message: string;
    };
    /**
     * Process an AED receipt
     */
    private static processAedReceipt;
    /**
     * Process a TOMAN receipt
     */
    private static processTomanReceipt;
    /**
     * Apply settlement to a specific counterparty
     */
    private static applySettlementToCounterparty;
    /**
     * Record a settlement in the database
     */
    private static recordSettlement;
    /**
     * Update trade settlement amounts and status
     */
    private static updateTradeSettlement;
    /**
     * Reprocess all receipts to rebuild settlement data
     */
    static reprocessAllReceipts(): {
        success: boolean;
        message: string;
    };
}
//# sourceMappingURL=settlementService.d.ts.map