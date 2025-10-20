-- Make password_hash nullable for OAuth users
-- OAuth users (Google login) don't need passwords

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- Verify the change
\d users;
