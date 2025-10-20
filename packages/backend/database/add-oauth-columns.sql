-- Add OAuth columns to users table
-- Run this on your Render PostgreSQL database

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Create index on google_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update email_verified for OAuth users (they come pre-verified from Google)
-- This will be handled in the code, but just in case
UPDATE users SET email_verified = true WHERE google_id IS NOT NULL AND email_verified = false;
