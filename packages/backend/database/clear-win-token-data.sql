-- Clear all WIN token historical data and reset the engine
-- This will remove all price history and trades to start fresh

BEGIN;

-- Delete all WIN price history candles
DELETE FROM win_price_history WHERE symbol = 'WIN';

-- Delete all WIN trades
DELETE FROM win_trades WHERE symbol = 'WIN';

-- Reset WIN token price and update volatility for more movement
UPDATE win_token_config
SET
    current_price = 0.0001,
    base_price = 0.0001,
    min_price = 0.00001,
    max_price = NULL,
    volatility = 1.5,           -- Increased from default (150% annual volatility)
    trend_strength = 0.5,       -- 50% annual upward trend
    last_price_update = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'WIN';

-- Show updated configuration
SELECT
    symbol,
    current_price,
    base_price,
    volatility,
    trend_strength,
    simulation_enabled
FROM win_token_config
WHERE symbol = 'WIN';

-- Show counts to confirm cleanup
SELECT 
    'Price History' as data_type,
    COUNT(*) as count
FROM win_price_history
WHERE symbol = 'WIN'
UNION ALL
SELECT 
    'Trades' as data_type,
    COUNT(*) as count
FROM win_trades
WHERE symbol = 'WIN';

COMMIT;
