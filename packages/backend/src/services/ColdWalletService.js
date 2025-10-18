const logger = require('../config/logger');
const { query } = require('../config/database');

/**
 * Cold Wallet Management Service
 *
 * Manages fund sweeping from hot wallets to cold storage
 * and fund rebalancing when hot wallet runs low
 */
class ColdWalletService {
  constructor() {
    // Load cold wallet addresses from environment
    this.coldWallets = {
      BTC: process.env.COLD_WALLET_BTC,
      ETH: process.env.COLD_WALLET_ETH,
      LTC: process.env.COLD_WALLET_LTC,
      USDT: process.env.COLD_WALLET_USDT,
      USDC: process.env.COLD_WALLET_USDC
    };

    // Hot wallet thresholds (when to sweep)
    this.hotWalletMaxThresholds = {
      BTC: parseFloat(process.env.HOT_WALLET_MAX_BTC || '0.5'),
      ETH: parseFloat(process.env.HOT_WALLET_MAX_ETH || '10'),
      LTC: parseFloat(process.env.HOT_WALLET_MAX_LTC || '100'),
      USDT: parseFloat(process.env.HOT_WALLET_MAX_USDT || '10000'),
      USDC: parseFloat(process.env.HOT_WALLET_MAX_USDC || '10000')
    };

    // Hot wallet minimum thresholds (when to rebalance from cold)
    this.hotWalletMinThresholds = {
      BTC: parseFloat(process.env.HOT_WALLET_MIN_BTC || '0.1'),
      ETH: parseFloat(process.env.HOT_WALLET_MIN_ETH || '2'),
      LTC: parseFloat(process.env.HOT_WALLET_MIN_LTC || '20'),
      USDT: parseFloat(process.env.HOT_WALLET_MIN_USDT || '2000'),
      USDC: parseFloat(process.env.HOT_WALLET_MIN_USDC || '2000')
    };

    logger.info('ColdWalletService initialized', {
      configuredCurrencies: Object.keys(this.coldWallets).filter(k => this.coldWallets[k])
    });
  }

  /**
   * Get cold wallet address for a currency
   */
  getColdWalletAddress(currency) {
    return this.coldWallets[currency];
  }

  /**
   * Check if hot wallet needs to be swept to cold storage
   */
  async checkAndSweepIfNeeded(currency) {
    try {
      const coldAddress = this.coldWallets[currency];
      if (!coldAddress) {
        logger.warn(`No cold wallet configured for ${currency}`);
        return null;
      }

      // Get total hot wallet balance
      const hotBalance = await this.getHotWalletBalance(currency);
      const threshold = this.hotWalletMaxThresholds[currency];

      if (hotBalance > threshold) {
        const amountToSweep = hotBalance - (threshold * 0.5); // Keep 50% of threshold

        logger.warn('Hot wallet threshold exceeded - sweep needed', {
          currency,
          hotBalance,
          threshold,
          amountToSweep,
          coldAddress
        });

        // Create sweep request (requires manual approval)
        await this.createSweepRequest(currency, amountToSweep, coldAddress);

        return {
          needsSweep: true,
          amount: amountToSweep,
          coldAddress
        };
      }

      return { needsSweep: false };
    } catch (error) {
      logger.error('Error checking sweep requirement:', error);
      throw error;
    }
  }

  /**
   * Get total hot wallet balance for a currency
   */
  async getHotWalletBalance(currency) {
    // Sum all user balances + locked balances
    const result = await query(`
      SELECT
        COALESCE(SUM(balance), 0) + COALESCE(SUM(locked_balance), 0) as total_balance
      FROM wallets
      WHERE currency = $1
    `, [currency]);

    return parseFloat(result.rows[0].total_balance || 0);
  }

  /**
   * Create a sweep request (manual approval required)
   */
  async createSweepRequest(currency, amount, coldAddress) {
    const result = await query(`
      INSERT INTO cold_wallet_operations
        (type, currency, amount, to_address, status, created_at)
      VALUES
        ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, ['sweep', currency, amount, coldAddress, 'pending']);

    logger.warn('⚠️  SWEEP REQUEST CREATED - MANUAL ACTION REQUIRED', {
      id: result.rows[0].id,
      currency,
      amount,
      coldAddress,
      message: 'Admin must manually execute this sweep operation'
    });

    return result.rows[0];
  }

  /**
   * Check if hot wallet needs rebalancing from cold storage
   */
  async checkRebalanceNeeded(currency) {
    const hotBalance = await this.getHotWalletBalance(currency);
    const minThreshold = this.hotWalletMinThresholds[currency];

    if (hotBalance < minThreshold) {
      const amountNeeded = (this.hotWalletMaxThresholds[currency] * 0.5) - hotBalance;

      logger.warn('Hot wallet below minimum - rebalance needed', {
        currency,
        hotBalance,
        minThreshold,
        amountNeeded
      });

      await this.createRebalanceRequest(currency, amountNeeded);

      return {
        needsRebalance: true,
        amount: amountNeeded
      };
    }

    return { needsRebalance: false };
  }

  /**
   * Create rebalance request from cold to hot wallet
   */
  async createRebalanceRequest(currency, amount) {
    const result = await query(`
      INSERT INTO cold_wallet_operations
        (type, currency, amount, status, created_at)
      VALUES
        ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `, ['rebalance', currency, amount, 'pending']);

    logger.warn('⚠️  REBALANCE REQUEST CREATED - MANUAL ACTION REQUIRED', {
      id: result.rows[0].id,
      currency,
      amount,
      message: 'Admin must manually transfer funds from cold wallet'
    });

    return result.rows[0];
  }

  /**
   * Get all pending cold wallet operations
   */
  async getPendingOperations() {
    const result = await query(`
      SELECT * FROM cold_wallet_operations
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);

    return result.rows;
  }

  /**
   * Mark operation as completed
   */
  async markOperationCompleted(operationId, txHash) {
    await query(`
      UPDATE cold_wallet_operations
      SET
        status = 'completed',
        tx_hash = $1,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [txHash, operationId]);

    logger.info('Cold wallet operation completed', {
      operationId,
      txHash
    });
  }

  /**
   * Get cold wallet statistics
   */
  async getStatistics() {
    const stats = {};

    for (const currency of Object.keys(this.coldWallets)) {
      const hotBalance = await this.getHotWalletBalance(currency);

      stats[currency] = {
        hotWalletBalance: hotBalance,
        coldWalletAddress: this.coldWallets[currency],
        maxThreshold: this.hotWalletMaxThresholds[currency],
        minThreshold: this.hotWalletMinThresholds[currency],
        needsSweep: hotBalance > this.hotWalletMaxThresholds[currency],
        needsRebalance: hotBalance < this.hotWalletMinThresholds[currency]
      };
    }

    return stats;
  }
}

module.exports = new ColdWalletService();
