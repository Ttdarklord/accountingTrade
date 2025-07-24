-- Company balance tracking (Agrivex)
CREATE TABLE IF NOT EXISTS company_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    safe_balance DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Cash in safe
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bank accounts for transfers
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('AED', 'TOMAN')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    
    -- Profit calculation (for completed trades)
    profit_toman DECIMAL(15, 2) DEFAULT 0,
    profit_aed DECIMAL(15, 2) DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (counterparty_id) REFERENCES trading_parties(id)
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

-- Payment receipts tracking
CREATE TABLE IF NOT EXISTS payment_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_instruction_id INTEGER NOT NULL,
    tracking_number TEXT NOT NULL,
    tracking_last_5 TEXT NOT NULL, -- Last 5 digits of tracking number
    account_last_5 TEXT NOT NULL,  -- Last 5 digits of receiver account
    amount DECIMAL(15, 2) NOT NULL,
    receipt_date DATE NOT NULL,
    verified BOOLEAN DEFAULT 0,
    receipt_image_path TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (payment_instruction_id) REFERENCES payment_instructions(id)
);

-- Double-entry accounting journal
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_number TEXT NOT NULL UNIQUE,
    trade_id INTEGER,
    description TEXT NOT NULL,
    entry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (trade_id) REFERENCES trades(id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

-- Chart of accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency TEXT CHECK(currency IN ('AED', 'TOMAN', 'BOTH')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize default chart of accounts
INSERT OR IGNORE INTO chart_of_accounts (account_code, account_name, account_type, currency) VALUES
-- Assets
('1001', 'Cash - Toman', 'ASSET', 'TOMAN'),
('1002', 'Cash - AED', 'ASSET', 'AED'),
('1003', 'Safe - Toman', 'ASSET', 'TOMAN'),
('1004', 'Safe - AED', 'ASSET', 'AED'),
('1101', 'Accounts Receivable - Toman', 'ASSET', 'TOMAN'),
('1102', 'Accounts Receivable - AED', 'ASSET', 'AED'),
('1201', 'Currency Inventory - Toman', 'ASSET', 'TOMAN'),
('1202', 'Currency Inventory - AED', 'ASSET', 'AED'),

-- Liabilities
('2001', 'Accounts Payable - Toman', 'LIABILITY', 'TOMAN'),
('2002', 'Accounts Payable - AED', 'LIABILITY', 'AED'),

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
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tracking ON payment_receipts(tracking_last_5, account_last_5);
CREATE INDEX IF NOT EXISTS idx_journal_entries_trade_id ON journal_entries(trade_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_id ON journal_entry_lines(journal_entry_id); 