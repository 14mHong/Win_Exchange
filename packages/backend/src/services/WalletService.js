const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../config/logger');
const crypto = require('crypto');

class WalletService {
  // Initialize user wallets with default currencies
  static async initializeUserWallets(userId) {
    try {
      const defaultCurrencies = ['BTC', 'ETH', 'USDT', 'LTC', 'ADA'];
      const wallets = [];

      for (const currency of defaultCurrencies) {
        try {
          const wallet = await Wallet.create({
            user_id: userId,
            currency,
            balance: 0
          });
          wallets.push(wallet);
        } catch (error) {
          // Wallet might already exist, fetch it
          const existingWallet = await Wallet.findByUserAndCurrency(userId, currency);
          if (existingWallet) {
            wallets.push(existingWallet);
          }
        }
      }

      logger.logUserAction(userId, 'WALLETS_INITIALIZED', { 
        currencies: defaultCurrencies 
      });

      return wallets;
    } catch (error) {
      logger.error('Wallet initialization error:', error);
      throw new Error('Failed to initialize wallets');
    }
  }

  // Get all wallets for a user
  static async getUserWallets(userId) {
    try {
      const wallets = await Wallet.findByUserId(userId);
      
      // If no wallets exist, initialize them
      if (wallets.length === 0) {
        return await this.initializeUserWallets(userId);
      }

      return wallets;
    } catch (error) {
      logger.error('Get user wallets error:', error);
      throw new Error('Failed to fetch user wallets');
    }
  }

  // Get specific wallet by currency
  static async getUserWallet(userId, currency) {
    try {
      let wallet = await Wallet.findByUserAndCurrency(userId, currency);
      
      // Create wallet if it doesn't exist
      if (!wallet) {
        wallet = await Wallet.create({
          user_id: userId,
          currency,
          balance: 0
        });
      }

      return wallet;
    } catch (error) {
      logger.error('Get user wallet error:', error);
      throw new Error('Failed to fetch user wallet');
    }
  }

  // Process deposit (simulated for MVP)
  static async processDeposit(userId, currency, amount, txHash = null) {
    try {
      if (amount <= 0) {
        throw new Error('Deposit amount must be positive');
      }

      // Get or create wallet
      const wallet = await this.getUserWallet(userId, currency);

      // Generate transaction hash if not provided (for simulation)
      const transactionHash = txHash || this.generateTransactionHash();

      // Create pending transaction
      const transaction = await Transaction.create({
        user_id: userId,
        wallet_id: wallet.id,
        type: 'deposit',
        currency,
        amount,
        status: 'processing',
        tx_hash: transactionHash,
        external_id: `deposit_${Date.now()}_${userId}`,
        notes: 'Simulated deposit for MVP'
      });

      // Simulate processing delay (in production, this would be handled by blockchain monitoring)
      setTimeout(async () => {
        try {
          await this.confirmDeposit(transaction.id);
        } catch (error) {
          logger.error('Deposit confirmation error:', error);
        }
      }, 5000); // 5 second delay for simulation

      logger.logUserAction(userId, 'DEPOSIT_INITIATED', {
        currency,
        amount,
        transactionId: transaction.id,
        txHash: transactionHash
      });

      return {
        success: true,
        transaction: transaction.toPublic(),
        message: 'Deposit initiated. Processing...'
      };
    } catch (error) {
      logger.error('Deposit processing error:', error);
      throw error;
    }
  }

  // Confirm deposit and update wallet balance
  static async confirmDeposit(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'processing') {
        throw new Error('Transaction is not in processing status');
      }

      // Get wallet
      const wallet = await Wallet.findById(transaction.wallet_id);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Update wallet balance
      await wallet.updateBalance(transaction.amount);

      // Update transaction status
      await transaction.updateStatus('completed', {
        confirmations: transaction.getRequiredConfirmations(),
        block_height: Math.floor(Math.random() * 1000000) + 500000 // Simulated block height
      });

      logger.logUserAction(transaction.user_id, 'DEPOSIT_CONFIRMED', {
        transactionId: transaction.id,
        currency: transaction.currency,
        amount: transaction.amount
      });

      return {
        success: true,
        transaction: transaction.toPublic(),
        wallet: wallet.toPublic()
      };
    } catch (error) {
      logger.error('Deposit confirmation error:', error);
      throw error;
    }
  }

  // Process withdrawal
  static async processWithdrawal(userId, currency, amount, address, twoFAToken = null) {
    try {
      if (amount <= 0) {
        throw new Error('Withdrawal amount must be positive');
      }

      if (!address) {
        throw new Error('Withdrawal address is required');
      }

      // Verify user and require 2FA for withdrawals
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Require 2FA to be enabled for withdrawals
      if (!user.two_fa_enabled) {
        throw new Error('Two-factor authentication must be enabled before making withdrawals. Please set up 2FA in your security settings.');
      }

      // Verify 2FA token
      if (!twoFAToken) {
        throw new Error('Two-factor authentication code required for withdrawals');
      }

      if (!user.verify2FAToken(twoFAToken)) {
        throw new Error('Invalid two-factor authentication code');
      }

      // Get wallet
      const wallet = await this.getUserWallet(userId, currency);

      // Calculate withdrawal fee
      const fee = this.calculateWithdrawalFee(currency, amount);
      const totalAmount = amount + fee;

      // Check balance
      if (!wallet.canWithdraw(totalAmount)) {
        throw new Error('Insufficient balance for withdrawal including fees');
      }

      // Lock the withdrawal amount
      await wallet.lockBalance(totalAmount);

      // Create withdrawal transaction
      const transaction = await Transaction.create({
        user_id: userId,
        wallet_id: wallet.id,
        type: 'withdrawal',
        currency,
        amount: -amount, // Negative for withdrawal
        fee,
        status: 'pending',
        external_id: `withdrawal_${Date.now()}_${userId}`,
        notes: `Withdrawal to ${address}`
      });

      // Simulate blockchain transaction (in production, this would interact with actual blockchain)
      setTimeout(async () => {
        try {
          await this.processWithdrawalTransaction(transaction.id, address);
        } catch (error) {
          logger.error('Withdrawal processing error:', error);
        }
      }, 10000); // 10 second delay for simulation

      logger.logUserAction(userId, 'WITHDRAWAL_INITIATED', {
        currency,
        amount,
        fee,
        address,
        transactionId: transaction.id
      });

      return {
        success: true,
        transaction: transaction.toPublic(),
        fee,
        total_amount: totalAmount,
        message: 'Withdrawal initiated. Processing...'
      };
    } catch (error) {
      logger.error('Withdrawal processing error:', error);
      throw error;
    }
  }

  // Process withdrawal transaction
  static async processWithdrawalTransaction(transactionId, address) {
    try {
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const wallet = await Wallet.findById(transaction.wallet_id);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Simulate blockchain transaction
      const txHash = this.generateTransactionHash();
      const totalAmount = Math.abs(transaction.amount) + transaction.fee;

      // Release locked balance and complete withdrawal
      await wallet.releaseLockedBalance(totalAmount);

      // Update transaction with blockchain details
      await transaction.updateStatus('completed', {
        tx_hash: txHash,
        block_height: Math.floor(Math.random() * 1000000) + 500000,
        confirmations: 1
      });

      logger.logUserAction(transaction.user_id, 'WITHDRAWAL_COMPLETED', {
        transactionId: transaction.id,
        txHash,
        currency: transaction.currency,
        amount: Math.abs(transaction.amount)
      });

      return {
        success: true,
        transaction: transaction.toPublic(),
        tx_hash: txHash
      };
    } catch (error) {
      logger.error('Withdrawal transaction processing error:', error);
      
      // If processing fails, unlock the balance
      try {
        const transaction = await Transaction.findById(transactionId);
        if (transaction) {
          const wallet = await Wallet.findById(transaction.wallet_id);
          if (wallet) {
            const totalAmount = Math.abs(transaction.amount) + transaction.fee;
            await wallet.unlockBalance(totalAmount);
          }
          await transaction.updateStatus('failed', { notes: error.message });
        }
      } catch (rollbackError) {
        logger.error('Withdrawal rollback error:', rollbackError);
      }
      
      throw error;
    }
  }

  // Calculate withdrawal fees
  static calculateWithdrawalFee(currency, amount) {
    const feeStructure = {
      'BTC': { fixed: 0.0005, percentage: 0 },
      'ETH': { fixed: 0.005, percentage: 0 },
      'USDT': { fixed: 1, percentage: 0 },
      'LTC': { fixed: 0.001, percentage: 0 },
      'ADA': { fixed: 1, percentage: 0 }
    };

    const fees = feeStructure[currency] || { fixed: 0, percentage: 0.001 };
    const fixedFee = fees.fixed || 0;
    const percentageFee = (amount * (fees.percentage || 0));
    
    return fixedFee + percentageFee;
  }

  // Get transaction history
  static async getTransactionHistory(userId, options = {}) {
    try {
      const transactions = await Transaction.findByUserId(userId, options);
      return {
        success: true,
        transactions: transactions.map(tx => tx.toPublic()),
        total: transactions.length
      };
    } catch (error) {
      logger.error('Transaction history error:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  // Get transaction by ID
  static async getTransaction(userId, transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.user_id !== userId) {
        throw new Error('Access denied');
      }

      return {
        success: true,
        transaction: transaction.toPublic()
      };
    } catch (error) {
      logger.error('Get transaction error:', error);
      throw error;
    }
  }

  // Generate deposit address (simulated for MVP)
  static generateDepositAddress(currency, userId) {
    const hash = crypto.createHash('sha256')
      .update(`${currency}_${userId}_${Date.now()}`)
      .digest('hex');
    
    // Generate realistic-looking addresses for different currencies
    switch (currency) {
      case 'BTC':
        return '1' + hash.substring(0, 33);
      case 'ETH':
      case 'USDT':
        return '0x' + hash.substring(0, 40);
      case 'LTC':
        return 'L' + hash.substring(0, 33);
      case 'ADA':
        return 'addr1' + hash.substring(0, 50);
      default:
        return hash.substring(0, 34);
    }
  }

  // Generate transaction hash (simulated)
  static generateTransactionHash() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Transfer between users (internal)
  static async transferBetweenUsers(fromUserId, toUserId, currency, amount, description = '') {
    try {
      if (amount <= 0) {
        throw new Error('Transfer amount must be positive');
      }

      if (fromUserId === toUserId) {
        throw new Error('Cannot transfer to yourself');
      }

      const fromWallet = await this.getUserWallet(fromUserId, currency);
      const toWallet = await this.getUserWallet(toUserId, currency);

      const result = await Wallet.transfer(fromWallet.id, toWallet.id, amount, description);

      logger.logUserAction(fromUserId, 'INTERNAL_TRANSFER_SENT', {
        toUserId,
        currency,
        amount,
        description
      });

      logger.logUserAction(toUserId, 'INTERNAL_TRANSFER_RECEIVED', {
        fromUserId,
        currency,
        amount,
        description
      });

      return result;
    } catch (error) {
      logger.error('Internal transfer error:', error);
      throw error;
    }
  }

  // Get wallet statistics
  static async getWalletStats(userId) {
    try {
      const wallets = await this.getUserWallets(userId);
      const transactions = await Transaction.getTransactionStats(userId);

      const totalBalances = wallets.reduce((acc, wallet) => {
        acc[wallet.currency] = {
          available: wallet.balance,
          locked: wallet.locked_balance,
          total: wallet.getTotalBalance()
        };
        return acc;
      }, {});

      return {
        success: true,
        balances: totalBalances,
        transaction_stats: transactions,
        wallet_count: wallets.length
      };
    } catch (error) {
      logger.error('Wallet stats error:', error);
      throw new Error('Failed to fetch wallet statistics');
    }
  }
}

module.exports = WalletService;