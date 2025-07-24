"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const connection_1 = require("../database/connection");
class SettlementService {
    /**
     * Process a payment receipt and apply it to relevant trades
     */
    static processReceipt(receiptId) {
        try {
            console.log(`Processing receipt ${receiptId}...`);
            const receipt = connection_1.db.prepare('SELECT * FROM payment_receipts WHERE id = ?').get(receiptId);
            if (!receipt) {
                throw new Error(`Receipt ${receiptId} not found`);
            }
            if (receipt.currency === 'AED') {
                this.processAedReceipt(receipt);
            }
            else if (receipt.currency === 'TOMAN') {
                this.processTomanReceipt(receipt);
            }
            console.log(`Settlement processed for receipt ${receiptId}`);
            return { success: true, message: `Settlement processed for receipt ${receiptId}` };
        }
        catch (error) {
            console.error(`Error processing receipt ${receiptId}:`, error);
            throw error;
        }
    }
    /**
     * Process an AED receipt
     */
    static processAedReceipt(receipt) {
        if (!receipt.trading_party_id) {
            console.log('AED receipt has no trading party, skipping settlement');
            return;
        }
        this.applySettlementToCounterparty(receipt, receipt.trading_party_id, receipt.amount);
    }
    /**
     * Process a TOMAN receipt
     */
    static processTomanReceipt(receipt) {
        const counterpartiesToTry = [];
        // Handle AED-style TOMAN receipts (using trading_party_id and receipt_type)
        if (receipt.trading_party_id && receipt.receipt_type) {
            counterpartiesToTry.push({ id: receipt.trading_party_id, name: 'trading_party' });
        }
        // Handle traditional TOMAN receipts (using payer_id and receiver_account_id)
        else {
            // Get receiver counterparty through bank account - PRIORITY
            if (receipt.receiver_account_id) {
                const receiverCounterparty = connection_1.db.prepare(`
          SELECT counterpart_id FROM bank_accounts WHERE id = ?
        `).get(receipt.receiver_account_id);
                if (receiverCounterparty) {
                    counterpartiesToTry.push({ id: receiverCounterparty.counterpart_id, name: 'receiver' });
                }
            }
            // Add payer as secondary option if different from receiver
            if (receipt.payer_id) {
                const receiverCounterpartId = counterpartiesToTry[0]?.id;
                if (receipt.payer_id !== receiverCounterpartId) {
                    counterpartiesToTry.push({ id: receipt.payer_id, name: 'payer' });
                }
            }
        }
        // For TOMAN receipts, both payer and receiver can be settled with the full amount
        // since the same payment represents obligations on both sides
        for (const counterparty of counterpartiesToTry) {
            this.applySettlementToCounterparty(receipt, counterparty.id, receipt.amount // Pass full amount
            );
        }
    }
    /**
     * Apply settlement to a specific counterparty
     */
    static applySettlementToCounterparty(receipt, counterpartyId, amount) {
        // Get unsettled trades for this counterparty in FIFO order
        const trades = connection_1.db.prepare(`
      SELECT * FROM trades 
      WHERE counterparty_id = ? AND status != 'COMPLETED'
      ORDER BY created_at ASC
    `).all(counterpartyId);
        let remainingAmount = amount;
        for (const trade of trades) {
            if (remainingAmount <= 0)
                break;
            // Try to settle base currency first (AED)
            if (receipt.currency === trade.base_currency) {
                const unsettledBase = trade.amount - trade.base_settled_amount;
                if (unsettledBase > 0) {
                    const settlementAmount = Math.min(remainingAmount, unsettledBase);
                    this.recordSettlement(trade.id, receipt.id, receipt.currency, settlementAmount, 'BASE');
                    this.updateTradeSettlement(trade, 'BASE', settlementAmount);
                    remainingAmount -= settlementAmount;
                }
            }
            // Try to settle quote currency (TOMAN)
            if (remainingAmount > 0 && receipt.currency === trade.quote_currency) {
                const unsettledQuote = trade.total_value - trade.quote_settled_amount;
                if (unsettledQuote > 0) {
                    const settlementAmount = Math.min(remainingAmount, unsettledQuote);
                    this.recordSettlement(trade.id, receipt.id, receipt.currency, settlementAmount, 'QUOTE');
                    this.updateTradeSettlement(trade, 'QUOTE', settlementAmount);
                    remainingAmount -= settlementAmount;
                }
            }
        }
    }
    /**
     * Record a settlement in the database
     */
    static recordSettlement(tradeId, receiptId, currency, amount, settlementType) {
        // Get the next FIFO sequence number for this trade and settlement type
        const maxSequence = connection_1.db.prepare(`
      SELECT COALESCE(MAX(fifo_sequence), 0) as max_seq 
      FROM trade_settlements 
      WHERE trade_id = ? AND settlement_type = ?
    `).get(tradeId, settlementType);
        connection_1.db.prepare(`
      INSERT INTO trade_settlements (
        trade_id, receipt_id, currency, settled_amount, 
        settlement_type, settlement_date, fifo_sequence
      ) VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?)
    `).run(tradeId, receiptId, currency, amount, settlementType, maxSequence.max_seq + 1);
    }
    /**
     * Update trade settlement amounts and status
     */
    static updateTradeSettlement(trade, settlementType, amount) {
        const updateField = settlementType === 'BASE' ? 'base_settled_amount' : 'quote_settled_amount';
        const newAmount = (settlementType === 'BASE' ? trade.base_settled_amount : trade.quote_settled_amount) + amount;
        // Update the settlement amount
        connection_1.db.prepare(`UPDATE trades SET ${updateField} = ?, last_settlement_date = CURRENT_DATE WHERE id = ?`)
            .run(newAmount, trade.id);
        // Get fresh settlement amounts from database to check completion status
        const freshTrade = connection_1.db.prepare('SELECT base_settled_amount, quote_settled_amount, amount, total_value FROM trades WHERE id = ?')
            .get(trade.id);
        // Check if base and quote are fully settled
        const isBaseFullySettled = freshTrade.base_settled_amount >= freshTrade.amount;
        const isQuoteFullySettled = freshTrade.quote_settled_amount >= freshTrade.total_value;
        // Update settlement flags and status
        let status = 'PENDING';
        if (isBaseFullySettled && isQuoteFullySettled) {
            status = 'COMPLETED';
        }
        else if (freshTrade.base_settled_amount > 0 || freshTrade.quote_settled_amount > 0) {
            status = 'PARTIAL';
        }
        connection_1.db.prepare(`
      UPDATE trades SET 
        is_base_fully_settled = ?, 
        is_quote_fully_settled = ?, 
        status = ? 
      WHERE id = ?
    `).run(isBaseFullySettled ? 1 : 0, isQuoteFullySettled ? 1 : 0, status, trade.id);
        console.log(`Trade ${trade.trade_number} status updated to ${status} (Base: ${isBaseFullySettled}, Quote: ${isQuoteFullySettled})`);
    }
    /**
     * Reprocess all receipts to rebuild settlement data
     */
    static reprocessAllReceipts() {
        try {
            console.log('🔄 Reprocessing all receipts for settlement...');
            // Clear existing settlement data
            connection_1.db.prepare('DELETE FROM trade_settlements').run();
            // Reset trade settlement amounts and status
            connection_1.db.prepare(`
        UPDATE trades SET 
          base_settled_amount = 0, 
          quote_settled_amount = 0, 
          is_base_fully_settled = 0, 
          is_quote_fully_settled = 0, 
          status = 'PENDING',
          last_settlement_date = NULL
      `).run();
            // Get all receipts in order
            const receipts = connection_1.db.prepare('SELECT id FROM payment_receipts ORDER BY created_at ASC').all();
            // Reprocess each receipt
            for (const receipt of receipts) {
                this.processReceipt(receipt.id);
            }
            console.log(`✅ Reprocessed ${receipts.length} of ${receipts.length} receipts`);
            return { success: true, message: `Reprocessed ${receipts.length} receipts` };
        }
        catch (error) {
            console.error('Error reprocessing receipts:', error);
            throw error;
        }
    }
}
exports.SettlementService = SettlementService;
//# sourceMappingURL=settlementService.js.map