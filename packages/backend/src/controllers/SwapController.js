const Joi = require('joi');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const coinGeckoService = require('../services/CoinGeckoService');

class SwapController {
  /**
   * Get current price from CoinGecko
   */
  static async getPrice(req, res) {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Token symbol is required'
        });
      }

      const price = await coinGeckoService.getPrice(symbol);

      res.json({
        success: true,
        symbol: symbol.toUpperCase(),
        price,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get price error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch price'
      });
    }
  }

  /**
   * Get prices for multiple tokens
   */
  static async getPrices(req, res) {
    try {
      const { symbols } = req.query;

      if (!symbols) {
        return res.status(400).json({
          success: false,
          error: 'Token symbols are required'
        });
      }

      const symbolArray = symbols.split(',').map(s => s.trim().toUpperCase());

      // Separate WIN token from other tokens
      const hasWin = symbolArray.includes('WIN');
      const otherSymbols = symbolArray.filter(s => s !== 'WIN');

      // Get prices for non-WIN tokens from CoinGecko
      const prices = otherSymbols.length > 0
        ? await coinGeckoService.getPrices(otherSymbols)
        : {};

      // Add WIN price if requested
      if (hasWin) {
        const WinToken = require('../models/WinToken');
        const winConfig = await WinToken.getConfig();
        if (winConfig) {
          prices.WIN = parseFloat(winConfig.current_price);
        }
      }

      res.json({
        success: true,
        prices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get prices error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch prices'
      });
    }
  }

  /**
   * Calculate swap quote
   */
  static async getSwapQuote(req, res) {
    try {
      const schema = Joi.object({
        fromToken: Joi.string().uppercase().required(),
        toToken: Joi.string().uppercase().required(),
        fromAmount: Joi.number().positive().required()
      });

      const { error, value } = schema.validate(req.query);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const quote = await coinGeckoService.calculateSwap(
        value.fromToken,
        value.toToken,
        value.fromAmount
      );

      res.json({
        success: true,
        quote
      });
    } catch (error) {
      console.error('Get swap quote error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate swap'
      });
    }
  }

  /**
   * Execute market swap (instant swap at current market price)
   */
  static async executeMarketSwap(req, res) {
    const client = await require('../config/database').pool.connect();

    try {
      await client.query('BEGIN');

      const schema = Joi.object({
        fromToken: Joi.string().uppercase().required(),
        toToken: Joi.string().uppercase().required(),
        fromAmount: Joi.number().positive().required()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const userId = req.user.id;

      // Get swap calculation from CoinGecko
      const swapCalc = await coinGeckoService.calculateSwap(
        value.fromToken,
        value.toToken,
        value.fromAmount
      );

      // Check if user has sufficient balance for fromToken
      const fromBalanceQuery = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2',
        [userId, value.fromToken]
      );

      const fromBalance = parseFloat(fromBalanceQuery.rows[0]?.balance || 0);

      if (fromBalance < value.fromAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Insufficient ${value.fromToken} balance. Available: ${fromBalance}, Required: ${value.fromAmount}`
        });
      }

      // Deduct fromToken
      await client.query(
        `UPDATE wallets
         SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3`,
        [value.fromAmount, userId, value.fromToken]
      );

      // Add toToken
      await client.query(
        `INSERT INTO wallets (user_id, currency, balance)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency)
         DO UPDATE SET balance = wallets.balance + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, value.toToken, swapCalc.toAmount]
      );

      // Create swap record
      const swapId = uuidv4();
      await client.query(
        `INSERT INTO swaps (
          id, user_id, from_token, to_token, from_amount, to_amount,
          from_price, to_price, rate, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          swapId,
          userId,
          value.fromToken,
          value.toToken,
          value.fromAmount,
          swapCalc.toAmount,
          swapCalc.fromPrice,
          swapCalc.toPrice,
          swapCalc.rate,
          'completed'
        ]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Swap executed successfully',
        swap: {
          id: swapId,
          fromToken: value.fromToken,
          toToken: value.toToken,
          fromAmount: value.fromAmount,
          toAmount: swapCalc.toAmount,
          rate: swapCalc.rate,
          executedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Execute market swap error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute swap'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Create limit order (executes when CoinGecko price reaches target)
   */
  static async createLimitOrder(req, res) {
    try {
      const schema = Joi.object({
        fromToken: Joi.string().uppercase().required(),
        toToken: Joi.string().uppercase().required(),
        fromAmount: Joi.number().positive().required(),
        targetPrice: Joi.number().positive().required()
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const userId = req.user.id;

      // Check if user has sufficient balance
      const balanceQuery = await query(
        'SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2',
        [userId, value.fromToken]
      );

      const balance = parseFloat(balanceQuery.rows[0]?.balance || 0);

      if (balance < value.fromAmount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient ${value.fromToken} balance`
        });
      }

      // Create limit order
      const orderId = uuidv4();
      await query(
        `INSERT INTO limit_orders (
          id, user_id, from_token, to_token, from_amount, target_price, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, userId, value.fromToken, value.toToken, value.fromAmount, value.targetPrice, 'open']
      );

      // Lock the funds
      await query(
        `UPDATE wallets
         SET balance = balance - $1, locked_balance = locked_balance + $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3`,
        [value.fromAmount, userId, value.fromToken]
      );

      res.json({
        success: true,
        message: 'Limit order created successfully',
        order: {
          id: orderId,
          fromToken: value.fromToken,
          toToken: value.toToken,
          fromAmount: value.fromAmount,
          targetPrice: value.targetPrice,
          status: 'open',
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Create limit order error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create limit order'
      });
    }
  }

  /**
   * Get user's limit orders
   */
  static async getLimitOrders(req, res) {
    try {
      const userId = req.user.id;
      const { status } = req.query;

      let queryText = `
        SELECT * FROM limit_orders
        WHERE user_id = $1
      `;
      const params = [userId];

      if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY created_at DESC`;

      const result = await query(queryText, params);

      res.json({
        success: true,
        orders: result.rows
      });
    } catch (error) {
      console.error('Get limit orders error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch limit orders'
      });
    }
  }

  /**
   * Cancel limit order
   */
  static async cancelLimitOrder(req, res) {
    const client = await require('../config/database').pool.connect();

    try {
      await client.query('BEGIN');

      const { orderId } = req.params;
      const userId = req.user.id;

      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM limit_orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== 'open') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Can only cancel open orders'
        });
      }

      // Update order status
      await client.query(
        'UPDATE limit_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['cancelled', orderId]
      );

      // Unlock funds
      await client.query(
        `UPDATE wallets
         SET balance = balance + $1, locked_balance = locked_balance - $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND currency = $3`,
        [order.from_amount, userId, order.from_token]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Limit order cancelled successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Cancel limit order error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel limit order'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get swap history
   */
  static async getSwapHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const result = await query(
        `SELECT * FROM swaps
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({
        success: true,
        swaps: result.rows
      });
    } catch (error) {
      console.error('Get swap history error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch swap history'
      });
    }
  }

  /**
   * Get market chart data from CoinGecko
   */
  static async getMarketChart(req, res) {
    try {
      const { symbol } = req.params;
      const { days = 7 } = req.query;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Token symbol is required'
        });
      }

      const chartData = await coinGeckoService.getMarketChart(symbol, parseInt(days));

      res.json({
        success: true,
        symbol: symbol.toUpperCase(),
        chartData
      });
    } catch (error) {
      console.error('Get market chart error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch market chart'
      });
    }
  }
}

module.exports = SwapController;
