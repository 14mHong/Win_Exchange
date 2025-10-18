const UTXOService = require('./UTXOService');
const CryptoWalletService = require('./CryptoWalletService');
const logger = require('../config/logger');
const { query } = require('../config/database');
const bitcoin = require('bitcoinjs-lib');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bip39 = require('bip39');

const bip32 = BIP32Factory(ecc);

/**
 * Bitcoin Withdrawal Service
 * Handles Bitcoin/Litecoin withdrawals with proper UTXO management
 */
class BitcoinWithdrawalService {
  /**
   * Process a Bitcoin withdrawal
   *
   * @param {string} userId - User ID
   * @param {string} currency - BTC or LTC
   * @param {string} toAddress - Destination address
   * @param {number} amount - Amount in BTC/LTC
   * @param {string} feeLevel - 'low', 'medium', or 'high'
   */
  async processWithdrawal(userId, currency, toAddress, amount, feeLevel = 'medium') {
    const transactionId = require('uuid').v4();

    try {
      // Step 1: Validate inputs
      if (!['BTC', 'LTC'].includes(currency)) {
        throw new Error(`Currency ${currency} not supported for Bitcoin withdrawals`);
      }

      if (!CryptoWalletService.validateAddress(toAddress, currency)) {
        throw new Error('Invalid destination address');
      }

      // Convert amount to satoshi
      const amountSatoshi = Math.round(amount * 100000000);

      // Step 2: Get recommended fee rate
      const feeRates = await UTXOService.getRecommendedFeeRate(currency);
      const feeRate = feeRates[feeLevel] || feeRates.medium;

      logger.info('Processing Bitcoin withdrawal', {
        userId,
        currency,
        amount,
        amountSatoshi,
        feeRate,
        toAddress
      });

      // Step 3: Select UTXOs
      const { selectedUTXOs, totalInput, totalOutput, fee, changeAmount } =
        await UTXOService.selectUTXOs(userId, currency, amountSatoshi, feeRate);

      logger.info('UTXOs selected', {
        count: selectedUTXOs.length,
        totalInput,
        totalOutput,
        fee,
        changeAmount
      });

      // Step 4: Lock selected UTXOs
      const utxoIds = selectedUTXOs.map(u => u.id);
      await UTXOService.lockUTXOs(utxoIds, transactionId);

      // Step 5: Generate change address (if needed)
      let changeAddress = null;
      if (changeAmount > 0) {
        // Use user's next available address or generate new one
        changeAddress = await this.getChangeAddress(userId, currency);
      }

      // Step 6: Build transaction
      const { unsignedTx } = UTXOService.buildTransaction(
        selectedUTXOs,
        toAddress,
        amountSatoshi,
        changeAmount,
        changeAddress,
        currency
      );

      // Step 7: Sign transaction
      const signedTxHex = await this.signTransaction(
        unsignedTx,
        selectedUTXOs,
        currency
      );

      // Step 8: Broadcast transaction
      const broadcastResult = await UTXOService.broadcastTransaction(signedTxHex, currency);

      if (!broadcastResult.success) {
        throw new Error('Failed to broadcast transaction');
      }

      const txHash = broadcastResult.txHash;

      // Step 9: Mark UTXOs as spent
      await UTXOService.markUTXOsSpent(utxoIds, txHash);

      // Step 10: Create change UTXO (if applicable)
      if (changeAmount > 0 && changeAddress) {
        // Change UTXO will be detected by monitoring service
        logger.info('Change output created', {
          changeAddress,
          changeAmount,
          txHash
        });
      }

      // Step 11: Record transaction
      await this.recordWithdrawal({
        userId,
        currency,
        txHash,
        toAddress,
        amount: amountSatoshi,
        fee,
        utxoIds
      });

      logger.info('Bitcoin withdrawal successful', {
        userId,
        currency,
        txHash,
        amount: amountSatoshi,
        fee
      });

      return {
        success: true,
        txHash,
        amount: amount,
        fee: fee / 100000000, // Convert back to BTC
        confirmations: 0
      };

    } catch (error) {
      logger.error('Bitcoin withdrawal failed', {
        userId,
        currency,
        error: error.message
      });

      // Unlock UTXOs if transaction failed
      try {
        const utxos = await query(
          'SELECT id FROM utxos WHERE locked_by = $1',
          [transactionId]
        );
        if (utxos.rows.length > 0) {
          await UTXOService.unlockUTXOs(utxos.rows.map(u => u.id));
        }
      } catch (unlockError) {
        logger.error('Failed to unlock UTXOs after error', unlockError);
      }

      throw error;
    }
  }

  /**
   * Sign transaction with private keys
   */
  async signTransaction(txBuilder, utxos, currency) {
    try {
      // Get master seed
      const masterSeed = process.env.MASTER_SEED_MNEMONIC;
      if (!masterSeed) {
        throw new Error('Master seed not configured');
      }

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

      // Derive keys and sign each input
      const seed = bip39.mnemonicToSeedSync(masterSeed);
      const root = bip32.fromSeed(seed, network);

      for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i];

        // Derive the key for this UTXO
        const child = root.derivePath(utxo.derivation_path);

        // Sign the input
        txBuilder.sign({
          prevOutScriptType: 'p2pkh',
          vin: i,
          keyPair: bitcoin.ECPair.fromPrivateKey(child.privateKey, { network })
        });
      }

      // Build and get hex
      const tx = txBuilder.build();
      const txHex = tx.toHex();

      logger.info('Transaction signed', {
        inputs: utxos.length,
        size: txHex.length / 2
      });

      return txHex;

    } catch (error) {
      logger.error('Error signing transaction:', error);
      throw error;
    }
  }

  /**
   * Get or generate change address for user
   */
  async getChangeAddress(userId, currency) {
    // Check if user has existing deposit address
    const existingAddress = await query(
      'SELECT address FROM deposit_addresses WHERE user_id = $1 AND currency = $2 LIMIT 1',
      [userId, currency]
    );

    if (existingAddress.rows.length > 0) {
      return existingAddress.rows[0].address;
    }

    // Generate new address
    const wallet = CryptoWalletService.deriveUserWallet(userId, currency);
    return wallet.address;
  }

  /**
   * Record withdrawal in database
   */
  async recordWithdrawal({ userId, currency, txHash, toAddress, amount, fee, utxoIds }) {
    await query(`
      INSERT INTO bitcoin_transactions (
        tx_hash, currency, type, user_id,
        total_input, total_output, fee,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      txHash,
      currency,
      'withdrawal',
      userId,
      amount + fee,
      amount,
      fee,
      'pending'
    ]);

    logger.info('Withdrawal recorded', {
      txHash,
      userId,
      currency,
      amount,
      fee
    });
  }

  /**
   * Estimate withdrawal fee
   */
  async estimateWithdrawalFee(userId, currency, amount, feeLevel = 'medium') {
    try {
      const amountSatoshi = Math.round(amount * 100000000);

      // Get fee rates
      const feeRates = await UTXOService.getRecommendedFeeRate(currency);
      const feeRate = feeRates[feeLevel] || feeRates.medium;

      // Select UTXOs (without locking)
      const { fee } = await UTXOService.selectUTXOs(userId, currency, amountSatoshi, feeRate);

      return {
        fee: fee / 100000000, // Convert to BTC
        feeRate,
        feeLevel
      };
    } catch (error) {
      logger.error('Error estimating fee:', error);
      throw error;
    }
  }
}

module.exports = new BitcoinWithdrawalService();
