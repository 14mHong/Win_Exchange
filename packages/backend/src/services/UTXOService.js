const { query } = require('../config/database');
const logger = require('../config/logger');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');

/**
 * UTXO Service - Manages Bitcoin/Litecoin Unspent Transaction Outputs
 *
 * Handles:
 * - UTXO tracking from deposits
 * - Coin selection for withdrawals
 * - Transaction building
 * - Change address management
 */
class UTXOService {
  constructor() {
    // Blockchain API configuration (BlockCypher)
    this.blockchainAPI = {
      BTC: process.env.BLOCKCYPHER_API_URL || 'https://api.blockcypher.com/v1/btc/main',
      BTC_TEST: 'https://api.blockcypher.com/v1/btc/test3',
      LTC: process.env.BLOCKCYPHER_API_URL_LTC || 'https://api.blockcypher.com/v1/ltc/main'
    };

    // API token (optional but recommended for higher rate limits)
    this.apiToken = process.env.BLOCKCYPHER_TOKEN;

    // Minimum confirmations required
    this.minConfirmations = {
      BTC: 3,
      LTC: 6
    };

    logger.info('UTXOService initialized');
  }

  /**
   * Add UTXO from incoming transaction
   * Called when a deposit is detected
   */
  async addUTXO({ txHash, vout, userId, address, derivationPath, currency, amount, blockHeight, confirmations, scriptPubKey }) {
    try {
      // Convert to satoshi/litoshi
      const amountSatoshi = Math.round(amount * 100000000); // 1 BTC = 100,000,000 satoshi

      const result = await query(`
        INSERT INTO utxos (
          tx_hash, vout, user_id, address, derivation_path,
          currency, amount, amount_satoshi,
          status, block_height, confirmations, script_pub_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (tx_hash, vout, currency) DO UPDATE
        SET
          confirmations = EXCLUDED.confirmations,
          status = CASE
            WHEN EXCLUDED.confirmations >= $13 THEN 'confirmed'
            ELSE 'unconfirmed'
          END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        txHash, vout, userId, address, derivationPath,
        currency, amount, amountSatoshi,
        confirmations >= this.minConfirmations[currency] ? 'confirmed' : 'unconfirmed',
        blockHeight, confirmations, scriptPubKey,
        this.minConfirmations[currency]
      ]);

      logger.info('UTXO added/updated', {
        txHash,
        vout,
        userId,
        currency,
        amount,
        confirmations
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error adding UTXO:', error);
      throw error;
    }
  }

  /**
   * Get available UTXOs for a user
   * Only returns confirmed and unlocked UTXOs
   */
  async getAvailableUTXOs(userId, currency) {
    const result = await query(`
      SELECT *
      FROM utxos
      WHERE
        user_id = $1
        AND currency = $2
        AND status = 'confirmed'
        AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
      ORDER BY amount_satoshi DESC
    `, [userId, currency]);

    return result.rows;
  }

  /**
   * Get total available balance in satoshi
   */
  async getAvailableBalance(userId, currency) {
    const result = await query(`
      SELECT COALESCE(SUM(amount_satoshi), 0) as total_satoshi
      FROM utxos
      WHERE
        user_id = $1
        AND currency = $2
        AND status = 'confirmed'
        AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
    `, [userId, currency]);

    return parseInt(result.rows[0].total_satoshi);
  }

  /**
   * Select UTXOs for a transaction (Coin Selection Algorithm)
   * Uses "Largest First" strategy for simplicity
   *
   * @param {string} userId - User ID
   * @param {string} currency - BTC or LTC
   * @param {number} amountSatoshi - Amount needed in satoshi
   * @param {number} feeRate - Fee rate in satoshi per byte
   * @returns {Object} Selected UTXOs and change amount
   */
  async selectUTXOs(userId, currency, amountSatoshi, feeRate) {
    const availableUTXOs = await this.getAvailableUTXOs(userId, currency);

    if (availableUTXOs.length === 0) {
      throw new Error('No UTXOs available');
    }

    // Sort by amount (largest first)
    availableUTXOs.sort((a, b) => parseInt(b.amount_satoshi) - parseInt(a.amount_satoshi));

    const selectedUTXOs = [];
    let totalSelected = 0;
    let estimatedFee = 0;

    // Estimate transaction size and fee
    // Native SegWit (P2WPKH) formula in virtual bytes:
    // - Input: ~68 vbytes (vs 148 for P2PKH)
    // - Output: ~31 vbytes (vs 34 for P2PKH)
    // - Overhead: ~10.5 vbytes
    for (const utxo of availableUTXOs) {
      selectedUTXOs.push(utxo);
      totalSelected += parseInt(utxo.amount_satoshi);

      // Recalculate fee with current number of inputs
      // Using SegWit (P2WPKH) sizing
      const txSize = Math.ceil((selectedUTXOs.length * 68) + (2 * 31) + 10.5); // 2 outputs (recipient + change)
      estimatedFee = Math.ceil(txSize * feeRate);

      // Check if we have enough (amount + fee)
      if (totalSelected >= amountSatoshi + estimatedFee) {
        break;
      }
    }

    // Final check
    const totalNeeded = amountSatoshi + estimatedFee;
    if (totalSelected < totalNeeded) {
      throw new Error(`Insufficient funds. Need ${totalNeeded} satoshi, have ${totalSelected} satoshi`);
    }

    const changeAmount = totalSelected - totalNeeded;

    // Dust threshold (546 satoshi for Bitcoin)
    const dustThreshold = 546;
    if (changeAmount > 0 && changeAmount < dustThreshold) {
      // Add dust to fee instead of creating change output
      estimatedFee += changeAmount;
      return {
        selectedUTXOs,
        totalInput: totalSelected,
        totalOutput: amountSatoshi,
        fee: estimatedFee,
        changeAmount: 0
      };
    }

    return {
      selectedUTXOs,
      totalInput: totalSelected,
      totalOutput: amountSatoshi,
      fee: estimatedFee,
      changeAmount
    };
  }

  /**
   * Lock UTXOs for a pending transaction
   * Prevents double-spending during transaction creation
   */
  async lockUTXOs(utxoIds, transactionId, lockMinutes = 30) {
    await query(`
      UPDATE utxos
      SET
        status = 'locked',
        locked_until = CURRENT_TIMESTAMP + INTERVAL '${lockMinutes} minutes',
        locked_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2)
    `, [transactionId, utxoIds]);

    logger.info('UTXOs locked', { utxoIds, transactionId, lockMinutes });
  }

  /**
   * Unlock UTXOs (if transaction fails)
   */
  async unlockUTXOs(utxoIds) {
    await query(`
      UPDATE utxos
      SET
        status = 'confirmed',
        locked_until = NULL,
        locked_by = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1)
    `, [utxoIds]);

    logger.info('UTXOs unlocked', { utxoIds });
  }

  /**
   * Mark UTXOs as spent
   */
  async markUTXOsSpent(utxoIds, spentInTxHash) {
    await query(`
      UPDATE utxos
      SET
        status = 'spent',
        spent_in_tx_hash = $1,
        spent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2)
    `, [spentInTxHash, utxoIds]);

    logger.info('UTXOs marked as spent', { utxoIds, spentInTxHash });
  }

  /**
   * Build Bitcoin transaction
   *
   * @param {Array} utxos - Selected UTXOs
   * @param {string} toAddress - Recipient address
   * @param {number} amountSatoshi - Amount to send
   * @param {number} changeAmount - Change amount (if any)
   * @param {string} changeAddress - Change address
   * @param {string} currency - BTC or LTC
   * @returns {Object} Transaction hex and details
   */
  buildTransaction(utxos, toAddress, amountSatoshi, changeAmount, changeAddress, currency) {
    try {
      // Get network
      const network = currency === 'LTC'
        ? {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: { public: 0x019da462, private: 0x019d9cfe },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0
          }
        : bitcoin.networks.bitcoin;

      // Create transaction builder
      const txb = new bitcoin.TransactionBuilder(network);

      // Add inputs (UTXOs)
      for (const utxo of utxos) {
        txb.addInput(utxo.tx_hash, utxo.vout);
      }

      // Add outputs
      txb.addOutput(toAddress, amountSatoshi); // Recipient

      if (changeAmount > 0) {
        txb.addOutput(changeAddress, changeAmount); // Change
      }

      logger.info('Bitcoin transaction built (unsigned)', {
        inputs: utxos.length,
        outputs: changeAmount > 0 ? 2 : 1,
        amount: amountSatoshi,
        change: changeAmount
      });

      return {
        unsignedTx: txb,
        inputs: utxos.length,
        outputs: changeAmount > 0 ? 2 : 1
      };
    } catch (error) {
      logger.error('Error building transaction:', error);
      throw error;
    }
  }

  /**
   * Broadcast transaction to blockchain
   */
  async broadcastTransaction(txHex, currency) {
    try {
      const apiUrl = this.blockchainAPI[currency];
      const url = this.apiToken
        ? `${apiUrl}/txs/push?token=${this.apiToken}`
        : `${apiUrl}/txs/push`;

      const response = await axios.post(url, {
        tx: txHex
      });

      logger.info('Transaction broadcasted', {
        txHash: response.data.tx.hash,
        currency
      });

      return {
        success: true,
        txHash: response.data.tx.hash,
        data: response.data
      };
    } catch (error) {
      logger.error('Error broadcasting transaction:', error.response?.data || error.message);
      throw new Error(`Failed to broadcast transaction: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Monitor address for incoming transactions
   * Called periodically to detect new deposits
   */
  async monitorAddress(address, currency, userId, derivationPath) {
    try {
      const apiUrl = this.blockchainAPI[currency];
      const url = this.apiToken
        ? `${apiUrl}/addrs/${address}?token=${this.apiToken}&unspentOnly=true`
        : `${apiUrl}/addrs/${address}?unspentOnly=true`;

      const response = await axios.get(url);
      const addressData = response.data;

      // Get UTXOs for this address
      if (addressData.txrefs && addressData.txrefs.length > 0) {
        for (const txref of addressData.txrefs) {
          // Check if UTXO already exists
          const existing = await query(
            'SELECT id FROM utxos WHERE tx_hash = $1 AND vout = $2 AND currency = $3',
            [txref.tx_hash, txref.tx_output_n, currency]
          );

          if (existing.rows.length === 0) {
            // Add new UTXO
            await this.addUTXO({
              txHash: txref.tx_hash,
              vout: txref.tx_output_n,
              userId,
              address,
              derivationPath,
              currency,
              amount: txref.value / 100000000, // Convert satoshi to BTC
              blockHeight: txref.block_height,
              confirmations: txref.confirmations,
              scriptPubKey: txref.script
            });
          } else {
            // Update confirmations
            await query(`
              UPDATE utxos
              SET
                confirmations = $1,
                status = CASE
                  WHEN $1 >= $2 THEN 'confirmed'
                  ELSE 'unconfirmed'
                END,
                updated_at = CURRENT_TIMESTAMP
              WHERE tx_hash = $3 AND vout = $4 AND currency = $5
            `, [
              txref.confirmations,
              this.minConfirmations[currency],
              txref.tx_hash,
              txref.tx_output_n,
              currency
            ]);
          }
        }
      }

      return {
        success: true,
        address,
        balance: addressData.balance,
        unconfirmedBalance: addressData.unconfirmed_balance,
        utxoCount: addressData.n_tx
      };
    } catch (error) {
      logger.error('Error monitoring address:', error);
      throw error;
    }
  }

  /**
   * Get recommended fee rate (satoshi per byte)
   */
  async getRecommendedFeeRate(currency) {
    try {
      const apiUrl = this.blockchainAPI[currency];
      const url = this.apiToken
        ? `${apiUrl}?token=${this.apiToken}`
        : apiUrl;

      const response = await axios.get(url);

      // BlockCypher provides fee estimates
      return {
        high: response.data.high_fee_per_kb / 1024, // Convert to per byte
        medium: response.data.medium_fee_per_kb / 1024,
        low: response.data.low_fee_per_kb / 1024
      };
    } catch (error) {
      logger.error('Error getting fee rate:', error);
      // Return default values if API fails
      return {
        high: 50,
        medium: 30,
        low: 10
      };
    }
  }

  /**
   * Cleanup expired locks
   * Run periodically to unlock UTXOs from failed transactions
   */
  async cleanupExpiredLocks() {
    const result = await query(`
      UPDATE utxos
      SET
        status = 'confirmed',
        locked_until = NULL,
        locked_by = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        status = 'locked'
        AND locked_until < CURRENT_TIMESTAMP
      RETURNING id, tx_hash, vout
    `);

    if (result.rows.length > 0) {
      logger.info('Cleaned up expired UTXO locks', {
        count: result.rows.length
      });
    }

    return result.rows.length;
  }
}

module.exports = new UTXOService();
