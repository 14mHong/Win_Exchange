-- Fix column lengths for OAuth data
-- Google profile image URLs can be very long

ALTER TABLE users
  ALTER COLUMN profile_image TYPE TEXT;

-- Also ensure google_id is long enough
ALTER TABLE users
  ALTER COLUMN google_id TYPE TEXT;

-- Verify the changes
\d users;
