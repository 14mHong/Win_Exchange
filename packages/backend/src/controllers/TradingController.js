const TradingEngine = require('../services/TradingEngine');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const TradingPair = require('../models/TradingPair');
const logger = require('../config/logger');
const Joi = require('joi');

class TradingController {
  // Place a new order
  static async placeOrder(req, res) {
    try {
      const schema = Joi.object({
        trading_pair: Joi.string().required(),
        order_type: Joi.string().valid('market', 'limit').required(),
        side: Joi.string().valid('buy', 'sell').required(),
        quantity: Joi.number().positive().required(),
        price: Joi.number().positive().when('order_type', {
          is: 'limit',
          then: Joi.required(),
          otherwise: Joi.optional()
        }),
        time_in_force: Joi.string().valid('GTC', 'IOC', 'FOK').default('GTC')
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const {
        trading_pair,
        order_type,
        side,
        quantity,
        price,
        time_in_force
      } = value;

      const result = await TradingEngine.placeOrder(req.user.id, {
        trading_pair_symbol: trading_pair,
        order_type,
        side,
        quantity,
        price,
        time_in_force
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Place order error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Cancel an order
  static async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
      }

      const result = await TradingEngine.cancelOrder(req.user.id, orderId);
      res.json(result);
    } catch (error) {
      logger.error('Cancel order error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user's orders
  static async getUserOrders(req, res) {
    try {
      const schema = Joi.object({
        status: Joi.string().valid('open', 'filled', 'canceled', 'expired', 'partially_filled').optional(),
        trading_pair: Joi.string().optional(),
        side: Joi.string().valid('buy', 'sell').optional(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0)
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      let tradingPairId = null;
      if (value.trading_pair) {
        const tradingPair = await TradingPair.findBySymbol(value.trading_pair);
        if (!tradingPair) {
          return res.status(400).json({
            success: false,
            error: 'Invalid trading pair'
          });
        }
        tradingPairId = tradingPair.id;
      }

      const orders = await Order.findByUserId(req.user.id, {
        status: value.status,
        trading_pair_id: tradingPairId,
        side: value.side,
        limit: value.limit,
        offset: value.offset
      });

      res.json({
        success: true,
        orders: orders.map(order => order.toJSON()),
        total: orders.length
      });
    } catch (error) {
      logger.error('Get user orders error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get specific order
  static async getOrder(req, res) {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
      }

      const order = await Order.findById(orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      if (order.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        order: order.toJSON()
      });
    } catch (error) {
      logger.error('Get order error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user's trade history
  static async getTradeHistory(req, res) {
    try {
      const schema = Joi.object({
        trading_pair: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0),
        start_date: Joi.date().iso().optional(),
        end_date: Joi.date().iso().optional()
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      let tradingPairId = null;
      if (value.trading_pair) {
        const tradingPair = await TradingPair.findBySymbol(value.trading_pair);
        if (!tradingPair) {
          return res.status(400).json({
            success: false,
            error: 'Invalid trading pair'
          });
        }
        tradingPairId = tradingPair.id;
      }

      const trades = await Trade.findByUserId(req.user.id, {
        trading_pair_id: tradingPairId,
        limit: value.limit,
        offset: value.offset,
        start_date: value.start_date,
        end_date: value.end_date
      });

      res.json({
        success: true,
        trades: trades.map(trade => trade.toJSON()),
        total: trades.length
      });
    } catch (error) {
      logger.error('Get trade history error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get order book
  static async getOrderBook(req, res) {
    try {
      const { tradingPair } = req.params;
      const depth = parseInt(req.query.depth) || 20;

      if (!tradingPair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required'
        });
      }

      if (depth < 1 || depth > 100) {
        return res.status(400).json({
          success: false,
          error: 'Depth must be between 1 and 100'
        });
      }

      const result = await TradingEngine.getOrderBook(tradingPair, depth);
      res.json(result);
    } catch (error) {
      logger.error('Get order book error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get recent trades
  static async getRecentTrades(req, res) {
    try {
      const { tradingPair } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      if (!tradingPair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required'
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100'
        });
      }

      const result = await TradingEngine.getRecentTrades(tradingPair, limit);
      res.json(result);
    } catch (error) {
      logger.error('Get recent trades error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get 24h statistics
  static async get24hStats(req, res) {
    try {
      const { tradingPair } = req.params;

      if (!tradingPair) {
        // Get stats for all trading pairs
        const tradingPairs = await TradingPair.findActive();
        const allStats = await Promise.all(
          tradingPairs.map(async (pair) => {
            const stats = await TradingEngine.get24hStats(pair.symbol);
            return {
              trading_pair: pair.symbol,
              ...stats.stats
            };
          })
        );

        return res.json({
          success: true,
          stats: allStats
        });
      }

      const result = await TradingEngine.get24hStats(tradingPair);
      res.json(result);
    } catch (error) {
      logger.error('Get 24h stats error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get OHLCV data for charts
  static async getOHLCVData(req, res) {
    try {
      const { tradingPair } = req.params;
      const schema = Joi.object({
        interval: Joi.string().valid('1m', '5m', '15m', '1h', '4h', '1d').default('1h'),
        limit: Joi.number().integer().min(1).max(1000).default(100)
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      if (!tradingPair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair is required'
        });
      }

      const result = await TradingEngine.getOHLCVData(
        tradingPair,
        value.interval,
        value.limit
      );

      res.json(result);
    } catch (error) {
      logger.error('Get OHLCV data error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get trading pairs
  static async getTradingPairs(req, res) {
    try {
      const tradingPairs = await TradingPair.findActive();
      
      res.json({
        success: true,
        trading_pairs: tradingPairs.map(pair => pair.toJSON())
      });
    } catch (error) {
      logger.error('Get trading pairs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trading pairs'
      });
    }
  }

  // Get user trading statistics
  static async getUserTradingStats(req, res) {
    try {
      const schema = Joi.object({
        period: Joi.string().valid('1d', '7d', '30d').default('30d')
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const stats = await Trade.getUserTradingStats(req.user.id, value.period);
      
      res.json({
        success: true,
        period: value.period,
        stats
      });
    } catch (error) {
      logger.error('Get user trading stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get open orders count
  static async getOpenOrdersCount(req, res) {
    try {
      const orders = await Order.findByUserId(req.user.id, { status: 'open' });
      const partiallyFilledOrders = await Order.findByUserId(req.user.id, { status: 'partially_filled' });
      
      res.json({
        success: true,
        open_orders: orders.length,
        partially_filled_orders: partiallyFilledOrders.length,
        total_active_orders: orders.length + partiallyFilledOrders.length
      });
    } catch (error) {
      logger.error('Get open orders count error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Cancel all orders for a trading pair
  static async cancelAllOrders(req, res) {
    try {
      const schema = Joi.object({
        trading_pair: Joi.string().optional(),
        side: Joi.string().valid('buy', 'sell').optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      let tradingPairId = null;
      if (value.trading_pair) {
        const tradingPair = await TradingPair.findBySymbol(value.trading_pair);
        if (!tradingPair) {
          return res.status(400).json({
            success: false,
            error: 'Invalid trading pair'
          });
        }
        tradingPairId = tradingPair.id;
      }

      const openOrders = await Order.findByUserId(req.user.id, {
        status: 'open',
        trading_pair_id: tradingPairId,
        side: value.side
      });

      const partiallyFilledOrders = await Order.findByUserId(req.user.id, {
        status: 'partially_filled',
        trading_pair_id: tradingPairId,
        side: value.side
      });

      const allOrders = [...openOrders, ...partiallyFilledOrders];
      const canceledOrders = [];

      for (const order of allOrders) {
        try {
          await TradingEngine.cancelOrder(req.user.id, order.id);
          canceledOrders.push(order.id);
        } catch (error) {
          logger.error(`Failed to cancel order ${order.id}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Canceled ${canceledOrders.length} orders`,
        canceled_orders: canceledOrders,
        total_orders: allOrders.length
      });
    } catch (error) {
      logger.error('Cancel all orders error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create a new trading pair (admin function)
  static async createTradingPair(req, res) {
    try {
      const schema = Joi.object({
        symbol: Joi.string().pattern(/^[A-Z]+-[A-Z]+$/).required(),
        base_currency: Joi.string().uppercase().min(2).max(10).required(),
        quote_currency: Joi.string().uppercase().min(2).max(10).required(),
        min_order_size: Joi.number().positive().required(),
        max_order_size: Joi.number().positive().required(),
        price_precision: Joi.number().integer().min(0).max(8).default(2),
        quantity_precision: Joi.number().integer().min(0).max(8).default(8)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      // Check if trading pair already exists
      const existingPair = await TradingPair.findBySymbol(value.symbol);
      if (existingPair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair already exists'
        });
      }

      // Validate that symbol matches base-quote format
      const expectedSymbol = `${value.base_currency}-${value.quote_currency}`;
      if (value.symbol !== expectedSymbol) {
        return res.status(400).json({
          success: false,
          error: `Symbol must be in format ${expectedSymbol}`
        });
      }

      // Validate min < max
      if (value.min_order_size >= value.max_order_size) {
        return res.status(400).json({
          success: false,
          error: 'Minimum order size must be less than maximum order size'
        });
      }

      const tradingPair = await TradingPair.create(value);

      logger.logUserAction(req.user.id, 'TRADING_PAIR_CREATED', {
        symbol: value.symbol,
        base_currency: value.base_currency,
        quote_currency: value.quote_currency
      });

      res.status(201).json({
        success: true,
        trading_pair: tradingPair.toJSON(),
        message: `Trading pair ${value.symbol} created successfully`
      });
    } catch (error) {
      logger.error('Create trading pair error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update trading pair status
  static async updateTradingPairStatus(req, res) {
    try {
      const { symbol } = req.params;
      const schema = Joi.object({
        is_active: Joi.boolean().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const tradingPair = await TradingPair.findBySymbol(symbol);
      if (!tradingPair) {
        return res.status(404).json({
          success: false,
          error: 'Trading pair not found'
        });
      }

      await tradingPair.updateStatus(value.is_active);

      logger.logUserAction(req.user.id, 'TRADING_PAIR_STATUS_UPDATED', {
        symbol,
        is_active: value.is_active
      });

      res.json({
        success: true,
        trading_pair: tradingPair.toJSON(),
        message: `Trading pair ${symbol} ${value.is_active ? 'activated' : 'deactivated'}`
      });
    } catch (error) {
      logger.error('Update trading pair status error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = TradingController;