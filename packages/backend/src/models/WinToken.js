const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * WinToken Model
 *
 * Manages WIN token configuration and price history
 */
class WinToken {
  /**
   * Get WIN token configuration
   */
  static async getConfig() {
    try {
      const result = await query('SELECT * FROM win_token_config WHERE symbol = $1', ['WIN']);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting WIN token config:', error);
      throw error;
    }
  }

  /**
   * Update WIN token configuration
   */
  static async updateConfig(updates) {
    try {
      const allowedFields = [
        'current_price', 'market_cap', 'total_supply', 'circulating_supply',
        'daily_volume', 'liquidity', 'volatility', 'trend_strength',
        'min_price', 'max_price', 'simulation_enabled'
      ];

      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      const queryText = `
        UPDATE win_token_config
        SET ${updateFields.join(', ')}
        WHERE symbol = 'WIN'
        RETURNING *
      `;

      const result = await query(queryText, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating WIN token config:', error);
      throw error;
    }
  }

  /**
   * Update current price
   */
  static async updatePrice(newPrice) {
    try {
      const result = await query(
        `UPDATE win_token_config
         SET current_price = $1, last_price_update = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE symbol = 'WIN'
         RETURNING *`,
        [newPrice]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating WIN price:', error);
      throw error;
    }
  }

  /**
   * Insert price history candle
   */
  static async insertPriceCandle(candleData) {
    try {
      const {
        timeframe,
        timestamp,
        open,
        high,
        low,
        close,
        volume = 0,
        num_trades = 0,
        quote_volume = 0
      } = candleData;

      const queryText = `
        INSERT INTO win_price_history (
          symbol, timeframe, timestamp, open, high, low, close,
          volume, num_trades, quote_volume
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (symbol, timeframe, timestamp)
        DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          num_trades = EXCLUDED.num_trades,
          quote_volume = EXCLUDED.quote_volume
        RETURNING *
      `;

      const result = await query(queryText, [
        'WIN', timeframe, timestamp, open, high, low, close,
        volume, num_trades, quote_volume
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error inserting price candle:', error);
      throw error;
    }
  }

  /**
   * Get price history for a specific timeframe
   */
  static async getPriceHistory(timeframe, limit = 100) {
    try {
      const queryText = `
        SELECT * FROM win_price_history
        WHERE symbol = 'WIN' AND timeframe = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;

      const result = await query(queryText, [timeframe, limit]);
      return result.rows.reverse(); // Oldest first
    } catch (error) {
      logger.error('Error getting price history:', error);
      throw error;
    }
  }

  /**
   * Get latest price candle for a timeframe
   */
  static async getLatestCandle(timeframe) {
    try {
      const queryText = `
        SELECT * FROM win_price_history
        WHERE symbol = 'WIN' AND timeframe = $1
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await query(queryText, [timeframe]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting latest candle:', error);
      throw error;
    }
  }

  /**
   * Record a trade
   */
  static async recordTrade(tradeData) {
    try {
      const {
        trading_pair = 'WIN/USDT',
        side,
        price,
        quantity,
        is_simulated = true,
        user_id = null
      } = tradeData;

      const quote_quantity = parseFloat(price) * parseFloat(quantity);

      const queryText = `
        INSERT INTO win_trades (
          symbol, trading_pair, side, price, quantity,
          quote_quantity, is_simulated, user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await query(queryText, [
        'WIN', trading_pair, side, price, quantity,
        quote_quantity, is_simulated, user_id
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error recording trade:', error);
      throw error;
    }
  }

  /**
   * Get recent trades
   */
  static async getRecentTrades(limit = 50) {
    try {
      const queryText = `
        SELECT * FROM win_trades
        WHERE symbol = 'WIN'
        ORDER BY created_at DESC
        LIMIT $1
      `;

      const result = await query(queryText, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      throw error;
    }
  }

  /**
   * Get trading statistics
   */
  static async getStats(hours = 24) {
    try {
      const queryText = `
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_count,
          SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_count,
          SUM(quote_quantity) as total_volume,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price
        FROM win_trades
        WHERE symbol = 'WIN'
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      `;

      const result = await query(queryText);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting WIN stats:', error);
      throw error;
    }
  }

  /**
   * Get market summary
   */
  static async getMarketSummary() {
    try {
      const config = await this.getConfig();
      const stats24h = await this.getStats(24);
      const latestCandle1h = await this.getLatestCandle('1h');

      return {
        symbol: 'WIN',
        name: config.name,
        current_price: parseFloat(config.current_price),
        market_cap: parseFloat(config.market_cap),
        total_supply: parseFloat(config.total_supply),
        circulating_supply: parseFloat(config.circulating_supply),
        daily_volume: parseFloat(stats24h.total_volume || config.daily_volume),
        liquidity: parseFloat(config.liquidity),
        price_change_24h: latestCandle1h ?
          ((parseFloat(config.current_price) - parseFloat(latestCandle1h.open)) / parseFloat(latestCandle1h.open)) * 100 :
          0,
        high_24h: parseFloat(stats24h.max_price || config.current_price),
        low_24h: parseFloat(stats24h.min_price || config.current_price),
        trades_24h: parseInt(stats24h.total_trades || 0),
        simulation_enabled: config.simulation_enabled,
        last_updated: config.last_price_update
      };
    } catch (error) {
      logger.error('Error getting market summary:', error);
      throw error;
    }
  }
}

module.exports = WinToken;
