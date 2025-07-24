-- Company balance tracking (Agrivex)
CREATE TABLE IF NOT EXISTS company_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    safe_balance DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Cash in safe
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bank accounts for transfers (linked to counterparts)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL UNIQUE,
    bank_name TEXT NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    counterpart_id INTEGER NOT NULL, -- Always linked to a trading party
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (counterpart_id) REFERENCES trading_parties(id)
);

-- Trading parties (buyers/sellers)
CREATE TABLE IF NOT EXISTS trading_parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    national_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Counterpart balances (separate from company balances)
CREATE TABLE IF NOT EXISTS counterpart_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counterpart_id INTEGER NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(counterpart_id, currency),
    FOREIGN KEY (counterpart_id) REFERENCES trading_parties(id)
);

-- Main trading transactions
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_number TEXT NOT NULL UNIQUE,
    trade_type TEXT NOT NULL CHECK(trade_type IN ('BUY', 'SELL', 'BUY_SELL')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED')),
    
    -- Currency details
    base_currency TEXT NOT NULL CHECK(base_currency IN ('AED', 'TOMAN')),
    quote_currency TEXT NOT NULL CHECK(quote_currency IN ('AED', 'TOMAN')),
    amount DECIMAL(15, 2) NOT NULL,
    rate DECIMAL(15, 6) NOT NULL,
    total_value DECIMAL(15, 2) NOT NULL,
    
    -- Trading party
    counterparty_id INTEGER,
    
    -- Dates
    trade_date DATE NOT NULL,
    settlement_date_base DATE NOT NULL,  -- When we pay/receive base currency
    settlement_date_quote DATE NOT NULL, -- When we pay/receive quote currency
    
    -- Settlement tracking
    base_settled_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- How much of base currency has been settled
    quote_settled_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- How much of quote currency has been settled
    is_base_fully_settled BOOLEAN DEFAULT 0, -- If base currency is fully settled
    is_quote_fully_settled BOOLEAN DEFAULT 0, -- If quote currency is fully settled
    last_settlement_date DATE, -- Date of last settlement activity
    
    -- Profit calculation (for completed trades)
    profit_toman DECIMAL(15, 2) DEFAULT 0,
    profit_aed DECIMAL(15, 2) DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (counterparty_id) REFERENCES trading_parties(id)
);

-- Trade settlements tracking (FIFO matching of receipts to trades)
CREATE TABLE IF NOT EXISTS trade_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    receipt_id INTEGER NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    settled_amount DECIMAL(15, 2) NOT NULL, -- How much of this receipt settled this trade
    settlement_type TEXT NOT NULL CHECK(settlement_type IN ('BASE', 'QUOTE')), -- Which side of trade was settled
    settlement_date DATE NOT NULL,
    fifo_sequence INTEGER NOT NULL, -- FIFO order for this currency/counterparty combination
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id),
    
    -- Ensure no duplicate settlements
    UNIQUE(trade_id, receipt_id, settlement_type)
);

-- Outstanding trade positions (for managing partial sales)
CREATE TABLE IF NOT EXISTS trade_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_trade_id INTEGER NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    original_amount DECIMAL(15, 2) NOT NULL,
    remaining_amount DECIMAL(15, 2) NOT NULL,
    average_cost_rate DECIMAL(15, 6) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (original_trade_id) REFERENCES trades(id)
);

-- Payment instructions for trades
CREATE TABLE IF NOT EXISTS payment_instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    payment_type TEXT NOT NULL CHECK(payment_type IN ('OUTGOING', 'INCOMING')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETED')),
    due_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

-- Payment receipts tracking (supports both TOMAN and AED)
CREATE TABLE IF NOT EXISTS payment_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Common fields
    tracking_last_5 TEXT NOT NULL, -- Last 5 digits of tracking number or reference
    amount DECIMAL(15, 2) NOT NULL, -- Amount in the specified currency
    currency TEXT NOT NULL DEFAULT 'TOMAN' CHECK(currency IN ('AED', 'TOMAN')),
    receipt_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- TOMAN receipt fields (bank transfers)
    payer_id INTEGER, -- Who paid (counterpart) - for TOMAN receipts
    receiver_account_id INTEGER, -- Which bank account received payment - for TOMAN receipts
    
    -- AED receipt fields (cash transactions)
    receipt_type TEXT CHECK(receipt_type IN ('pay', 'receive')), -- pay: Agrivex pays, receive: Agrivex receives
    trading_party_id INTEGER, -- Trading party involved - for AED receipts
    individual_name TEXT, -- Name of individual handling cash - for AED receipts
    
    -- Soft deletion and audit fields
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    deletion_reason TEXT,
    deletion_reason_category TEXT CHECK(deletion_reason_category IN ('duplicate', 'funds_returned', 'receipt_not_landed', 'data_error', 'other')),
    deleted_by TEXT, -- User who deleted the receipt
    
    -- Restoration fields
    is_restored BOOLEAN DEFAULT 0,
    restored_at DATETIME,
    restoration_reason TEXT,
    restored_by TEXT, -- User who restored the receipt
    
    FOREIGN KEY (payer_id) REFERENCES trading_parties(id),
    FOREIGN KEY (receiver_account_id) REFERENCES bank_accounts(id),
    FOREIGN KEY (trading_party_id) REFERENCES trading_parties(id)
);

-- Counterpart statement lines (for tracking all movements)
CREATE TABLE IF NOT EXISTS counterpart_statement_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counterpart_id INTEGER NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY', 'SELL', 'RECEIPT')),
    
    -- Reference data
    trade_id INTEGER, -- For BUY/SELL transactions
    receipt_id INTEGER, -- For RECEIPT transactions
    
    -- Transaction details
    description TEXT NOT NULL,
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    balance_after DECIMAL(15, 2) NOT NULL,
    
    transaction_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (counterpart_id) REFERENCES trading_parties(id),
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id)
);

-- Double-entry accounting journal
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_number TEXT NOT NULL UNIQUE,
    trade_id INTEGER,
    receipt_id INTEGER,
    description TEXT NOT NULL,
    entry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id)
);

-- Journal entry lines (debits and credits)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    counterpart_id INTEGER, -- Link to counterpart for receivables/payables
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
    FOREIGN KEY (counterpart_id) REFERENCES trading_parties(id)
);

-- Chart of accounts (enhanced for counterpart tracking)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency TEXT CHECK(currency IN ('AED', 'TOMAN', 'BOTH')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize default chart of accounts (enhanced)
INSERT OR IGNORE INTO chart_of_accounts (account_code, account_name, account_type, currency) VALUES
-- Assets
('1001', 'Cash - Toman', 'ASSET', 'TOMAN'),
('1002', 'Cash - AED', 'ASSET', 'AED'),
('1003', 'Safe - Toman', 'ASSET', 'TOMAN'),
('1004', 'Safe - AED', 'ASSET', 'AED'),
('1101', 'Counterpart Receivables - Toman', 'ASSET', 'TOMAN'),
('1102', 'Counterpart Receivables - AED', 'ASSET', 'AED'),
('1201', 'Currency Inventory - Toman', 'ASSET', 'TOMAN'),
('1202', 'Currency Inventory - AED', 'ASSET', 'AED'),

-- Liabilities
('2001', 'Counterpart Payables - Toman', 'LIABILITY', 'TOMAN'),
('2002', 'Counterpart Payables - AED', 'LIABILITY', 'AED'),

-- Equity
('3001', 'Owner Equity', 'EQUITY', 'BOTH'),
('3002', 'Retained Earnings', 'EQUITY', 'BOTH'),

-- Revenue
('4001', 'Trading Revenue - Currency Exchange', 'REVENUE', 'BOTH'),

-- Expenses
('5001', 'Trading Expenses', 'EXPENSE', 'BOTH'),
('5002', 'Bank Charges', 'EXPENSE', 'BOTH');

-- Initialize company balances
INSERT OR IGNORE INTO company_balances (currency, balance, safe_balance) VALUES
('TOMAN', 0, 0),
('AED', 0, 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_trade_number ON trades(trade_number);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tracking ON payment_receipts(tracking_last_5);
CREATE INDEX IF NOT EXISTS idx_journal_entries_trade_id ON journal_entries(trade_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_counterpart ON bank_accounts(counterpart_id);
CREATE INDEX IF NOT EXISTS idx_counterpart_balances_counterpart ON counterpart_balances(counterpart_id);
CREATE INDEX IF NOT EXISTS idx_statement_lines_counterpart ON counterpart_statement_lines(counterpart_id); 