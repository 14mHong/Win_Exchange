-- Migration: Create deposit_addresses table
-- Purpose: Store user deposit addresses derived from HD wallet

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

  -- Ensure one address per user per currency (addresses can be shared across currencies for ERC-20 tokens)
  CONSTRAINT unique_user_currency UNIQUE (user_id, currency),

  -- Index for fast lookups
  CONSTRAINT check_currency CHECK (currency IN ('BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BNB', 'SOL', 'XRP', 'DOGE', 'DOT')),
  CONSTRAINT check_network CHECK (network IN ('Bitcoin Mainnet', 'Ethereum Mainnet', 'Litecoin Mainnet', 'BTC Testnet', 'ETH Testnet', 'LTC Testnet'))
);

-- Indexes for performance
CREATE INDEX idx_deposit_addresses_user_id ON deposit_addresses(user_id);
CREATE INDEX idx_deposit_addresses_currency ON deposit_addresses(currency);
CREATE INDEX idx_deposit_addresses_address ON deposit_addresses(address);
CREATE INDEX idx_deposit_addresses_network ON deposit_addresses(network);

-- Add columns to transactions table for blockchain data
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS block_number BIGINT,
ADD COLUMN IF NOT EXISTS block_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS from_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS to_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS gas_used VARCHAR(50),
ADD COLUMN IF NOT EXISTS gas_price VARCHAR(50);

-- Comments
COMMENT ON TABLE deposit_addresses IS 'Stores unique deposit addresses for each user and currency';
COMMENT ON COLUMN deposit_addresses.derivation_path IS 'BIP44 derivation path used to generate this address';
COMMENT ON COLUMN deposit_addresses.last_checked_block IS 'Last block number checked for deposits (for blockchain monitoring)';
COMMENT ON COLUMN deposit_addresses.last_checked_balance IS 'Last known balance on blockchain';
