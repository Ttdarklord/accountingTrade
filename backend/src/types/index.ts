export type Currency = 'AED' | 'TOMAN';

export type TradeType = 'BUY' | 'SELL' | 'BUY_SELL';

export type TradeStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';

export type PaymentType = 'OUTGOING' | 'INCOMING';

export type PaymentStatus = 'PENDING' | 'COMPLETED';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type TransactionType = 'BUY' | 'SELL' | 'RECEIPT';

export interface CompanyBalance {
  id: number;
  currency: Currency;
  balance: number;
  safe_balance: number;
  updated_at: string;
}

export interface BankAccount {
  id: number;
  account_number: string;
  bank_name: string;
  currency: Currency;
  counterpart_id: number;
  is_active: boolean;
  created_at: string;
  // Joined data
  counterpart_name?: string;
  receipt_count?: number;
}

export interface TradingParty {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  national_id?: string;
  notes?: string;
  created_at: string;
}

export interface CounterpartBalance {
  id: number;
  counterpart_id: number;
  currency: Currency;
  balance: number;
  updated_at: string;
  // Joined data
  counterpart_name?: string;
}

export interface Trade {
  id: number;
  trade_number: string;
  trade_type: TradeType;
  status: TradeStatus;
  base_currency: Currency;
  quote_currency: Currency;
  amount: number;
  rate: number;
  total_value: number;
  counterparty_id?: number;
  trade_date: string;
  settlement_date_base: string;
  settlement_date_quote: string;
  
  // Settlement tracking
  base_settled_amount: number;
  quote_settled_amount: number;
  is_base_fully_settled: boolean;
  is_quote_fully_settled: boolean;
  last_settlement_date?: string;
  
  // Progress with bucket-and-pour calculation (computed by backend)
  progressAED: number;
  progressTOMAN: number;
  
  profit_toman: number;
  profit_aed: number;
  created_at: string;
  updated_at: string;
  // Joined data
  counterparty_name?: string;
}

export interface TradeSettlement {
  id: number;
  trade_id: number;
  receipt_id: number;
  currency: Currency;
  settled_amount: number;
  settlement_type: 'BASE' | 'QUOTE';
  settlement_date: string;
  fifo_sequence: number;
  created_at: string;
}

export interface TradePosition {
  id: number;
  original_trade_id: number;
  currency: Currency;
  original_amount: number;
  remaining_amount: number;
  average_cost_rate: number;
  created_at: string;
  updated_at: string;
  // Joined data
  trade_number?: string;
  trade_date?: string;
}

export interface PaymentInstruction {
  id: number;
  trade_id: number;
  account_id: number;
  amount: number;
  currency: Currency;
  payment_type: PaymentType;
  status: PaymentStatus;
  due_date: string;
  created_at: string;
}

export interface PaymentReceipt {
  id: number;
  // Common fields
  tracking_last_5: string;
  amount: number;
  currency: Currency;
  receipt_date: string;
  notes?: string;
  created_at: string;
  
  // TOMAN receipt fields (bank transfers)
  payer_id?: number;
  receiver_account_id?: number;
  
  // AED receipt fields (cash transactions)
  receipt_type?: 'pay' | 'receive';
  trading_party_id?: number;
  individual_name?: string;
  
  // Soft deletion and audit fields
  is_deleted?: boolean;
  deleted_at?: string;
  deletion_reason?: string;
  deletion_reason_category?: 'duplicate' | 'funds_returned' | 'receipt_not_landed' | 'data_error' | 'other';
  deleted_by?: string;
  
  // Restoration fields
  is_restored?: boolean;
  restored_at?: string;
  restoration_reason?: string;
  restored_by?: string;
  
  // Joined data
  payer_name?: string;
  receiver_account_number?: string;
  receiver_counterpart_name?: string;
  receiver_bank_name?: string;
  trading_party_name?: string;
}

export interface DeleteReceiptRequest {
  reason: string;
  reason_category: 'duplicate' | 'funds_returned' | 'receipt_not_landed' | 'data_error' | 'other';
  deleted_by?: string;
}

export interface RestoreReceiptRequest {
  reason: string;
  restored_by?: string;
}

export interface CounterpartStatementLine {
  id: number;
  counterpart_id: number;
  currency: Currency;
  transaction_type: TransactionType;
  trade_id?: number;
  receipt_id?: number;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance_after: number;
  transaction_date: string;
  created_at: string;
  // Joined data
  trade_number?: string;
  tracking_last_5?: string;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  trade_id?: number;
  receipt_id?: number;
  description: string;
  entry_date: string;
  created_at: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  currency: Currency;
  counterpart_id?: number;
  created_at: string;
  // Joined data
  counterpart_name?: string;
}

export interface ChartOfAccounts {
  id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  currency?: Currency | 'BOTH';
  is_active: boolean;
  created_at: string;
}

// Request types
export interface CreateBankAccountRequest {
  account_number: string;
  bank_name: string;
  currency: Currency;
  counterpart_id: number;
}

export interface UpdateBankAccountRequest {
  account_number?: string;
  bank_name?: string;
  currency?: Currency;
  counterpart_id?: number;
  is_active?: boolean;
}

export interface CreateTradingPartyRequest {
  name: string;
  phone?: string;
  email?: string;
  national_id?: string;
  notes?: string;
}

export interface UpdateTradingPartyRequest {
  name?: string;
  phone?: string;
  email?: string;
  national_id?: string;
  notes?: string;
}

export interface CreateTradeRequest {
  trade_type: TradeType;
  base_currency: Currency;
  quote_currency: Currency;
  amount: number;
  rate: number;
  counterparty_id?: number;
  buy_counterparty_id?: number;
  sell_counterparty_id?: number;
  sell_from_position_id?: number;
  sell_amount?: number;
  trade_date?: string;
  settlement_date_base?: string;
  settlement_date_quote?: string;
}

export interface CreateReceiptRequest {
  // Common fields
  tracking_last_5: string; // For TOMAN: user input (1-20 chars), For AED: auto-generated (5 chars)
  amount: number;
  currency: Currency;
  receipt_date: string;
  notes?: string;
  
  // TOMAN receipt fields (bank transfers)
  payer_id?: number;
  receiver_account_id?: number;
  
  // AED receipt fields (cash transactions)
  receipt_type?: 'pay' | 'receive';
  trading_party_id?: number;
  individual_name?: string;
}

export interface SellFromPositionRequest {
  position_id: number;
  amount: number;
  rate: number;
  counterparty_id?: number;
  trade_date?: string;
  settlement_date_base?: string;
  settlement_date_quote?: string;
}

// Dashboard data interfaces
export interface DashboardData {
  balances: CompanyBalance[];
  pending_trades: Trade[];
  outstanding_positions: TradePosition[];
  recent_transactions: Trade[];
  profit_summary: {
    total_profit_toman: number;
    total_profit_aed: number;
    monthly_profit_toman: number;
    monthly_profit_aed: number;
  };
  trade_status_counts: {
    pending_count: number;
    partial_count: number;
    completed_count: number;
  };
}

export interface ProfitCalculation {
  profit_toman: number;
  profit_aed: number;
  position_used?: TradePosition;
  average_cost?: number;
} 