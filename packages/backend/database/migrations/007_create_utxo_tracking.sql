-- UTXO Tracking System for Bitcoin/Litecoin
-- Creates tables to track unspent transaction outputs

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

-- Indexes for performance
CREATE INDEX idx_utxos_user_currency ON utxos(user_id, currency) WHERE status = 'confirmed';
CREATE INDEX idx_utxos_status ON utxos(status);
CREATE INDEX idx_utxos_address ON utxos(address);
CREATE INDEX idx_utxos_tx_hash ON utxos(tx_hash);
CREATE INDEX idx_utxos_spent ON utxos(spent_in_tx_hash) WHERE spent_in_tx_hash IS NOT NULL;
CREATE INDEX idx_utxos_confirmations ON utxos(confirmations) WHERE status = 'unconfirmed';

-- Table for tracking Bitcoin transactions
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

CREATE INDEX idx_bitcoin_tx_user ON bitcoin_transactions(user_id);
CREATE INDEX idx_bitcoin_tx_hash ON bitcoin_transactions(tx_hash);
CREATE INDEX idx_bitcoin_tx_status ON bitcoin_transactions(status);
CREATE INDEX idx_bitcoin_tx_confirmations ON bitcoin_transactions(confirmations) WHERE status = 'pending';

-- Link UTXOs to their source transactions
CREATE TABLE IF NOT EXISTS utxo_sources (
  utxo_id UUID REFERENCES utxos(id) ON DELETE CASCADE,
  bitcoin_tx_id UUID REFERENCES bitcoin_transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (utxo_id, bitcoin_tx_id)
);

-- Comments
COMMENT ON TABLE utxos IS 'Tracks all unspent transaction outputs for Bitcoin/Litecoin';
COMMENT ON COLUMN utxos.vout IS 'Output index in the transaction (0, 1, 2, etc.)';
COMMENT ON COLUMN utxos.amount_satoshi IS 'Amount in satoshi (BTC) or litoshi (LTC)';
COMMENT ON COLUMN utxos.script_pub_key IS 'Locking script required to spend this UTXO';
COMMENT ON COLUMN utxos.locked_until IS 'Temporary lock for pending withdrawal transactions';

COMMENT ON TABLE bitcoin_transactions IS 'Tracks all Bitcoin/Litecoin transactions';
COMMENT ON TABLE utxo_sources IS 'Links UTXOs to their originating transactions';
