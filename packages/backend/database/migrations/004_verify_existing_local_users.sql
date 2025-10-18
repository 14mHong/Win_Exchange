-- Mark all existing local users as email verified
-- This is safe because the current registration flow requires email verification
-- before user creation, so any existing users should have verified emails
UPDATE users
SET email_verified = true, updated_at = CURRENT_TIMESTAMP
WHERE provider = 'local' AND email_verified = false;
