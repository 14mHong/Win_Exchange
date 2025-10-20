-- Convert all VARCHAR columns to TEXT to avoid length issues
-- This is safer for OAuth data which can have variable lengths

ALTER TABLE users
  ALTER COLUMN email TYPE TEXT,
  ALTER COLUMN first_name TYPE TEXT,
  ALTER COLUMN last_name TYPE TEXT,
  ALTER COLUMN phone TYPE TEXT,
  ALTER COLUMN provider TYPE TEXT,
  ALTER COLUMN google_id TYPE TEXT,
  ALTER COLUMN profile_image TYPE TEXT,
  ALTER COLUMN two_fa_secret TYPE TEXT;

-- Also make sure password_hash is TEXT (was probably already TEXT)
ALTER TABLE users
  ALTER COLUMN password_hash TYPE TEXT;

-- Verify the changes
\d users;
