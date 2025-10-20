-- Fix users table - add all missing columns
-- Run this on your Render PostgreSQL database

-- Add name columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Add OAuth columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Add verification columns (if not already present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Add phone column (if not present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add 2FA columns (if not present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_fa_secret VARCHAR(255);

-- Add account status columns (if not present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add timestamps (if not present)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Display current table structure
\d users;
