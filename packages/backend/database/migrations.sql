-- Migration scripts for database updates
-- This file contains migration scripts that can be run to update the database schema

-- Migration 001: Add additional security fields
-- ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
-- ALTER TABLE users ADD COLUMN last_login_ip INET;

-- Migration 002: Add fee structure tables
-- CREATE TABLE fee_tiers (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name VARCHAR(50) NOT NULL,
--     maker_fee DECIMAL(5, 4) NOT NULL,
--     taker_fee DECIMAL(5, 4) NOT NULL,
--     min_volume DECIMAL(20, 8) DEFAULT 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TABLE user_fee_tiers (
--     user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
--     fee_tier_id UUID NOT NULL REFERENCES fee_tiers(id),
--     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Migration 003: Add order expiration
-- ALTER TABLE orders ADD COLUMN expires_at TIMESTAMP;

-- Migration 004: Add withdrawal addresses
-- CREATE TABLE withdrawal_addresses (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     currency VARCHAR(10) NOT NULL,
--     address VARCHAR(255) NOT NULL,
--     label VARCHAR(100),
--     is_whitelisted BOOLEAN DEFAULT FALSE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Example rollback script
-- To rollback migration 001:
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip;