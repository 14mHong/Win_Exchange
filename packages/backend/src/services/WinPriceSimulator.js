const WinToken = require('../models/WinToken');
const logger = require('../config/logger');

/**
 * WIN Token Price Simulator
 *
 * Simulates realistic price movements for the WIN token using
 * Geometric Brownian Motion with an upward trend.
 *
 * Features:
 * - Realistic volatility and price movements
 * - Long-term appreciation trend
 * - OHLCV candle generation
 * - Volume simulation
 * - Support/resistance levels
 */
class WinPriceSimulator {
  constructor() {
    this.isRunning = false;
    this.intervals = {};
    this.currentMinuteCandle = null;

    // Timeframes to generate
    this.timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  }

  /**
   * Start the price simulation
   */
  async start() {
    if (this.isRunning) {
      logger.warn('WIN Price Simulator already running');
      return;
    }

    const config = await WinToken.getConfig();
    if (!config || !config.simulation_enabled) {
      logger.info('WIN Price Simulator is disabled in config');
      return;
    }

    this.isRunning = true;
    logger.info('Starting WIN Price Simulator');

    // Generate price updates every 1 second for fastest real-time movement
    this.intervals.priceUpdate = setInterval(async () => {
      try {
        await this.generatePriceUpdate();
      } catch (error) {
        logger.error('Error in price update:', error);
      }
    }, 1000); // 1 second

    // Aggregate candles every 5 seconds for faster chart updates
    this.intervals.candleAggregation = setInterval(async () => {
      try {
        await this.aggregateCandles();
      } catch (error) {
        logger.error('Error aggregating candles:', error);
      }
    }, 5000); // 5 seconds

    // Generate simulated trades every 5-30 seconds
    this.generateRandomTrades();

    // Initial price update
    await this.generatePriceUpdate();

    logger.info('WIN Price Simulator started successfully');
  }

  /**
   * Stop the price simulation
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    Object.values(this.intervals).forEach(interval => clearInterval(interval));
    this.intervals = {};
    this.isRunning = false;

    logger.info('WIN Price Simulator stopped');
  }

  /**
   * Generate a new price update using Geometric Brownian Motion
   */
  async generatePriceUpdate() {
    try {
      const config = await WinToken.getConfig();
      if (!config || !config.simulation_enabled) {
        return;
      }

      const currentPrice = parseFloat(config.current_price);
      const minPrice = parseFloat(config.min_price);
      const maxPrice = parseFloat(config.max_price);
      const volatility = parseFloat(config.volatility); // Standard deviation
      const trendStrength = parseFloat(config.trend_strength); // Drift coefficient

      // Time step (1 second as fraction of year)
      const dt = 1 / (365 * 24 * 60 * 60);

      // Geometric Brownian Motion:
      // dS = μ * S * dt + σ * S * dW
      // Where:
      // - μ (mu) is the drift (trend)
      // - σ (sigma) is the volatility
      // - dW is Wiener process (random walk)

      const randomShock = this.boxMullerRandom();
      const drift = trendStrength * dt;
      const diffusion = volatility * Math.sqrt(dt) * randomShock;

      // Calculate new price
      let newPrice = currentPrice * Math.exp(drift + diffusion);

      // Add mean reversion to prevent extreme deviations
      const targetPrice = parseFloat(config.base_price) * (1 + trendStrength * (Date.now() / 1000 / (365 * 24 * 60 * 60)));
      const meanReversion = 0.001; // 0.1% mean reversion
      newPrice = newPrice + (targetPrice - newPrice) * meanReversion;

      // Enforce min/max bounds
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      // Update current price
      await WinToken.updatePrice(newPrice);

      // Update or create 1-minute candle
      await this.updateMinuteCandle(newPrice);

      logger.debug(`WIN price updated: $${currentPrice.toFixed(8)} → $${newPrice.toFixed(8)}`);

      return newPrice;
    } catch (error) {
      logger.error('Error generating price update:', error);
      throw error;
    }
  }

  /**
   * Box-Muller transform for generating normally distributed random numbers
   */
  boxMullerRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Update or create the current 1-minute candle
   */
  async updateMinuteCandle(price) {
    try {
      const now = new Date();
      const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        now.getHours(), now.getMinutes(), 0, 0);

      if (!this.currentMinuteCandle || this.currentMinuteCandle.timestamp.getTime() !== timestamp.getTime()) {
        // New candle
        this.currentMinuteCandle = {
          timestamp,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
          num_trades: 0,
          quote_volume: 0
        };
      } else {
        // Update existing candle
        this.currentMinuteCandle.close = price;
        this.currentMinuteCandle.high = Math.max(this.currentMinuteCandle.high, price);
        this.currentMinuteCandle.low = Math.min(this.currentMinuteCandle.low, price);
      }
    } catch (error) {
      logger.error('Error updating minute candle:', error);
    }
  }

  /**
   * Aggregate candles for different timeframes
   */
  async aggregateCandles() {
    try {
      // Save current 1-minute candle
      if (this.currentMinuteCandle) {
        await WinToken.insertPriceCandle({
          timeframe: '1m',
          ...this.currentMinuteCandle
        });

        // Generate higher timeframe candles
        await this.generateHigherTimeframeCandles();
      }
    } catch (error) {
      logger.error('Error aggregating candles:', error);
    }
  }

  /**
   * Generate candles for higher timeframes (5m, 15m, 1h, 4h, 1d)
   */
  async generateHigherTimeframeCandles() {
    try {
      const timeframeMinutes = {
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440
      };

      for (const [timeframe, minutes] of Object.entries(timeframeMinutes)) {
        const now = new Date();
        const timestamp = this.roundToTimeframe(now, minutes);

        // Get 1-minute candles for this period
        const startTime = new Date(timestamp.getTime() - minutes * 60 * 1000);
        const oneMinCandles = await this.get1MinCandlesSince(startTime);

        if (oneMinCandles.length === 0) continue;

        // Aggregate into higher timeframe candle
        const aggregatedCandle = {
          timeframe,
          timestamp,
          open: parseFloat(oneMinCandles[0].open),
          close: parseFloat(oneMinCandles[oneMinCandles.length - 1].close),
          high: Math.max(...oneMinCandles.map(c => parseFloat(c.high))),
          low: Math.min(...oneMinCandles.map(c => parseFloat(c.low))),
          volume: oneMinCandles.reduce((sum, c) => sum + parseFloat(c.volume || 0), 0),
          num_trades: oneMinCandles.reduce((sum, c) => sum + parseInt(c.num_trades || 0), 0),
          quote_volume: oneMinCandles.reduce((sum, c) => sum + parseFloat(c.quote_volume || 0), 0)
        };

        await WinToken.insertPriceCandle(aggregatedCandle);
      }
    } catch (error) {
      logger.error('Error generating higher timeframe candles:', error);
    }
  }

  /**
   * Round timestamp to nearest timeframe boundary
   */
  roundToTimeframe(date, minutes) {
    const ms = 1000 * 60 * minutes;
    return new Date(Math.floor(date.getTime() / ms) * ms);
  }

  /**
   * Get 1-minute candles since a timestamp
   */
  async get1MinCandlesSince(startTime) {
    try {
      const { query } = require('../config/database');
      const result = await query(
        `SELECT * FROM win_price_history
         WHERE symbol = 'WIN' AND timeframe = '1m' AND timestamp >= $1
         ORDER BY timestamp ASC`,
        [startTime]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching 1-min candles:', error);
      return [];
    }
  }

  /**
   * Generate random simulated trades
   */
  async generateRandomTrades() {
    const minDelay = 5000;  // 5 seconds
    const maxDelay = 30000; // 30 seconds

    const generateTrade = async () => {
      if (!this.isRunning) return;

      try {
        const config = await WinToken.getConfig();
        if (!config || !config.simulation_enabled) {
          // Schedule next trade
          setTimeout(generateTrade, this.randomBetween(minDelay, maxDelay));
          return;
        }

        const price = parseFloat(config.current_price);
        const side = Math.random() > 0.5 ? 'buy' : 'sell';

        // Random quantity between 10 and 10000 WIN
        const quantity = this.randomBetween(10, 10000);

        // Add some price variation (±0.1%)
        const priceVariation = 1 + (Math.random() - 0.5) * 0.002;
        const tradePrice = price * priceVariation;

        await WinToken.recordTrade({
          side,
          price: tradePrice,
          quantity,
          is_simulated: true
        });

        // Update candle volume
        if (this.currentMinuteCandle) {
          const quoteVolume = tradePrice * quantity;
          this.currentMinuteCandle.volume += quantity;
          this.currentMinuteCandle.quote_volume += quoteVolume;
          this.currentMinuteCandle.num_trades += 1;
        }

        logger.debug(`Simulated ${side} trade: ${quantity} WIN @ $${tradePrice.toFixed(8)}`);
      } catch (error) {
        logger.error('Error generating simulated trade:', error);
      }

      // Schedule next trade
      setTimeout(generateTrade, this.randomBetween(minDelay, maxDelay));
    };

    // Start generating trades
    setTimeout(generateTrade, this.randomBetween(minDelay, maxDelay));
  }

  /**
   * Generate random number between min and max
   */
  randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Manual price adjustment (for admin control)
   */
  async adjustPrice(newPrice, reason = 'Admin adjustment') {
    try {
      const config = await WinToken.getConfig();
      const minPrice = parseFloat(config.min_price);
      const maxPrice = parseFloat(config.max_price);

      // Validate bounds
      if (newPrice < minPrice || newPrice > maxPrice) {
        throw new Error(`Price must be between ${minPrice} and ${maxPrice}`);
      }

      await WinToken.updatePrice(newPrice);
      await this.updateMinuteCandle(newPrice);

      logger.info(`WIN price manually adjusted to $${newPrice}: ${reason}`);

      return { success: true, new_price: newPrice };
    } catch (error) {
      logger.error('Error adjusting price:', error);
      throw error;
    }
  }

  /**
   * Get simulator status
   */
  getStatus() {
    return {
      is_running: this.isRunning,
      active_intervals: Object.keys(this.intervals).length
    };
  }
}

// Singleton instance
module.exports = new WinPriceSimulator();
