-- WIN Token Configuration and Price History Tables

-- WIN Token Configuration Table
-- Stores admin-controlled parameters for the WIN token
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
-- Stores historical price data for charting
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
-- Stores simulated or real trades for volume tracking
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_win_price_history_timeframe ON win_price_history(symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_price_history_timestamp ON win_price_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_timestamp ON win_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_win_trades_pair ON win_trades(trading_pair, created_at DESC);

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

-- Create WIN wallets for existing users
-- This will be handled by the application layer
