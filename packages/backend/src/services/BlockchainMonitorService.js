const { ethers } = require('ethers');
const DepositAddress = require('../models/DepositAddress');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const logger = require('../config/logger');

/**
 * BlockchainMonitorService
 *
 * Monitors blockchain for incoming deposits and automatically
 * credits user wallets when confirmations are met.
 *
 * Supports:
 * - Ethereum and ERC-20 tokens (USDT, USDC)
 * - Bitcoin (requires separate Bitcoin node)
 * - Other chains (to be implemented)
 */
class BlockchainMonitorService {
  constructor() {
    this.isMonitoring = false;
    this.providers = {};
    this.intervals = {};

    // Confirmation requirements per currency
    this.REQUIRED_CONFIRMATIONS = {
      ETH: 12,
      USDT: 12,
      USDC: 12,
      BTC: 6,
      LTC: 6,
      BNB: 15
    };

    // Initialize providers from environment
    this.initializeProviders();
  }

  /**
   * Initialize blockchain providers
   */
  initializeProviders() {
    // Ethereum mainnet
    if (process.env.ETHEREUM_RPC_URL) {
      this.providers.ETH = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);

      // Detect network type
      this.isTestnet = process.env.ETHEREUM_RPC_URL.includes('sepolia') ||
                      process.env.ETHEREUM_RPC_URL.includes('goerli') ||
                      process.env.ETHEREUM_RPC_URL.includes('testnet');

      const networkType = this.isTestnet ? 'testnet (Sepolia)' : 'mainnet';
      logger.info(`Ethereum provider initialized: ${networkType}`);
    }

    // Add more providers as needed
    // this.providers.BTC = new BitcoinRPC(...);
  }

  /**
   * Get the network string for database queries
   * Returns the network string that matches the deposit_addresses table constraint
   */
  getNetworkString() {
    return this.isTestnet ? 'ETH Testnet' : 'Ethereum Mainnet';
  }

  /**
   * Start monitoring all configured blockchains
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Blockchain monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting blockchain monitoring');

    // Monitor Ethereum (and ERC-20 tokens)
    if (this.providers.ETH) {
      this.monitorEthereum();
    }

    // Add more blockchain monitors as needed
  }

  /**
   * Stop all monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;

    Object.keys(this.intervals).forEach(key => {
      clearInterval(this.intervals[key]);
    });

    this.intervals = {};
    logger.info('Blockchain monitoring stopped');
  }

  /**
   * Monitor Ethereum blockchain for deposits
   */
  async monitorEthereum() {
    logger.info('Starting Ethereum deposit monitoring');

    // Check every 15 seconds (1 block)
    this.intervals.ETH = setInterval(async () => {
      try {
        await this.checkEthereumDeposits();
      } catch (error) {
        logger.error('Ethereum monitoring error:', error);
      }
    }, 15000);

    // Initial check
    await this.checkEthereumDeposits();
  }

  /**
   * Check all Ethereum addresses for new deposits
   */
  async checkEthereumDeposits() {
    try {
      const currentBlock = await this.providers.ETH.getBlockNumber();
      const network = this.getNetworkString();

      // Get all ETH deposit addresses
      const addresses = await DepositAddress.findByCurrency('ETH', network);

      logger.debug(`Checking ${addresses.length} ETH addresses on ${network} at block ${currentBlock}`);

      for (const addr of addresses) {
        await this.checkAddressForDeposits(
          addr,
          'ETH',
          currentBlock,
          this.providers.ETH
        );
      }

      // Also check USDT addresses (same addresses as ETH on ERC-20)
      const usdtAddresses = await DepositAddress.findByCurrency('USDT', network);
      for (const addr of usdtAddresses) {
        await this.checkERC20Deposits(
          addr,
          'USDT',
          currentBlock,
          this.providers.ETH
        );
      }

      // Check USDC
      const usdcAddresses = await DepositAddress.findByCurrency('USDC', network);
      for (const addr of usdcAddresses) {
        await this.checkERC20Deposits(
          addr,
          'USDC',
          currentBlock,
          this.providers.ETH
        );
      }

      // Check pending transaction confirmations
      await this.checkPendingTransactionConfirmations('ETH', currentBlock);
      await this.checkPendingTransactionConfirmations('USDT', currentBlock);
      await this.checkPendingTransactionConfirmations('USDC', currentBlock);
    } catch (error) {
      logger.error('Error checking Ethereum deposits:', error);
    }
  }

  /**
   * Check and update confirmations for pending transactions
   */
  async checkPendingTransactionConfirmations(currency, currentBlock) {
    try {
      // Get all processing transactions for this currency
      const query = require('../config/database').query;
      const result = await query(
        `SELECT id, block_number, confirmations, tx_hash
         FROM transactions
         WHERE currency = $1 AND status = 'processing' AND block_number IS NOT NULL`,
        [currency]
      );

      logger.debug(`[checkPendingTransactionConfirmations] Found ${result.rows.length} pending ${currency} transactions`);

      for (const row of result.rows) {
        const confirmations = currentBlock - row.block_number;

        logger.debug(`[checkPendingTransactionConfirmations] Transaction ${row.id}: ${confirmations} confirmations (was: ${row.confirmations})`);

        // Update confirmations count
        if (confirmations !== row.confirmations) {
          await query(
            'UPDATE transactions SET confirmations = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [confirmations, row.id]
          );
          logger.info(`[checkPendingTransactionConfirmations] Updated ${currency} transaction ${row.id} to ${confirmations} confirmations`);
        }

        // Check if ready to confirm
        if (confirmations >= this.REQUIRED_CONFIRMATIONS[currency]) {
          logger.info(`[checkPendingTransactionConfirmations] Transaction ${row.id} has sufficient confirmations (${confirmations}/${this.REQUIRED_CONFIRMATIONS[currency]}), confirming...`);
          await this.confirmDeposit(row.id, confirmations);
        }
      }
    } catch (error) {
      logger.error(`[checkPendingTransactionConfirmations] Error checking ${currency} pending transactions:`, error);
    }
  }

  /**
   * Check a specific address for ETH deposits
   */
  async checkAddressForDeposits(depositAddr, currency, currentBlock, provider) {
    try {
      const balance = await provider.getBalance(depositAddr.address);
      const balanceEth = ethers.formatEther(balance);

      const lastBalance = depositAddr.last_checked_balance || '0';

      // Check if balance increased (deposit detected)
      if (parseFloat(balanceEth) > parseFloat(lastBalance)) {
        const depositAmount = parseFloat(balanceEth) - parseFloat(lastBalance);

        logger.info(`New ${currency} deposit detected:`, {
          userId: depositAddr.user_id,
          address: depositAddr.address,
          amount: depositAmount,
          balance: balanceEth
        });

        // Get transaction details
        logger.debug(`Getting recent transactions for ${depositAddr.address}`);
        const txs = await this.getRecentTransactions(
          depositAddr.address,
          depositAddr.last_checked_block,
          currentBlock,
          provider
        );
        logger.debug(`Found ${txs.length} transactions`);

        for (const tx of txs) {
          logger.debug(`Processing deposit transaction:`, {
            userId: depositAddr.user_id,
            currency,
            txHash: tx.hash,
            amount: depositAmount,
            currentBlock
          });
          await this.processDeposit(
            depositAddr.user_id,
            currency,
            tx,
            depositAmount,
            currentBlock
          );
        }
      } else if (parseFloat(balanceEth) < parseFloat(lastBalance)) {
        // Balance decreased (funds moved to cold storage or withdrawn externally)
        logger.info(`${currency} balance decreased (external withdrawal):`, {
          userId: depositAddr.user_id,
          address: depositAddr.address,
          oldBalance: lastBalance,
          newBalance: balanceEth,
          note: 'User balance NOT affected - only internal withdrawals affect balance'
        });
      }

      // ALWAYS update last checked balance (whether increased, decreased, or stayed same)
      await DepositAddress.updateLastBalance(
        depositAddr.user_id,
        currency,
        balanceEth
      );

      // Update last checked block
      await DepositAddress.updateLastCheckedBlock(
        depositAddr.user_id,
        currency,
        currentBlock
      );
    } catch (error) {
      logger.error(`Error checking address ${depositAddr.address}:`, error);
    }
  }

  /**
   * Check ERC-20 token deposits
   */
  async checkERC20Deposits(depositAddr, currency, currentBlock, provider) {
    try {
      const tokenAddress = this.getTokenContractAddress(currency);
      if (!tokenAddress) return;

      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ],
        provider
      );

      const balance = await tokenContract.balanceOf(depositAddr.address);
      const decimals = currency === 'USDT' || currency === 'USDC' ? 6 : 18;
      const balanceFormatted = ethers.formatUnits(balance, decimals);

      const lastBalance = depositAddr.last_checked_balance || '0';

      // Check if balance increased (deposit detected)
      if (parseFloat(balanceFormatted) > parseFloat(lastBalance)) {
        const depositAmount = parseFloat(balanceFormatted) - parseFloat(lastBalance);

        logger.info(`New ${currency} deposit detected:`, {
          userId: depositAddr.user_id,
          address: depositAddr.address,
          amount: depositAmount,
          balance: balanceFormatted
        });

        // Get token transfer events
        // Limit to recent blocks to avoid Alchemy free tier limits (10 blocks max)
        const filter = tokenContract.filters.Transfer(null, depositAddr.address);
        const maxBlockRange = 10;
        const fromBlock = Math.max(currentBlock - maxBlockRange, parseInt(depositAddr.last_checked_block) || 0);

        let events = [];
        try {
          events = await tokenContract.queryFilter(
            filter,
            fromBlock,
            currentBlock
          );
        } catch (error) {
          logger.warn(`Could not fetch Transfer events for ${currency}, will create placeholder transaction:`, error.message);
        }

        if (events.length > 0) {
          // Found Transfer events
          for (const event of events) {
            const amount = ethers.formatUnits(event.args.value, decimals);
            await this.processDeposit(
              depositAddr.user_id,
              currency,
              {
                hash: event.transactionHash,
                from: event.args.from,
                blockNumber: event.blockNumber
              },
              parseFloat(amount),
              currentBlock
            );
          }
        } else {
          // No events found (likely old deposit), create placeholder transaction
          logger.info(`No Transfer events found for ${currency} deposit, creating placeholder transaction`);
          await this.processDeposit(
            depositAddr.user_id,
            currency,
            {
              hash: `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`,
              from: '0x0000000000000000000000000000000000000000',
              to: depositAddr.address,
              blockNumber: currentBlock
            },
            depositAmount,
            currentBlock
          );
        }
      } else if (parseFloat(balanceFormatted) < parseFloat(lastBalance)) {
        // Balance decreased (funds moved to cold storage or withdrawn externally)
        logger.info(`${currency} balance decreased (external withdrawal):`, {
          userId: depositAddr.user_id,
          address: depositAddr.address,
          oldBalance: lastBalance,
          newBalance: balanceFormatted,
          note: 'User balance NOT affected - only internal withdrawals affect balance'
        });
      }

      // ALWAYS update last checked balance (whether increased, decreased, or stayed same)
      await DepositAddress.updateLastBalance(
        depositAddr.user_id,
        currency,
        balanceFormatted
      );

      await DepositAddress.updateLastCheckedBlock(
        depositAddr.user_id,
        currency,
        currentBlock
      );
    } catch (error) {
      logger.error(`Error checking ERC-20 ${currency} for ${depositAddr.address}:`, error);
    }
  }

  /**
   * Get recent transactions for an address
   * For MVP, we create a simplified transaction record when balance changes
   */
  async getRecentTransactions(address, fromBlock, toBlock, provider) {
    try {
      // For ETH transfers, create a simple transaction placeholder
      // In production, you would query actual transaction hashes via Alchemy API or block scanning
      return [{
        hash: `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`,
        from: '0x0000000000000000000000000000000000000000', // Unknown sender for now
        to: address,
        blockNumber: toBlock
      }];
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      return [];
    }
  }

  /**
   * Process a detected deposit
   */
  async processDeposit(userId, currency, txData, amount, currentBlock) {
    try {
      logger.info(`[processDeposit] Starting deposit processing:`, {
        userId,
        currency,
        txHash: txData.hash,
        amount,
        currentBlock,
        txBlockNumber: txData.blockNumber
      });

      // Check if transaction already exists
      logger.debug(`[processDeposit] Checking if transaction exists: ${txData.hash}`);
      const existingTxs = await Transaction.findByTxHash(txData.hash);
      const existingTx = existingTxs.length > 0 ? existingTxs[0] : null;

      if (existingTx) {
        logger.info(`[processDeposit] Transaction already exists:`, {
          txId: existingTx.id,
          status: existingTx.status,
          confirmations: existingTx.confirmations
        });

        // Update confirmations
        const confirmations = currentBlock - txData.blockNumber;
        logger.debug(`[processDeposit] Calculated confirmations: ${confirmations}, required: ${this.REQUIRED_CONFIRMATIONS[currency]}`);

        if (confirmations >= this.REQUIRED_CONFIRMATIONS[currency]) {
          logger.info(`[processDeposit] Sufficient confirmations, confirming deposit`);
          await this.confirmDeposit(existingTx.id, confirmations);
        } else {
          logger.info(`[processDeposit] Insufficient confirmations: ${confirmations}/${this.REQUIRED_CONFIRMATIONS[currency]}`);
        }
        return;
      }

      logger.debug(`[processDeposit] Transaction not found, creating new transaction record`);

      // Get user wallet
      logger.debug(`[processDeposit] Looking up wallet for user ${userId} currency ${currency}`);
      const wallet = await Wallet.findByUserAndCurrency(userId, currency);

      if (!wallet) {
        logger.error(`[processDeposit] Wallet not found for user ${userId} currency ${currency}`);
        return;
      }

      logger.info(`[processDeposit] Wallet found:`, {
        walletId: wallet.id,
        currentBalance: wallet.balance,
        depositAddress: wallet.deposit_address
      });

      // Create pending transaction
      const txPayload = {
        user_id: userId,
        wallet_id: wallet.id,
        type: 'deposit',
        currency,
        amount,
        status: 'processing',
        tx_hash: txData.hash,
        block_number: txData.blockNumber,
        confirmations: 0,
        external_id: `deposit_${txData.hash}`,
        notes: `Blockchain deposit - ${currency} from ${txData.from || 'unknown'}`
      };

      logger.debug(`[processDeposit] Creating transaction with payload:`, txPayload);
      const transaction = await Transaction.create(txPayload);

      logger.info('✅ Deposit transaction created:', {
        transactionId: transaction.id,
        userId,
        currency,
        amount,
        txHash: txData.hash,
        status: transaction.status
      });

      // Check if enough confirmations
      const confirmations = currentBlock - txData.blockNumber;
      logger.debug(`[processDeposit] Checking confirmations: ${confirmations} >= ${this.REQUIRED_CONFIRMATIONS[currency]}`);

      if (confirmations >= this.REQUIRED_CONFIRMATIONS[currency]) {
        logger.info(`[processDeposit] Sufficient confirmations (${confirmations}), confirming deposit immediately`);
        await this.confirmDeposit(transaction.id, confirmations);
      } else {
        logger.info(`[processDeposit] Insufficient confirmations (${confirmations}/${this.REQUIRED_CONFIRMATIONS[currency]}), waiting for more blocks`);
      }
    } catch (error) {
      logger.error('[processDeposit] ERROR processing deposit:', {
        error: error.message,
        stack: error.stack,
        userId,
        currency,
        txHash: txData.hash,
        amount
      });
    }
  }

  /**
   * Confirm deposit and credit user wallet
   */
  async confirmDeposit(transactionId, confirmations) {
    try {
      logger.info(`[confirmDeposit] Starting confirmation for transaction ${transactionId} with ${confirmations} confirmations`);

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        logger.error(`[confirmDeposit] Transaction not found: ${transactionId}`);
        return;
      }

      if (transaction.status === 'completed') {
        logger.debug(`[confirmDeposit] Transaction already completed: ${transactionId}`);
        return;
      }

      logger.debug(`[confirmDeposit] Transaction found:`, {
        id: transaction.id,
        userId: transaction.user_id,
        currency: transaction.currency,
        amount: transaction.amount,
        status: transaction.status,
        walletId: transaction.wallet_id
      });

      // Get wallet
      logger.debug(`[confirmDeposit] Fetching wallet ${transaction.wallet_id}`);
      const wallet = await Wallet.findById(transaction.wallet_id);

      if (!wallet) {
        logger.error(`[confirmDeposit] Wallet not found: ${transaction.wallet_id}`);
        throw new Error('Wallet not found');
      }

      logger.info(`[confirmDeposit] Wallet found, current balance: ${wallet.balance}`);

      // Credit user wallet
      logger.debug(`[confirmDeposit] Updating wallet balance by ${transaction.amount}`);
      await wallet.updateBalance(transaction.amount);
      logger.info(`[confirmDeposit] ✅ Wallet balance updated`);

      // Update transaction status
      logger.debug(`[confirmDeposit] Updating transaction status to completed`);
      await transaction.updateStatus('completed', {
        confirmations,
        completed_at: new Date()
      });

      logger.info('🎉 Deposit confirmed and credited:', {
        transactionId,
        userId: transaction.user_id,
        currency: transaction.currency,
        amount: transaction.amount,
        confirmations,
        newBalance: parseFloat(wallet.balance) + parseFloat(transaction.amount)
      });

      // TODO: Send notification to user
    } catch (error) {
      logger.error('[confirmDeposit] ERROR confirming deposit:', {
        error: error.message,
        stack: error.stack,
        transactionId,
        confirmations
      });
    }
  }

  /**
   * Get ERC-20 token contract addresses
   */
  getTokenContractAddress(currency) {
    // Check if we're on Sepolia testnet
    const isTestnet = process.env.ETHEREUM_RPC_URL && process.env.ETHEREUM_RPC_URL.includes('sepolia');

    if (isTestnet) {
      // Sepolia testnet addresses
      const sepoliaAddresses = {
        USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Sepolia USDT (mock)
        USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'  // Sepolia USDC (Aave)
      };
      return sepoliaAddresses[currency];
    } else {
      // Mainnet addresses
      const addresses = {
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Mainnet
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'  // Mainnet
      };
      return addresses[currency];
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      providers: Object.keys(this.providers),
      activeMonitors: Object.keys(this.intervals)
    };
  }
}

// Singleton instance
module.exports = new BlockchainMonitorService();
