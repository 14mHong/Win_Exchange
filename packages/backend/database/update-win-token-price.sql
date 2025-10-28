-- Update WIN Token Base Price to 0.0001
-- Remove max price constraint to allow free bullish movement

BEGIN;

-- Update WIN token configuration
UPDATE win_token_config
SET
    base_price = 0.0001,
    current_price = 0.0001,
    min_price = 0.00001,  -- Minimum floor to prevent going to zero
    max_price = NULL,     -- Remove max price constraint for unlimited upside
    updated_at = CURRENT_TIMESTAMP,
    last_price_update = CURRENT_TIMESTAMP
WHERE symbol = 'WIN';

-- Show updated configuration
SELECT
    symbol,
    name,
    base_price,
    current_price,
    min_price,
    max_price,
    volatility,
    trend_strength,
    simulation_enabled,
    updated_at
FROM win_token_config
WHERE symbol = 'WIN';

COMMIT;
