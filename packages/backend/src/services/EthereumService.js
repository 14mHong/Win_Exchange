const { ethers } = require('ethers');
const logger = require('../config/logger');
const redis = require('../config/redis');

class EthereumService {
  constructor() {
    // Use public Ethereum RPC endpoints (or configure your own)
    this.provider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'
    );

    // Payment configuration
    this.PAYMENT_ADDRESS = process.env.ETH_PAYMENT_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    this.INVITE_CODE_PRICE_ETH = process.env.INVITE_CODE_PRICE_ETH || '0.001'; // 0.001 ETH
    this.MIN_CONFIRMATIONS = parseInt(process.env.ETH_MIN_CONFIRMATIONS || '3');
  }

  /**
   * Verify an Ethereum transaction for invite code purchase
   * @param {string} txHash - Transaction hash
   * @param {string} userEmail - User's email for tracking
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async verifyPaymentTransaction(txHash, userEmail) {
    try {
      // Check if transaction has already been used
      const usedTx = await redis.get(`eth_tx_used:${txHash}`);
      if (usedTx) {
        return {
          success: false,
          error: 'This transaction has already been used to purchase an invite code'
        };
      }

      // Get transaction details
      logger.info('Fetching transaction details', { txHash });
      const tx = await this.provider.getTransaction(txHash);

      if (!tx) {
        return {
          success: false,
          error: 'Transaction not found. Please ensure the transaction hash is correct and the transaction has been submitted to the blockchain.'
        };
      }

      // Get transaction receipt to check confirmations
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          success: false,
          error: 'Transaction is pending. Please wait for the transaction to be confirmed on the blockchain.'
        };
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed on the blockchain'
        };
      }

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      logger.info('Transaction confirmations', {
        txHash,
        confirmations,
        required: this.MIN_CONFIRMATIONS
      });

      if (confirmations < this.MIN_CONFIRMATIONS) {
        return {
          success: false,
          error: `Transaction needs ${this.MIN_CONFIRMATIONS} confirmations. Currently has ${confirmations}. Please wait a few minutes and try again.`,
          confirmations,
          required: this.MIN_CONFIRMATIONS
        };
      }

      // Verify recipient address
      const recipientAddress = tx.to.toLowerCase();
      const expectedAddress = this.PAYMENT_ADDRESS.toLowerCase();

      if (recipientAddress !== expectedAddress) {
        return {
          success: false,
          error: `Payment sent to wrong address. Expected: ${this.PAYMENT_ADDRESS}, Got: ${tx.to}`
        };
      }

      // Verify payment amount
      const paidAmount = ethers.formatEther(tx.value);
      const expectedAmount = parseFloat(this.INVITE_CODE_PRICE_ETH);
      const tolerance = 0.0001; // Allow small rounding differences

      logger.info('Payment amount verification', {
        paid: paidAmount,
        expected: expectedAmount,
        difference: Math.abs(parseFloat(paidAmount) - expectedAmount)
      });

      if (Math.abs(parseFloat(paidAmount) - expectedAmount) > tolerance) {
        return {
          success: false,
          error: `Incorrect payment amount. Expected: ${expectedAmount} ETH, Got: ${paidAmount} ETH`
        };
      }

      // Check transaction age (prevent very old transactions)
      const block = await this.provider.getBlock(receipt.blockNumber);
      const txTimestamp = block.timestamp;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const maxAge = 7 * 24 * 60 * 60; // 7 days

      if (currentTimestamp - txTimestamp > maxAge) {
        return {
          success: false,
          error: 'Transaction is too old. Please make a new payment.'
        };
      }

      // Mark transaction as used (store for 90 days)
      await redis.setex(`eth_tx_used:${txHash}`, 90 * 24 * 60 * 60, JSON.stringify({
        email: userEmail,
        timestamp: Date.now(),
        amount: paidAmount
      }));

      logger.info('Payment verified successfully', {
        txHash,
        email: userEmail,
        amount: paidAmount,
        confirmations
      });

      return {
        success: true,
        txHash,
        amount: paidAmount,
        confirmations,
        timestamp: txTimestamp
      };

    } catch (error) {
      logger.error('Error verifying Ethereum transaction', {
        txHash,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: `Failed to verify transaction: ${error.message}`
      };
    }
  }

  /**
   * Get current ETH price in USD (optional, for display)
   */
  async getEthPriceUSD() {
    try {
      // You can integrate with a price API like CoinGecko or use Chainlink oracles
      // For now, returning a placeholder
      return 2500; // USD per ETH
    } catch (error) {
      logger.error('Error fetching ETH price', error);
      return 2500; // Default fallback
    }
  }

  /**
   * Get payment configuration
   */
  getPaymentConfig() {
    return {
      address: this.PAYMENT_ADDRESS,
      priceETH: this.INVITE_CODE_PRICE_ETH,
      minConfirmations: this.MIN_CONFIRMATIONS,
      network: process.env.ETHEREUM_NETWORK || 'mainnet'
    };
  }

  /**
   * Validate Ethereum address format
   */
  isValidAddress(address) {
    return ethers.isAddress(address);
  }

  /**
   * Validate transaction hash format
   */
  isValidTxHash(txHash) {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }
}

module.exports = new EthereumService();
