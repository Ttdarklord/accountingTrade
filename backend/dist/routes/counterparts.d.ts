import { Currency } from '../types';
declare const router: import("express-serve-static-core").Router;
export declare function updateCounterpartBalance(counterpartId: number, currency: Currency, amount: number, // positive for credit, negative for debit
transactionType: 'BUY' | 'SELL' | 'RECEIPT', description: string, transactionDate: string, tradeId?: number, receiptId?: number, useOwnTransaction?: boolean): {
    success: boolean;
    previousBalance: number;
    newBalance: number;
    amount: number;
};
export default router;
//# sourceMappingURL=counterparts.d.ts.map