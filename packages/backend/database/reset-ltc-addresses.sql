-- Reset All Litecoin Deposit Addresses
-- Run this to delete all LTC addresses so they can be regenerated with correct WIF format
-- Safe to run since no funds have been deposited yet

BEGIN;

-- Delete all Litecoin deposit addresses
DELETE FROM deposit_addresses
WHERE currency = 'LTC';

-- Get count to verify
SELECT
  COUNT(*) as deleted_count,
  'Litecoin addresses deleted' as message
FROM (SELECT 1) as dummy;

-- Show remaining addresses by currency
SELECT
  currency,
  COUNT(*) as count
FROM deposit_addresses
GROUP BY currency
ORDER BY currency;

COMMIT;

-- Instructions:
-- After running this script, LTC addresses will be automatically regenerated
-- with the correct WIF format when users next access their deposit addresses.
