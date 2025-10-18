-- Create swaps table for completed swaps
CREATE TABLE IF NOT EXISTS swaps (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(10) NOT NULL,
    to_token VARCHAR(10) NOT NULL,
    from_amount DECIMAL(20, 8) NOT NULL,
    to_amount DECIMAL(20, 8) NOT NULL,
    from_price DECIMAL(20, 8) NOT NULL,
    to_price DECIMAL(20, 8) NOT NULL,
    rate DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create limit_orders table for pending limit orders
CREATE TABLE IF NOT EXISTS limit_orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_token VARCHAR(10) NOT NULL,
    to_token VARCHAR(10) NOT NULL,
    from_amount DECIMAL(20, 8) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, filled, cancelled, expired
    filled_amount DECIMAL(20, 8) DEFAULT 0,
    filled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Add locked_balance column to wallet_balances if it doesn't exist
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(20, 8) DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_swaps_user_id ON swaps(user_id);
CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_limit_orders_user_id ON limit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_tokens ON limit_orders(from_token, to_token);
