const express = require('express');
const router = express.Router();
const WinToken = require('../../models/WinToken');
const logger = require('../../config/logger');

/**
 * Public API routes for WIN token
 * These are accessible to all users
 */

/**
 * GET /api/win-token/price
 * Get current WIN token price
 */
router.get('/price', async (req, res) => {
  try {
    const config = await WinToken.getConfig();

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WIN token not found'
      });
    }

    res.json({
      success: true,
      data: {
        symbol: 'WIN',
        price: parseFloat(config.current_price),
        last_updated: config.last_price_update
      }
    });
  } catch (error) {
    logger.error('Error getting WIN price:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WIN price'
    });
  }
});

/**
 * GET /api/win-token/market
 * Get WIN token market summary
 */
router.get('/market', async (req, res) => {
  try {
    const marketSummary = await WinToken.getMarketSummary();

    res.json({
      success: true,
      data: marketSummary
    });
  } catch (error) {
    logger.error('Error getting WIN market summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get market summary'
    });
  }
});

/**
 * GET /api/win-token/chart/:timeframe
 * Get WIN token price history for charting
 *
 * Supported timeframes: 1m, 5m, 15m, 1h, 4h, 1d
 */
router.get('/chart/:timeframe', async (req, res) => {
  try {
    const { timeframe } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe',
        valid_timeframes: validTimeframes
      });
    }

    const history = await WinToken.getPriceHistory(timeframe, limit);

    res.json({
      success: true,
      data: {
        symbol: 'WIN',
        timeframe,
        candles: history.map(candle => ({
          timestamp: candle.timestamp,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume || 0),
          num_trades: parseInt(candle.num_trades || 0)
        }))
      }
    });
  } catch (error) {
    logger.error('Error getting WIN chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chart data'
    });
  }
});

/**
 * GET /api/win-token/trades
 * Get recent WIN token trades
 */
router.get('/trades', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const trades = await WinToken.getRecentTrades(limit);

    res.json({
      success: true,
      data: trades.map(trade => ({
        id: trade.id,
        side: trade.side,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.quantity),
        quote_quantity: parseFloat(trade.quote_quantity),
        timestamp: trade.created_at
      }))
    });
  } catch (error) {
    logger.error('Error getting WIN trades:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trades'
    });
  }
});

/**
 * GET /api/win-token/stats
 * Get WIN token statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await WinToken.getStats(hours);

    res.json({
      success: true,
      data: {
        period_hours: hours,
        total_trades: parseInt(stats.total_trades || 0),
        buy_trades: parseInt(stats.buy_count || 0),
        sell_trades: parseInt(stats.sell_count || 0),
        total_volume: parseFloat(stats.total_volume || 0),
        avg_price: parseFloat(stats.avg_price || 0),
        high_price: parseFloat(stats.max_price || 0),
        low_price: parseFloat(stats.min_price || 0)
      }
    });
  } catch (error) {
    logger.error('Error getting WIN stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

/**
 * GET /api/win-token/ticker/24h
 * Get 24-hour ticker data
 */
router.get('/ticker/24h', async (req, res) => {
  try {
    const [config, stats24h] = await Promise.all([
      WinToken.getConfig(),
      WinToken.getStats(24)
    ]);

    // Get 24h ago candle for price change calculation
    const { query } = require('../../config/database');
    const result = await query(
      `SELECT open FROM win_price_history
       WHERE symbol = 'WIN' AND timeframe = '1h'
         AND timestamp <= CURRENT_TIMESTAMP - INTERVAL '24 hours'
       ORDER BY timestamp DESC
       LIMIT 1`
    );

    const price24hAgo = result.rows[0] ? parseFloat(result.rows[0].open) : parseFloat(config.current_price);
    const currentPrice = parseFloat(config.current_price);
    const priceChange = currentPrice - price24hAgo;
    const priceChangePercent = (priceChange / price24hAgo) * 100;

    res.json({
      success: true,
      data: {
        symbol: 'WIN/USDT',
        last_price: currentPrice,
        price_change: priceChange,
        price_change_percent: priceChangePercent,
        high_price: parseFloat(stats24h.max_price || currentPrice),
        low_price: parseFloat(stats24h.min_price || currentPrice),
        volume: parseFloat(stats24h.total_volume || 0),
        quote_volume: parseFloat(stats24h.total_volume || 0),
        num_trades: parseInt(stats24h.total_trades || 0),
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Error getting WIN 24h ticker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ticker data'
    });
  }
});

module.exports = router;
