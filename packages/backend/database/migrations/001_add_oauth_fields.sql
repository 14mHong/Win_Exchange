-- Add OAuth fields to users table
ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) UNIQUE,
ADD COLUMN facebook_id VARCHAR(255) UNIQUE,
ADD COLUMN first_name VARCHAR(100),
ADD COLUMN last_name VARCHAR(100),
ADD COLUMN profile_image VARCHAR(500),
ADD COLUMN provider VARCHAR(20) DEFAULT 'local' CHECK (provider IN ('local', 'google', 'facebook'));

-- Make password_hash optional for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create indexes for OAuth lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_facebook_id ON users(facebook_id) WHERE facebook_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_provider ON users(provider);

-- Update existing users to have local provider
UPDATE users SET provider = 'local' WHERE provider IS NULL;