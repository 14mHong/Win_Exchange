const WalletService = require('../services/WalletService');
const CryptoWalletService = require('../services/CryptoWalletService');
const DepositAddress = require('../models/DepositAddress');
const logger = require('../config/logger');
const Joi = require('joi');

class WalletController {
  // Get user wallets
  static async getWallets(req, res) {
    try {
      const wallets = await WalletService.getUserWallets(req.user.id);

      res.json({
        success: true,
        wallets: wallets.map(wallet => wallet.toPublic())
      });
    } catch (error) {
      logger.error('Get wallets error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user balances (for swap interface)
  static async getBalances(req, res) {
    try {
      const { query } = require('../config/database');

      const result = await query(
        `SELECT currency, balance, locked_balance
         FROM wallets
         WHERE user_id = $1
         ORDER BY currency ASC`,
        [req.user.id]
      );

      res.json({
        success: true,
        balances: result.rows
      });
    } catch (error) {
      logger.error('Get balances error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get specific wallet by currency
  static async getWallet(req, res) {
    try {
      const { currency } = req.params;
      
      if (!currency) {
        return res.status(400).json({
          success: false,
          error: 'Currency parameter is required'
        });
      }

      const wallet = await WalletService.getUserWallet(req.user.id, currency.toUpperCase());
      
      res.json({
        success: true,
        wallet: wallet.toPublic()
      });
    } catch (error) {
      logger.error('Get wallet error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Generate deposit address (using HD wallet)
  static async generateDepositAddress(req, res) {
    try {
      const { currency } = req.params;

      if (!currency) {
        return res.status(400).json({
          success: false,
          error: 'Currency parameter is required'
        });
      }

      const currencyUpper = currency.toUpperCase();

      // ERC-20 tokens use Ethereum addresses
      const ERC20_TOKENS = ['USDT', 'USDC'];

      // Check if address already exists for this currency
      let depositAddr = await DepositAddress.findByUserAndCurrency(req.user.id, currencyUpper);

      if (depositAddr) {
        // Address already exists, but ensure wallet exists too
        let wallet = await Wallet.findByUserAndCurrency(req.user.id, currencyUpper);
        if (!wallet) {
          wallet = await Wallet.create({
            user_id: req.user.id,
            currency: currencyUpper,
            balance: 0
          });
          logger.info('Auto-created missing wallet for existing deposit address', {
            userId: req.user.id,
            currency: currencyUpper,
            walletId: wallet.id
          });
        }

        // Return existing address
        return res.json({
          success: true,
          address: depositAddr.address,
          currency: currencyUpper,
          network: depositAddr.network,
          qrCode: CryptoWalletService._generateQRData(currencyUpper, depositAddr.address),
          derivationPath: depositAddr.derivation_path
        });
      }

      // If requesting an ERC-20 token, check if ETH address exists
      if (ERC20_TOKENS.includes(currencyUpper)) {
        const ethAddr = await DepositAddress.findByUserAndCurrency(req.user.id, 'ETH');

        if (ethAddr) {
          // ETH address exists, create entry for this ERC-20 token with same address
          depositAddr = await DepositAddress.create({
            user_id: req.user.id,
            currency: currencyUpper,
            address: ethAddr.address,
            derivation_path: ethAddr.derivation_path,
            network: ethAddr.network
          });

          // Ensure wallet exists for this ERC-20 token
          let wallet = await Wallet.findByUserAndCurrency(req.user.id, currencyUpper);
          if (!wallet) {
            wallet = await Wallet.create({
              user_id: req.user.id,
              currency: currencyUpper,
              balance: 0
            });
            logger.info('Auto-created wallet for ERC-20 token', {
              userId: req.user.id,
              currency: currencyUpper,
              walletId: wallet.id
            });
          }

          logger.logUserAction(req.user.id, 'DEPOSIT_ADDRESS_GENERATED', {
            currency: currencyUpper,
            address: ethAddr.address,
            type: 'ERC-20'
          });

          return res.json({
            success: true,
            currency: currencyUpper,
            address: ethAddr.address,
            network: ethAddr.network,
            qrCode: CryptoWalletService._generateQRData(currencyUpper, ethAddr.address),
            message: `Send ${currencyUpper} (ERC-20) to this Ethereum address`
          });
        }
        // If no ETH address exists yet, fall through to generate ETH address
        // and we'll create entries for both ETH and the requested ERC-20 token
      }

      // Generate new address using HD wallet
      // We need a numeric user index for derivation
      // Let's use a hash of the UUID for derivation
      const userIndex = WalletController._getUserIndexFromUUID(req.user.id);

      // Check if currency is supported
      const UNSUPPORTED_CURRENCIES = ['ADA'];
      if (UNSUPPORTED_CURRENCIES.includes(currencyUpper)) {
        return res.status(400).json({
          success: false,
          error: `${currencyUpper} deposits are not currently supported. Supported currencies: BTC, ETH, LTC, USDT, USDC`
        });
      }

      // For ERC-20 tokens, generate ETH address
      const generationCurrency = ERC20_TOKENS.includes(currencyUpper) ? 'ETH' : currencyUpper;
      const addressData = CryptoWalletService.generateDepositAddress(userIndex, generationCurrency);

      // Save to database - for ETH, create entry for requested currency
      depositAddr = await DepositAddress.create({
        user_id: req.user.id,
        currency: currencyUpper,
        address: addressData.address,
        derivation_path: addressData.derivationPath,
        network: addressData.network
      });

      // If generating for an ERC-20 token, also create ETH entry if it doesn't exist
      if (ERC20_TOKENS.includes(currencyUpper)) {
        const existingEth = await DepositAddress.findByUserAndCurrency(req.user.id, 'ETH');
        if (!existingEth) {
          await DepositAddress.create({
            user_id: req.user.id,
            currency: 'ETH',
            address: addressData.address,
            derivation_path: addressData.derivationPath,
            network: addressData.network
          });
        }
      }

      // Ensure wallet exists for this currency
      // This is critical for deposit monitoring - it needs a wallet to credit deposits to
      let wallet = await Wallet.findByUserAndCurrency(req.user.id, currencyUpper);
      if (!wallet) {
        wallet = await Wallet.create({
          user_id: req.user.id,
          currency: currencyUpper,
          balance: 0
        });
        logger.info('Auto-created wallet for deposit currency', {
          userId: req.user.id,
          currency: currencyUpper,
          walletId: wallet.id
        });
      }

      // Also ensure ETH wallet exists for ERC-20 tokens (deposits could come as ETH)
      if (ERC20_TOKENS.includes(currencyUpper)) {
        let ethWallet = await Wallet.findByUserAndCurrency(req.user.id, 'ETH');
        if (!ethWallet) {
          ethWallet = await Wallet.create({
            user_id: req.user.id,
            currency: 'ETH',
            balance: 0
          });
          logger.info('Auto-created ETH wallet for ERC-20 token', {
            userId: req.user.id,
            walletId: ethWallet.id
          });
        }
      }

      logger.logUserAction(req.user.id, 'DEPOSIT_ADDRESS_GENERATED', {
        currency: currencyUpper,
        address: addressData.address
      });

      const message = ERC20_TOKENS.includes(currencyUpper)
        ? `Send ${currencyUpper} (ERC-20) to this Ethereum address`
        : `Send ${currencyUpper} to this address to deposit funds`;

      res.json({
        success: true,
        currency: currencyUpper,
        address: addressData.address,
        network: addressData.network,
        qrCode: addressData.qrCode,
        message
      });
    } catch (error) {
      logger.error('Generate deposit address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate deposit address'
      });
    }
  }

  // Simulate deposit (for MVP testing)
  static async simulateDeposit(req, res) {
    try {
      const schema = Joi.object({
        currency: Joi.string().valid('BTC', 'ETH', 'USDT', 'USDC', 'LTC').required(),
        amount: Joi.number().positive().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { currency, amount } = value;
      
      // Only allow simulation in development/testing environments
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Deposit simulation not allowed in production'
        });
      }

      const result = await WalletService.processDeposit(req.user.id, currency, amount);
      
      res.json(result);
    } catch (error) {
      logger.error('Simulate deposit error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Process withdrawal
  static async processWithdrawal(req, res) {
    try {
      const schema = Joi.object({
        currency: Joi.string().valid('BTC', 'ETH', 'USDT', 'USDC', 'LTC').required(),
        amount: Joi.number().positive().required(),
        address: Joi.string().required(),
        two_fa_token: Joi.string().length(6).pattern(/^\d+$/).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { currency, amount, address, two_fa_token } = value;
      
      const result = await WalletService.processWithdrawal(
        req.user.id, 
        currency, 
        amount, 
        address, 
        two_fa_token
      );
      
      res.json(result);
    } catch (error) {
      logger.error('Process withdrawal error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get transaction history
  static async getTransactionHistory(req, res) {
    try {
      const schema = Joi.object({
        type: Joi.string().valid('deposit', 'withdrawal', 'trade_buy', 'trade_sell', 'fee').optional(),
        currency: Joi.string().optional(),
        status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'canceled').optional(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0),
        start_date: Joi.date().iso().optional(),
        end_date: Joi.date().iso().optional()
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const options = {
        type: value.type,
        currency: value.currency?.toUpperCase(),
        status: value.status,
        limit: value.limit,
        offset: value.offset,
        startDate: value.start_date,
        endDate: value.end_date
      };

      const result = await WalletService.getTransactionHistory(req.user.id, options);
      
      res.json(result);
    } catch (error) {
      logger.error('Get transaction history error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get specific transaction
  static async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required'
        });
      }

      const result = await WalletService.getTransaction(req.user.id, transactionId);
      
      res.json(result);
    } catch (error) {
      logger.error('Get transaction error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Internal transfer between users
  static async internalTransfer(req, res) {
    try {
      const schema = Joi.object({
        to_user_email: Joi.string().email().required(),
        currency: Joi.string().valid('BTC', 'ETH', 'USDT', 'USDC', 'LTC').required(),
        amount: Joi.number().positive().required(),
        description: Joi.string().max(255).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { to_user_email, currency, amount, description } = value;

      // Find recipient user
      const User = require('../models/User');
      const toUser = await User.findByEmail(to_user_email);

      if (!toUser) {
        return res.status(404).json({
          success: false,
          error: 'Recipient user not found'
        });
      }

      const result = await WalletService.transferBetweenUsers(
        req.user.id,
        toUser.id,
        currency,
        amount,
        description || `Transfer to ${to_user_email}`
      );
      
      res.json({
        success: true,
        message: 'Transfer completed successfully',
        transfer: result
      });
    } catch (error) {
      logger.error('Internal transfer error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get wallet statistics
  static async getWalletStats(req, res) {
    try {
      const result = await WalletService.getWalletStats(req.user.id);
      
      res.json(result);
    } catch (error) {
      logger.error('Get wallet stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get supported currencies
  static async getSupportedCurrencies(req, res) {
    try {
      const currencies = [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          decimals: 8,
          min_deposit: 0.0001,
          min_withdrawal: 0.001,
          withdrawal_fee: 0.0005,
          confirmation_required: 6
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          min_deposit: 0.001,
          min_withdrawal: 0.01,
          withdrawal_fee: 0.005,
          confirmation_required: 12
        },
        {
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          min_deposit: 1,
          min_withdrawal: 10,
          withdrawal_fee: 1,
          confirmation_required: 12
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          min_deposit: 1,
          min_withdrawal: 10,
          withdrawal_fee: 1,
          confirmation_required: 12
        },
        {
          symbol: 'LTC',
          name: 'Litecoin',
          decimals: 8,
          min_deposit: 0.001,
          min_withdrawal: 0.01,
          withdrawal_fee: 0.001,
          confirmation_required: 6
        }
      ];

      res.json({
        success: true,
        currencies
      });
    } catch (error) {
      logger.error('Get supported currencies error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch supported currencies'
      });
    }
  }

  // Helper: Convert UUID to numeric index for HD wallet derivation
  static _getUserIndexFromUUID(uuid) {
    // Remove hyphens and take first 8 characters
    const hex = uuid.replace(/-/g, '').substring(0, 8);
    // Convert to integer and ensure it's within BIP44 valid range
    // BIP44 requires index < 2^31 (2147483648) for non-hardened keys
    const index = parseInt(hex, 16);
    return index % 2147483648; // Ensure index is less than 2^31
  }
}

module.exports = WalletController;