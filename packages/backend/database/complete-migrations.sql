-- ========================================
-- Complete Migrations for Production Deployment
-- Run this ONCE on your Render PostgreSQL database
-- ========================================

-- ========================================
-- 1. DEPOSIT ADDRESSES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,
  address TEXT NOT NULL UNIQUE,
  derivation_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_currency ON deposit_addresses(currency);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address);

-- ========================================
-- 2. LIMIT ORDERS TABLE (for swap limit orders)
-- ========================================
CREATE TABLE IF NOT EXISTS limit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_token VARCHAR(10) NOT NULL,
  to_token VARCHAR(10) NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  target_price DECIMAL(20, 8) NOT NULL,
  filled_amount DECIMAL(20, 8) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'canceled', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_user ON limit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_pair ON limit_orders(from_token, to_token);

-- ========================================
-- 3. SWAPS TABLE (completed swaps)
-- ========================================
CREATE TABLE IF NOT EXISTS swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_token VARCHAR(10) NOT NULL,
  to_token VARCHAR(10) NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  to_amount DECIMAL(20, 8) NOT NULL,
  from_price DECIMAL(20, 8),
  to_price DECIMAL(20, 8),
  rate DECIMAL(20, 8),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swaps_user ON swaps(user_id);
CREATE INDEX IF NOT EXISTS idx_swaps_created ON swaps(created_at DESC);

-- ========================================
-- 4. UTXO TRACKING TABLES (Bitcoin/Litecoin)
-- ========================================

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

-- Indexes for UTXO performance
CREATE INDEX IF NOT EXISTS idx_utxos_user_currency ON utxos(user_id, currency) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_utxos_status ON utxos(status);
CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);
CREATE INDEX IF NOT EXISTS idx_utxos_tx_hash ON utxos(tx_hash);
CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent_in_tx_hash) WHERE spent_in_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_utxos_confirmations ON utxos(confirmations) WHERE status = 'unconfirmed';

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

CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_user ON bitcoin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_hash ON bitcoin_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_status ON bitcoin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bitcoin_tx_confirmations ON bitcoin_transactions(confirmations) WHERE status = 'pending';

-- Link UTXOs to their source transactions
CREATE TABLE IF NOT EXISTS utxo_sources (
  utxo_id UUID REFERENCES utxos(id) ON DELETE CASCADE,
  bitcoin_tx_id UUID REFERENCES bitcoin_transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (utxo_id, bitcoin_tx_id)
);

-- ========================================
-- 5. WIN TOKEN TABLES
-- ========================================

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

-- Create indexes for WIN token tables
CREATE INDEX IF NOT EXISTS idx_win_price_history_timeframe ON win_price_history(symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_price_history_timestamp ON win_price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_timestamp ON win_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_pair ON win_trades(trading_pair, created_at DESC);

-- ========================================
-- 6. INSERT INITIAL DATA
-- ========================================

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

-- Add WIN to trading pairs if not exists
INSERT INTO trading_pairs (
  base_currency, quote_currency, symbol, is_active,
  min_order_size, max_order_size, price_precision, quantity_precision
) VALUES (
  'WIN', 'USDT', 'WIN/USDT', true,
  1.00, 1000000.00, 8, 2
) ON CONFLICT (symbol) DO NOTHING;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- All tables created successfully
