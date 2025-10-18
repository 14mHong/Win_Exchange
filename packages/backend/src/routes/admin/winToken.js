const express = require('express');
const router = express.Router();
const WinToken = require('../../models/WinToken');
const WinPriceSimulator = require('../../services/WinPriceSimulator');
const logger = require('../../config/logger');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/admin');

/**
 * Admin routes for WIN token management
 * All routes require admin authentication
 */

/**
 * GET /api/admin/win-token/config
 * Get WIN token configuration
 */
router.get('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const config = await WinToken.getConfig();

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WIN token configuration not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...config,
        current_price: parseFloat(config.current_price),
        base_price: parseFloat(config.base_price),
        market_cap: parseFloat(config.market_cap),
        total_supply: parseFloat(config.total_supply),
        circulating_supply: parseFloat(config.circulating_supply),
        daily_volume: parseFloat(config.daily_volume),
        liquidity: parseFloat(config.liquidity),
        volatility: parseFloat(config.volatility),
        trend_strength: parseFloat(config.trend_strength),
        min_price: parseFloat(config.min_price),
        max_price: parseFloat(config.max_price)
      }
    });
  } catch (error) {
    logger.error('Error getting WIN token config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WIN token configuration'
    });
  }
});

/**
 * PUT /api/admin/win-token/config
 * Update WIN token configuration
 */
router.put('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const allowedUpdates = [
      'market_cap', 'total_supply', 'circulating_supply',
      'daily_volume', 'liquidity', 'volatility', 'trend_strength',
      'min_price', 'max_price', 'simulation_enabled'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        allowed_fields: allowedUpdates
      });
    }

    const updatedConfig = await WinToken.updateConfig(updates);

    logger.info(`WIN token config updated by admin ${req.user.id}:`, updates);

    res.json({
      success: true,
      message: 'WIN token configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    logger.error('Error updating WIN token config:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update WIN token configuration'
    });
  }
});

/**
 * POST /api/admin/win-token/price
 * Manually adjust WIN token price
 */
router.post('/price', authenticate, requireAdmin, async (req, res) => {
  try {
    const { price, reason } = req.body;

    if (!price || isNaN(price)) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }

    const result = await WinPriceSimulator.adjustPrice(
      parseFloat(price),
      reason || `Manual adjustment by admin ${req.user.email}`
    );

    logger.info(`WIN price manually set to $${price} by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Price updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error adjusting WIN price:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to adjust price'
    });
  }
});

/**
 * GET /api/admin/win-token/stats
 * Get WIN token statistics
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;

    const [config, stats, marketSummary] = await Promise.all([
      WinToken.getConfig(),
      WinToken.getStats(hours),
      WinToken.getMarketSummary()
    ]);

    res.json({
      success: true,
      data: {
        config,
        stats: {
          ...stats,
          total_volume: parseFloat(stats.total_volume || 0),
          avg_price: parseFloat(stats.avg_price || 0),
          min_price: parseFloat(stats.min_price || 0),
          max_price: parseFloat(stats.max_price || 0)
        },
        market_summary: marketSummary
      }
    });
  } catch (error) {
    logger.error('Error getting WIN token stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WIN token statistics'
    });
  }
});

/**
 * GET /api/admin/win-token/trades
 * Get recent WIN token trades
 */
router.get('/trades', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const trades = await WinToken.getRecentTrades(limit);

    res.json({
      success: true,
      data: trades.map(trade => ({
        ...trade,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.quantity),
        quote_quantity: parseFloat(trade.quote_quantity)
      }))
    });
  } catch (error) {
    logger.error('Error getting WIN trades:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WIN token trades'
    });
  }
});

/**
 * POST /api/admin/win-token/simulator/start
 * Start price simulator
 */
router.post('/simulator/start', authenticate, requireAdmin, async (req, res) => {
  try {
    await WinPriceSimulator.start();

    logger.info(`WIN price simulator started by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Price simulator started successfully',
      status: WinPriceSimulator.getStatus()
    });
  } catch (error) {
    logger.error('Error starting price simulator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start price simulator'
    });
  }
});

/**
 * POST /api/admin/win-token/simulator/stop
 * Stop price simulator
 */
router.post('/simulator/stop', authenticate, requireAdmin, async (req, res) => {
  try {
    WinPriceSimulator.stop();

    logger.info(`WIN price simulator stopped by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Price simulator stopped successfully',
      status: WinPriceSimulator.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping price simulator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop price simulator'
    });
  }
});

/**
 * GET /api/admin/win-token/simulator/status
 * Get simulator status
 */
router.get('/simulator/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const status = WinPriceSimulator.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting simulator status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get simulator status'
    });
  }
});

module.exports = router;
