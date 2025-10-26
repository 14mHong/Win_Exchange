-- ============================================================================
-- WIN EXCHANGE - COMPLETE DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script creates all necessary tables for a fresh database deployment
-- Run this on a new database to set up the complete schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with Google OAuth support
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255), -- Nullable for OAuth users

    -- OAuth fields (Google only)
    google_id VARCHAR(255) UNIQUE,
    provider VARCHAR(20) DEFAULT 'local' CHECK (provider IN ('local', 'google')),

    -- Personal information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_image VARCHAR(500),

    -- Security
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    two_fa_secret VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending users table (for registration workflow)
CREATE TABLE IF NOT EXISTS pending_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    verification_code VARCHAR(10) NOT NULL,
    verification_expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invite codes table (for gated registration)
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_by UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    notes TEXT
);

-- ============================================================================
-- WALLET & BALANCE TABLES
-- ============================================================================

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    balance DECIMAL(20, 8) DEFAULT 0 CHECK (balance >= 0),
    locked_balance DECIMAL(20, 8) DEFAULT 0 CHECK (locked_balance >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency)
);

-- Deposit addresses table (HD wallet derived addresses)
CREATE TABLE IF NOT EXISTS deposit_addresses (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    address VARCHAR(255) NOT NULL,
    derivation_path VARCHAR(100) NOT NULL,
    network VARCHAR(50),
    last_checked_block BIGINT DEFAULT 0,
    last_checked_balance VARCHAR(50) DEFAULT '0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one address per user per currency
    CONSTRAINT unique_user_currency UNIQUE (user_id, currency),
    CONSTRAINT check_currency CHECK (currency IN ('BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BNB', 'SOL', 'XRP', 'DOGE', 'DOT', 'ADA', 'MATIC', 'LINK', 'ATOM', 'UNI', 'AVAX', 'XLM')),
    CONSTRAINT check_network CHECK (network IN ('Bitcoin Mainnet', 'Ethereum Mainnet', 'Litecoin Mainnet', 'BTC Testnet', 'ETH Testnet', 'LTC Testnet'))
);

-- ============================================================================
-- UTXO TRACKING (Bitcoin/Litecoin)
-- ============================================================================

-- Main UTXO table
CREATE TABLE IF NOT EXISTS utxos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Transaction details
    tx_hash VARCHAR(64) NOT NULL,
    vout INTEGER NOT NULL, -- Output index in transaction

    -- Owner details
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    derivation_path TEXT NOT NULL,

    -- Amount and currency
    currency VARCHAR(10) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    amount_satoshi BIGINT NOT NULL, -- Amount in smallest unit (satoshi/litoshi)

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'unconfirmed'
        CHECK (status IN ('unconfirmed', 'confirmed', 'spent', 'locked')),

    -- Blockchain data
    block_height INTEGER,
    confirmations INTEGER DEFAULT 0,
    script_pub_key TEXT, -- Locking script for spending

    -- Spending information
    spent_in_tx_hash VARCHAR(64),
    spent_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP, -- For pending withdrawals
    locked_by UUID, -- Transaction ID that locked it

    -- Unique constraint on tx_hash + vout
    CONSTRAINT unique_utxo UNIQUE (tx_hash, vout, currency)
);

-- Bitcoin transactions table
CREATE TABLE IF NOT EXISTS bitcoin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Transaction identification
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    currency VARCHAR(10) NOT NULL,

    -- Type and direction
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'internal')),

    -- Associated user
    user_id UUID REFERENCES users(id),

    -- Transaction details
    total_input DECIMAL(36, 18),
    total_output DECIMAL(36, 18),
    fee DECIMAL(36, 18),
    size_bytes INTEGER,
    fee_per_byte DECIMAL(18, 8),

    -- Blockchain data
    block_height INTEGER,
    block_hash VARCHAR(64),
    confirmations INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'failed')),

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,

    -- Raw transaction data (for debugging)
    raw_tx TEXT
);

-- Link UTXOs to their source transactions
CREATE TABLE IF NOT EXISTS utxo_sources (
    utxo_id UUID REFERENCES utxos(id) ON DELETE CASCADE,
    bitcoin_tx_id UUID REFERENCES bitcoin_transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (utxo_id, bitcoin_tx_id)
);

-- ============================================================================
-- TRADING & SWAP TABLES
-- ============================================================================

-- Trading pairs table
CREATE TABLE IF NOT EXISTS trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    min_order_size DECIMAL(20, 8) NOT NULL,
    max_order_size DECIMAL(20, 8) NOT NULL,
    price_precision INTEGER NOT NULL,
    quantity_precision INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Swaps table (completed instant swaps)
CREATE TABLE IF NOT EXISTS swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(10) NOT NULL,
    to_token VARCHAR(10) NOT NULL,
    from_amount DECIMAL(20, 8) NOT NULL,
    to_amount DECIMAL(20, 8) NOT NULL,
    from_price DECIMAL(20, 8) NOT NULL,
    to_price DECIMAL(20, 8) NOT NULL,
    rate DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Limit orders table
CREATE TABLE IF NOT EXISTS limit_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(10) NOT NULL,
    to_token VARCHAR(10) NOT NULL,
    from_amount DECIMAL(20, 8) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, filled, cancelled, expired
    filled_amount DECIMAL(20, 8) DEFAULT 0,
    filled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Orders table (traditional order book)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('market', 'limit')),
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    remaining_quantity DECIMAL(20, 8),
    status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'partially_filled', 'canceled', 'expired')),
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP,
    canceled_at TIMESTAMP
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buy_order_id UUID NOT NULL REFERENCES orders(id),
    sell_order_id UUID NOT NULL REFERENCES orders(id),
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id),
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    buyer_fee DECIMAL(20, 8) DEFAULT 0,
    seller_fee DECIMAL(20, 8) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- WIN TOKEN TABLES
-- ============================================================================

-- WIN Token Configuration Table
CREATE TABLE IF NOT EXISTS win_token_config (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL DEFAULT 'WIN',
    name VARCHAR(50) NOT NULL DEFAULT 'Win Exchange Token',

    -- Current Price and Market Data
    current_price DECIMAL(20, 8) NOT NULL DEFAULT 0.10,
    base_price DECIMAL(20, 8) NOT NULL DEFAULT 0.10,

    -- Admin-Controlled Parameters
    market_cap DECIMAL(30, 2) DEFAULT 10000000.00,
    total_supply DECIMAL(30, 2) DEFAULT 100000000.00,
    circulating_supply DECIMAL(30, 2) DEFAULT 50000000.00,
    daily_volume DECIMAL(30, 2) DEFAULT 500000.00,
    liquidity DECIMAL(30, 2) DEFAULT 1000000.00,

    -- Price Algorithm Parameters
    volatility DECIMAL(5, 4) DEFAULT 0.02, -- 2% standard deviation
    trend_strength DECIMAL(5, 4) DEFAULT 0.0001, -- 0.01% appreciation per hour
    min_price DECIMAL(20, 8) DEFAULT 0.01,
    max_price DECIMAL(20, 8) DEFAULT 100.00,

    -- Algorithm Control
    simulation_enabled BOOLEAN DEFAULT true,
    last_price_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol)
);

-- WIN Token Price History (OHLCV Candles)
CREATE TABLE IF NOT EXISTS win_price_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL DEFAULT 'WIN',

    -- Timeframe
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    timestamp TIMESTAMP NOT NULL,

    -- OHLCV Data
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(30, 2) DEFAULT 0.00,

    -- Additional Data
    num_trades INTEGER DEFAULT 0,
    quote_volume DECIMAL(30, 2) DEFAULT 0.00,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, timeframe, timestamp)
);

-- WIN Token Trades (Simulated)
CREATE TABLE IF NOT EXISTS win_trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL DEFAULT 'WIN',
    trading_pair VARCHAR(20) NOT NULL DEFAULT 'WIN/USDT',

    side VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    quote_quantity DECIMAL(20, 8) NOT NULL,

    is_simulated BOOLEAN DEFAULT true,
    user_id UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TRANSACTION & AUDIT TABLES
-- ============================================================================

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trade_buy', 'trade_sell', 'fee', 'swap')),
    currency VARCHAR(10) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    fee DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
    tx_hash VARCHAR(255),

    -- Blockchain data
    block_height BIGINT,
    block_number BIGINT,
    block_hash VARCHAR(255),
    confirmations INTEGER DEFAULT 0,

    -- Address information
    from_address VARCHAR(255),
    to_address VARCHAR(255),

    -- Gas data (for Ethereum)
    gas_used VARCHAR(50),
    gas_price VARCHAR(50),

    external_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Verification codes table (for email/SMS verification)
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email_verification', 'phone_verification', 'password_reset', '2fa_setup')),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id VARCHAR(50) UNIQUE NOT NULL,
    key_secret_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions TEXT[], -- Array of permissions like ['read', 'trade', 'withdraw']
    ip_whitelist INET[],
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market data table (for OHLCV data)
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id),
    interval_type VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price DECIMAL(20, 8) NOT NULL,
    high_price DECIMAL(20, 8) NOT NULL,
    low_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    trade_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trading_pair_id, interval_type, open_time)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Pending users indexes
CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_verification_code ON pending_users(verification_code);
CREATE INDEX IF NOT EXISTS idx_pending_users_expires_at ON pending_users(verification_expires_at);

-- Invite codes indexes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_active ON invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON invite_codes(created_by);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);

-- Deposit addresses indexes
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user_id ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_currency ON deposit_addresses(currency);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_network ON deposit_addresses(network);

-- UTXO indexes
CREATE INDEX IF NOT EXISTS idx_utxos_user_currency ON utxos(user_id, currency) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_utxos_status ON utxos(status);
CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);
CREATE INDEX IF NOT EXISTS idx_utxos_tx_hash ON utxos(tx_hash);
CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent_in_tx_hash) WHERE spent_in_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_utxos_confirmations ON utxos(confirmations) WHERE status = 'unconfirmed';

-- Bitcoin transactions indexes
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_user ON bitcoin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_hash ON bitcoin_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_status ON bitcoin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_confirmations ON bitcoin_transactions(confirmations) WHERE status = 'pending';

-- Swaps indexes
CREATE INDEX IF NOT EXISTS idx_swaps_user_id ON swaps(user_id);
CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps(created_at DESC);

-- Limit orders indexes
CREATE INDEX IF NOT EXISTS idx_limit_orders_user_id ON limit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_tokens ON limit_orders(from_token, to_token);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_trading_pair_id ON orders(trading_pair_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Trades indexes
CREATE INDEX IF NOT EXISTS idx_trades_trading_pair_id ON trades(trading_pair_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

-- WIN token indexes
CREATE INDEX IF NOT EXISTS idx_win_price_history_timeframe ON win_price_history(symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_price_history_timestamp ON win_price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_timestamp ON win_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_pair ON win_trades(trading_pair, created_at DESC);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Verification codes indexes
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_type ON verification_codes(type);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_market_data_trading_pair_interval ON market_data(trading_pair_id, interval_type);
CREATE INDEX IF NOT EXISTS idx_market_data_open_time ON market_data(open_time);

-- ============================================================================
-- TRIGGERS FOR updated_at TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_users_updated_at ON pending_users;
CREATE TRIGGER update_pending_users_updated_at BEFORE UPDATE ON pending_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_swaps_updated_at ON swaps;
CREATE TRIGGER update_swaps_updated_at BEFORE UPDATE ON swaps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_limit_orders_updated_at ON limit_orders;
CREATE TRIGGER update_limit_orders_updated_at BEFORE UPDATE ON limit_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deposit_addresses_updated_at ON deposit_addresses;
CREATE TRIGGER update_deposit_addresses_updated_at BEFORE UPDATE ON deposit_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_win_token_config_updated_at ON win_token_config;
CREATE TRIGGER update_win_token_config_updated_at BEFORE UPDATE ON win_token_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_utxos_updated_at ON utxos;
CREATE TRIGGER update_utxos_updated_at BEFORE UPDATE ON utxos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Create a view for order book data
CREATE OR REPLACE VIEW order_book AS
SELECT
    tp.symbol,
    o.side,
    o.price,
    SUM(o.remaining_quantity) as total_quantity,
    COUNT(*) as order_count
FROM orders o
JOIN trading_pairs tp ON o.trading_pair_id = tp.id
WHERE o.status = 'open'
GROUP BY tp.symbol, o.side, o.price
ORDER BY tp.symbol, o.side,
    CASE WHEN o.side = 'buy' THEN o.price END DESC,
    CASE WHEN o.side = 'sell' THEN o.price END ASC;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default trading pairs
INSERT INTO trading_pairs (symbol, base_currency, quote_currency, min_order_size, max_order_size, price_precision, quantity_precision) VALUES
('BTC-USDT', 'BTC', 'USDT', 0.00001, 100, 2, 5),
('ETH-USDT', 'ETH', 'USDT', 0.001, 1000, 2, 3),
('BTC-ETH', 'BTC', 'ETH', 0.00001, 100, 6, 5),
('LTC-USDT', 'LTC', 'USDT', 0.01, 10000, 2, 2),
('ADA-USDT', 'ADA', 'USDT', 1, 1000000, 4, 0),
('WIN/USDT', 'WIN', 'USDT', 1.00, 1000000.00, 8, 2)
ON CONFLICT (symbol) DO NOTHING;

-- Insert default WIN token configuration
INSERT INTO win_token_config (
    symbol, name, current_price, base_price,
    market_cap, total_supply, circulating_supply,
    daily_volume, liquidity,
    volatility, trend_strength, min_price, max_price,
    simulation_enabled
) VALUES (
    'WIN', 'Win Exchange Token', 0.10, 0.10,
    10000000.00, 100000000.00, 50000000.00,
    500000.00, 1000000.00,
    0.02, 0.0001, 0.01, 100.00,
    true
) ON CONFLICT (symbol) DO NOTHING;

-- Insert initial price candle
INSERT INTO win_price_history (
    symbol, timeframe, timestamp, open, high, low, close, volume
) VALUES (
    'WIN', '1m', DATE_TRUNC('minute', CURRENT_TIMESTAMP), 0.10, 0.10, 0.10, 0.10, 1000.00
) ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with Google OAuth support';
COMMENT ON TABLE pending_users IS 'Temporary storage for users pending email verification';
COMMENT ON TABLE invite_codes IS 'One-time use invite codes for gated registration';
COMMENT ON TABLE wallets IS 'User wallet balances for each currency';
COMMENT ON TABLE deposit_addresses IS 'Unique deposit addresses for each user and currency';
COMMENT ON TABLE utxos IS 'Tracks all unspent transaction outputs for Bitcoin/Litecoin';
COMMENT ON TABLE bitcoin_transactions IS 'Tracks all Bitcoin/Litecoin transactions';
COMMENT ON TABLE utxo_sources IS 'Links UTXOs to their originating transactions';
COMMENT ON TABLE swaps IS 'Completed instant token swaps';
COMMENT ON TABLE limit_orders IS 'Pending limit orders waiting to be filled';
COMMENT ON TABLE win_token_config IS 'Configuration and parameters for WIN token simulation';
COMMENT ON TABLE win_price_history IS 'Historical price data (OHLCV candles) for WIN token';
COMMENT ON TABLE win_trades IS 'Trade history for WIN token (simulated and real)';

COMMENT ON COLUMN utxos.vout IS 'Output index in the transaction (0, 1, 2, etc.)';
COMMENT ON COLUMN utxos.amount_satoshi IS 'Amount in satoshi (BTC) or litoshi (LTC)';
COMMENT ON COLUMN utxos.script_pub_key IS 'Locking script required to spend this UTXO';
COMMENT ON COLUMN utxos.locked_until IS 'Temporary lock for pending withdrawal transactions';
COMMENT ON COLUMN deposit_addresses.derivation_path IS 'BIP44 derivation path used to generate this address';
COMMENT ON COLUMN deposit_addresses.last_checked_block IS 'Last block number checked for deposits (for blockchain monitoring)';
COMMENT ON COLUMN invite_codes.code IS 'Unique invite code (e.g., WIN-XXXX-YYYY)';
COMMENT ON COLUMN users.is_admin IS 'Indicates if user has admin privileges';

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================

SELECT 'Database initialization completed successfully!' AS status;
