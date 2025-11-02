const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * DepositAddress Model
 *
 * Manages user deposit addresses for different cryptocurrencies.
 * Each user has unique addresses derived from the master seed.
 */
class DepositAddress {
  /**
   * Create deposit address record
   *
   * @param {Object} addressData
   * @returns {Object} Created address
   */
  static async create(addressData) {
    const {
      user_id,
      currency,
      address,
      derivation_path,
      network,
      last_checked_block = 0
    } = addressData;

    const query = `
      INSERT INTO deposit_addresses (
        user_id, currency, address, derivation_path,
        network, last_checked_block
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, currency)
      DO UPDATE SET
        address = EXCLUDED.address,
        derivation_path = EXCLUDED.derivation_path,
        network = EXCLUDED.network,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        user_id,
        currency,
        address,
        derivation_path,
        network,
        last_checked_block
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating deposit address:', error);
      throw error;
    }
  }

  /**
   * Find deposit address by user and currency
   *
   * @param {number} userId
   * @param {string} currency
   * @returns {Object|null} Deposit address
   */
  static async findByUserAndCurrency(userId, currency) {
    const query = `
      SELECT * FROM deposit_addresses
      WHERE user_id = $1 AND currency = $2
    `;

    try {
      const result = await pool.query(query, [userId, currency]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding deposit address:', error);
      throw error;
    }
  }

  /**
   * Find all deposit addresses for a user
   *
   * @param {number} userId
   * @returns {Array} Deposit addresses
   */
  static async findByUserId(userId) {
    const query = `
      SELECT * FROM deposit_addresses
      WHERE user_id = $1
      ORDER BY currency
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding user deposit addresses:', error);
      throw error;
    }
  }

  /**
   * Get all addresses for a specific currency
   * Used for blockchain monitoring
   *
   * For Ethereum-based currencies (ETH, USDT, USDC, BNB), addresses work on both
   * mainnet and testnet, so we don't filter by network - we monitor whatever
   * RPC endpoint is configured.
   *
   * @param {string} currency
   * @param {string} network - Optional, only used for Bitcoin-like currencies
   * @returns {Array} Deposit addresses
   */
  static async findByCurrency(currency, network = null) {
    // Ethereum addresses work on both mainnet and testnet
    const ETH_BASED = ['ETH', 'USDT', 'USDC', 'BNB'];

    let query, params;

    if (ETH_BASED.includes(currency)) {
      // For ETH-based, ignore network and return all addresses for this currency
      query = `
        SELECT da.*, u.email
        FROM deposit_addresses da
        JOIN users u ON da.user_id = u.id
        WHERE da.currency = $1
        ORDER BY da.user_id
      `;
      params = [currency];
    } else {
      // For other currencies (BTC, LTC), filter by network
      query = `
        SELECT da.*, u.email
        FROM deposit_addresses da
        JOIN users u ON da.user_id = u.id
        WHERE da.currency = $1 AND da.network = $2
        ORDER BY da.user_id
      `;
      params = [currency, network];
    }

    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error finding addresses by currency:', error);
      throw error;
    }
  }

  /**
   * Update last checked block
   * Used by blockchain monitor to track progress
   *
   * @param {number} userId
   * @param {string} currency
   * @param {number} blockNumber
   */
  static async updateLastCheckedBlock(userId, currency, blockNumber) {
    const query = `
      UPDATE deposit_addresses
      SET last_checked_block = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND currency = $3
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [blockNumber, userId, currency]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating last checked block:', error);
      throw error;
    }
  }

  /**
   * Update last balance
   *
   * @param {number} userId
   * @param {string} currency
   * @param {string} balance
   */
  static async updateLastBalance(userId, currency, balance) {
    const query = `
      UPDATE deposit_addresses
      SET last_checked_balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND currency = $3
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [balance, userId, currency]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating last balance:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  static async getStats() {
    const query = `
      SELECT
        currency,
        network,
        COUNT(*) as address_count,
        COUNT(DISTINCT user_id) as user_count
      FROM deposit_addresses
      GROUP BY currency, network
      ORDER BY currency
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting deposit address stats:', error);
      throw error;
    }
  }
}

module.exports = DepositAddress;
