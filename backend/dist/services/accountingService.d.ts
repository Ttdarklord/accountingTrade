import { Currency, JournalEntry, JournalEntryWithLines } from '../types';
export declare class AccountingService {
    /**
     * Create journal entry for a currency purchase
     * When buying AED with Toman:
     * - Debit: Currency Inventory - AED (Asset)
     * - Credit: Accounts Payable - Toman (Liability) or Cash - Toman (Asset)
     */
    static createPurchaseEntry(tradeId: number, amount: number, baseCurrency: Currency, rate: number, totalValue: number, entryDate: string): JournalEntry;
    /**
     * Create journal entry for a currency sale
     * When selling AED for Toman:
     * - Debit: Accounts Receivable - Toman (Asset) or Cash - Toman (Asset)
     * - Credit: Currency Inventory - AED (Asset)
     * - If profitable: Credit: Trading Revenue - Currency Exchange (Revenue)
     */
    static createSaleEntry(tradeId: number, amount: number, baseCurrency: Currency, rate: number, totalValue: number, costBasis: number, profit: number, entryDate: string): JournalEntry;
    /**
     * Create journal entry for payment made
     */
    static createPaymentEntry(paymentId: number, amount: number, currency: Currency, isOutgoing: boolean, entryDate: string): JournalEntry;
    /**
     * Get journal entry with lines
     */
    static getJournalEntry(journalEntryId: number): JournalEntryWithLines;
    /**
     * Update company balances
     */
    static updateCompanyBalance(currency: Currency, amount: number, isSafeBalance?: boolean): void;
    /**
     * Get account balances summary
     */
    static getAccountBalances(): unknown[];
}
//# sourceMappingURL=accountingService.d.ts.map