-- Fix deposit_addresses table - add missing columns
-- Run this to fix the "column da.network does not exist" error

ALTER TABLE deposit_addresses
  ADD COLUMN IF NOT EXISTS network VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_checked_block BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checked_balance VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index on network for performance
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_network ON deposit_addresses(network);

-- Update existing records to have a default network
UPDATE deposit_addresses SET network =
  CASE
    WHEN currency = 'BTC' THEN 'Bitcoin Mainnet'
    WHEN currency = 'LTC' THEN 'Litecoin Mainnet'
    WHEN currency IN ('ETH', 'USDT', 'USDC', 'WIN') THEN 'Ethereum Mainnet'
    ELSE 'Unknown'
  END
WHERE network IS NULL;

-- Fix transactions table - add block_number as alias for block_height
-- The schema uses block_height but some code queries for block_number
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS block_number BIGINT;

-- Copy existing block_height values to block_number
UPDATE transactions SET block_number = block_height WHERE block_number IS NULL AND block_height IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
