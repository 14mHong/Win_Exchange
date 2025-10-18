const { query, pool } = require('../config/database');
const coinGeckoService = require('./CoinGeckoService');
const logger = require('../config/logger');

class LimitOrderMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 30000; // Check every 30 seconds
    this.intervalId = null;
  }

  /**
   * Start monitoring limit orders
   */
  start() {
    if (this.isRunning) {
      logger.info('Limit order monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting limit order monitor...');

    // Run immediately
    this.checkLimitOrders();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.checkLimitOrders();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Limit order monitor stopped');
  }

  /**
   * Check all open limit orders and execute if price reached
   */
  async checkLimitOrders() {
    try {
      // Get all open limit orders
      const result = await query(
        `SELECT * FROM limit_orders WHERE status = 'open'`
      );

      if (result.rows.length === 0) {
        return;
      }

      logger.info(`Checking ${result.rows.length} open limit orders`);

      // Group orders by token pairs to minimize API calls
      const ordersByPair = {};
      result.rows.forEach(order => {
        const key = `${order.from_token}_${order.to_token}`;
        if (!ordersByPair[key]) {
          ordersByPair[key] = [];
        }
        ordersByPair[key].push(order);
      });

      // Check each pair
      for (const [pairKey, orders] of Object.entries(ordersByPair)) {
        const [fromToken, toToken] = pairKey.split('_');

        try {
          // Get current price from CoinGecko
          const swapCalc = await coinGeckoService.calculateSwap(fromToken, toToken, 1);
          const currentRate = swapCalc.rate;

          // Check each order for this pair
          for (const order of orders) {
            // Check if current rate meets or exceeds target rate
            // For sell orders: current price >= target price
            // For buy orders: current price <= target price (if we implement sell-to-buy logic)
            const targetRate = parseFloat(order.target_price);

            if (currentRate >= targetRate) {
              logger.info(`Limit order ${order.id} triggered at rate ${currentRate}`);
              await this.executeLimitOrder(order, swapCalc);
            }
          }
        } catch (error) {
          logger.error(`Error checking orders for pair ${pairKey}:`, error.message);
          continue;
        }
      }
    } catch (error) {
      logger.error('Error in checkLimitOrders:', error);
    }
  }

  /**
   * Execute a limit order
   */
  async executeLimitOrder(order, swapCalc) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Calculate actual swap amounts
      const actualSwapCalc = await coinGeckoService.calculateSwap(
        order.from_token,
        order.to_token,
        parseFloat(order.from_amount)
      );

      // Unlock and deduct fromToken from locked balance
      await client.query(
        `UPDATE wallets
         SET locked_balance = locked_balance - $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3`,
        [order.from_amount, order.user_id, order.from_token]
      );

      // Add toToken
      await client.query(
        `INSERT INTO wallets (user_id, currency, balance)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency)
         DO UPDATE SET balance = wallets.balance + $3, updated_at = CURRENT_TIMESTAMP`,
        [order.user_id, order.to_token, actualSwapCalc.toAmount]
      );

      // Update limit order status
      await client.query(
        `UPDATE limit_orders
         SET status = 'filled',
             filled_amount = $1,
             filled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [actualSwapCalc.toAmount, order.id]
      );

      // Create swap record
      const { v4: uuidv4 } = require('uuid');
      const swapId = uuidv4();

      await client.query(
        `INSERT INTO swaps (
          id, user_id, from_token, to_token, from_amount, to_amount,
          from_price, to_price, rate, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          swapId,
          order.user_id,
          order.from_token,
          order.to_token,
          order.from_amount,
          actualSwapCalc.toAmount,
          actualSwapCalc.fromPrice,
          actualSwapCalc.toPrice,
          actualSwapCalc.rate,
          'completed'
        ]
      );

      await client.query('COMMIT');

      logger.info(`Successfully executed limit order ${order.id} for user ${order.user_id}`);
      logger.info(`Swapped ${order.from_amount} ${order.from_token} for ${actualSwapCalc.toAmount} ${order.to_token}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error executing limit order ${order.id}:`, error);

      // Mark order as failed
      try {
        await query(
          `UPDATE limit_orders SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [order.id]
        );
      } catch (updateError) {
        logger.error(`Error updating failed order status:`, updateError);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get monitor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval
    };
  }
}

// Create singleton instance
const limitOrderMonitor = new LimitOrderMonitor();

module.exports = limitOrderMonitor;
