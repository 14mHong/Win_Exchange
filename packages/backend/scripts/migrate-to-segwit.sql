-- Migration Script: Legacy P2PKH to Native SegWit (Bech32)
-- Run this AFTER deploying SegWit code changes

-- =============================================================================
-- STEP 1: Identify addresses to migrate
-- =============================================================================

-- Check BTC P2PKH addresses (start with '1')
SELECT
  COUNT(*) as btc_p2pkh_count,
  'BTC addresses starting with 1 (P2PKH - Legacy)' as description
FROM deposit_addresses
WHERE currency = 'BTC'
AND address LIKE '1%';

-- Check LTC P2PKH addresses (start with 'L')
SELECT
  COUNT(*) as ltc_p2pkh_count,
  'LTC addresses starting with L (P2PKH - Legacy)' as description
FROM deposit_addresses
WHERE currency = 'LTC'
AND (address LIKE 'L%' OR address LIKE '1%');  -- Include incorrectly generated ones

-- =============================================================================
-- STEP 2: Show all legacy addresses (for verification)
-- =============================================================================

SELECT
  id,
  user_id,
  currency,
  address,
  LEFT(address, 4) as address_prefix,
  CASE
    WHEN currency = 'BTC' AND address LIKE '1%' THEN 'P2PKH (Legacy)'
    WHEN currency = 'BTC' AND address LIKE 'bc1%' THEN 'P2WPKH (SegWit) ✓'
    WHEN currency = 'LTC' AND (address LIKE 'L%' OR address LIKE '1%') THEN 'P2PKH (Legacy)'
    WHEN currency = 'LTC' AND address LIKE 'ltc1%' THEN 'P2WPKH (SegWit) ✓'
    ELSE 'Unknown'
  END as address_type,
  created_at,
  updated_at
FROM deposit_addresses
WHERE currency IN ('BTC', 'LTC')
ORDER BY currency, user_id;

-- =============================================================================
-- STEP 3: Check for any transactions to legacy addresses
-- =============================================================================

-- Check UTXOs for legacy addresses
SELECT
  da.currency,
  da.address,
  COUNT(u.id) as utxo_count,
  SUM(u.amount_satoshi) as total_satoshi,
  SUM(u.amount) as total_amount
FROM deposit_addresses da
LEFT JOIN utxos u ON da.address = u.address
WHERE da.currency IN ('BTC', 'LTC')
AND (
  (da.currency = 'BTC' AND da.address LIKE '1%')
  OR
  (da.currency = 'LTC' AND (da.address LIKE 'L%' OR da.address LIKE '1%'))
)
GROUP BY da.currency, da.address
ORDER BY da.currency, total_satoshi DESC;

-- =============================================================================
-- STEP 4: Migration Options
-- =============================================================================

-- OPTION A: Delete ALL legacy addresses (RECOMMENDED if no deposits)
-- Users will automatically get new SegWit addresses on next request

-- UNCOMMENT TO DELETE BTC LEGACY ADDRESSES:
-- DELETE FROM deposit_addresses
-- WHERE currency = 'BTC'
-- AND address LIKE '1%';

-- UNCOMMENT TO DELETE LTC LEGACY ADDRESSES:
-- DELETE FROM deposit_addresses
-- WHERE currency = 'LTC'
-- AND (address LIKE 'L%' OR address LIKE '1%');

-- OPTION B: Mark legacy addresses for migration (if deposits exist)
-- Add a column to track address format

-- UNCOMMENT TO ADD FORMAT TRACKING (run once):
-- ALTER TABLE deposit_addresses ADD COLUMN IF NOT EXISTS address_format VARCHAR(20);
--
-- UPDATE deposit_addresses
-- SET address_format = CASE
--   WHEN currency = 'BTC' AND address LIKE '1%' THEN 'P2PKH'
--   WHEN currency = 'BTC' AND address LIKE 'bc1%' THEN 'P2WPKH'
--   WHEN currency = 'LTC' AND address LIKE 'L%' THEN 'P2PKH'
--   WHEN currency = 'LTC' AND address LIKE 'ltc1%' THEN 'P2WPKH'
--   WHEN currency = 'LTC' AND address LIKE '1%' THEN 'INVALID'
--   ELSE 'UNKNOWN'
-- END
-- WHERE currency IN ('BTC', 'LTC');

-- =============================================================================
-- STEP 5: Verify migration
-- =============================================================================

-- After deletion/migration, verify all addresses are SegWit format
SELECT
  currency,
  COUNT(*) as total_addresses,
  COUNT(CASE WHEN currency = 'BTC' AND address LIKE 'bc1%' THEN 1 END) as btc_segwit,
  COUNT(CASE WHEN currency = 'BTC' AND address LIKE '1%' THEN 1 END) as btc_legacy,
  COUNT(CASE WHEN currency = 'LTC' AND address LIKE 'ltc1%' THEN 1 END) as ltc_segwit,
  COUNT(CASE WHEN currency = 'LTC' AND (address LIKE 'L%' OR address LIKE '1%') THEN 1 END) as ltc_legacy
FROM deposit_addresses
WHERE currency IN ('BTC', 'LTC')
GROUP BY currency;

-- Expected result after migration:
-- BTC: All addresses should be bc1... (btc_segwit > 0, btc_legacy = 0)
-- LTC: All addresses should be ltc1... (ltc_segwit > 0, ltc_legacy = 0)

-- =============================================================================
-- STEP 6: Clean up any orphaned UTXOs from deleted addresses
-- =============================================================================

-- This will identify UTXOs that no longer have a corresponding deposit address
SELECT
  u.currency,
  u.address,
  COUNT(*) as orphaned_utxos,
  SUM(u.amount_satoshi) as total_satoshi
FROM utxos u
LEFT JOIN deposit_addresses da ON u.address = da.address AND u.currency = da.currency
WHERE u.currency IN ('BTC', 'LTC')
AND da.id IS NULL
GROUP BY u.currency, u.address;

-- If there are orphaned UTXOs, you should:
-- 1. Check if they have value
-- 2. Sweep funds to new SegWit addresses if needed
-- 3. Then delete orphaned UTXOs

-- =============================================================================
-- NOTES
-- =============================================================================

-- 1. BACKUP DATABASE BEFORE RUNNING DELETE OPERATIONS
-- 2. Run STEP 3 to check for deposits before deletion
-- 3. If deposits exist to legacy addresses:
--    - Option 1: Keep both address types temporarily
--    - Option 2: Sweep funds to new SegWit addresses first
-- 4. After migration, new addresses will be:
--    - BTC: bc1... (Native SegWit)
--    - LTC: ltc1... (Native SegWit)
-- 5. Benefits:
--    - 30-40% lower transaction fees
--    - Faster confirmations
--    - Modern standard
