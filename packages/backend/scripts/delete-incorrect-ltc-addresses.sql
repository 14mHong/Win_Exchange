-- Fix incorrect LTC addresses in database
-- Run this script AFTER deploying the LTC network fix to production

-- Step 1: Check how many incorrect LTC addresses exist
SELECT
  COUNT(*) as incorrect_count,
  'LTC addresses starting with 1 (Bitcoin format)' as description
FROM deposit_addresses
WHERE currency = 'LTC'
AND address LIKE '1%';

-- Step 2: Show all incorrect addresses (for verification)
SELECT
  id,
  user_id,
  currency,
  address,
  derivation_path,
  created_at,
  updated_at
FROM deposit_addresses
WHERE currency = 'LTC'
AND address LIKE '1%'
ORDER BY user_id;

-- Step 3: Delete incorrect LTC addresses
-- IMPORTANT: Only run this if you're sure no deposits have been made!
-- Users will get new correct addresses (starting with 'L') on next request

-- UNCOMMENT THE LINE BELOW TO DELETE:
-- DELETE FROM deposit_addresses WHERE currency = 'LTC' AND address LIKE '1%';

-- After deletion, verify no incorrect addresses remain:
SELECT
  COUNT(*) as remaining_incorrect
FROM deposit_addresses
WHERE currency = 'LTC'
AND address LIKE '1%';

-- Expected result: 0 rows
