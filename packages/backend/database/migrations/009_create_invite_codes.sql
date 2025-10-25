-- Migration: Create invite codes table
-- This table stores one-time use invite codes for gated registration

CREATE TABLE IF NOT EXISTS invite_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_is_active ON invite_codes(is_active);
CREATE INDEX idx_invite_codes_created_by ON invite_codes(created_by);

-- Comments
COMMENT ON TABLE invite_codes IS 'One-time use invite codes for gated registration';
COMMENT ON COLUMN invite_codes.code IS 'Unique invite code (e.g., INVITE-XXXX-YYYY)';
COMMENT ON COLUMN invite_codes.created_by IS 'Admin user who created this code';
COMMENT ON COLUMN invite_codes.used_by IS 'User who used this code to register';
COMMENT ON COLUMN invite_codes.is_active IS 'Whether code can still be used';
COMMENT ON COLUMN invite_codes.max_uses IS 'Maximum number of times code can be used (default 1)';
COMMENT ON COLUMN invite_codes.current_uses IS 'How many times code has been used';
