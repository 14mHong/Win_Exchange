-- Remove KYC functionality from users table
ALTER TABLE users DROP COLUMN IF EXISTS kyc_status;
