const UTXOService = require('./UTXOService');
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * UTXO Monitor
 * Periodically monitors deposit addresses for new transactions
 * and updates UTXO confirmations
 */
class UTXOMonitor {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = null;
    // Monitor every 2 minutes
    this.intervalMs = parseInt(process.env.UTXO_MONITOR_INTERVAL_MS) || 120000;
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.isRunning) {
      logger.warn('UTXO Monitor is already running');
      return;
    }

    logger.info('Starting UTXO Monitor', {
      intervalMs: this.intervalMs
    });

    this.isRunning = true;

    // Run immediately on start
    this.monitorAllAddresses();

    // Then run periodically
    this.monitorInterval = setInterval(() => {
      this.monitorAllAddresses();
    }, this.intervalMs);
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping UTXO Monitor');

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Monitor all Bitcoin/Litecoin deposit addresses
   */
  async monitorAllAddresses() {
    try {
      logger.info('Starting UTXO monitoring cycle');

      // Get all Bitcoin/Litecoin deposit addresses
      const result = await query(`
        SELECT DISTINCT
          da.address,
          da.currency,
          da.user_id,
          da.derivation_path
        FROM deposit_addresses da
        WHERE da.currency IN ('BTC', 'LTC')
      `);

      const addresses = result.rows;

      if (addresses.length === 0) {
        logger.info('No Bitcoin/Litecoin addresses to monitor');
        return;
      }

      logger.info(`Monitoring ${addresses.length} addresses`);

      // Monitor each address
      for (const addr of addresses) {
        try {
          await UTXOService.monitorAddress(
            addr.address,
            addr.currency,
            addr.user_id,
            addr.derivation_path
          );

          // Small delay between API calls to avoid rate limiting
          await this.sleep(1000);

        } catch (error) {
          logger.error('Error monitoring address', {
            address: addr.address,
            currency: addr.currency,
            error: error.message
          });
        }
      }

      // Cleanup expired UTXO locks
      await UTXOService.cleanupExpiredLocks();

      // Update unconfirmed UTXO confirmations
      await this.updateUnconfirmedUTXOs();

      logger.info('UTXO monitoring cycle completed');

    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
    }
  }

  /**
   * Update confirmation counts for unconfirmed UTXOs
   */
  async updateUnconfirmedUTXOs() {
    try {
      const result = await query(`
        SELECT id, tx_hash, currency, confirmations
        FROM utxos
        WHERE status = 'unconfirmed'
      `);

      for (const utxo of result.rows) {
        // This would query blockchain for current confirmations
        // For now, we rely on the monitoring to update them
        // Could implement direct blockchain queries here
      }

    } catch (error) {
      logger.error('Error updating unconfirmed UTXOs:', error);
    }
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get monitoring statistics
   */
  async getStatistics() {
    try {
      const stats = await query(`
        SELECT
          currency,
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM utxos
        GROUP BY currency, status
      `);

      return stats.rows;
    } catch (error) {
      logger.error('Error getting UTXO statistics:', error);
      return [];
    }
  }
}

// Create singleton instance
const monitor = new UTXOMonitor();

module.exports = monitor;
