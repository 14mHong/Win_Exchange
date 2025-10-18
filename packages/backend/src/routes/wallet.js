const express = require('express');
const WalletController = require('../controllers/WalletController');
const { 
  authenticate, 
  requireEmailVerification, 
  requireActiveAccount,
  require2FA 
} = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting configurations
const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many wallet requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 withdrawal attempts per hour
  message: {
    success: false,
    error: 'Too many withdrawal attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const transferLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 transfer attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many transfer attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply authentication and basic requirements to all routes
router.use(authenticate);
router.use(requireActiveAccount);

// Basic wallet routes (no email verification required for viewing)
router.get('/wallets', walletLimiter, WalletController.getWallets);
router.get('/wallets/:currency', walletLimiter, WalletController.getWallet);
router.get('/balances', walletLimiter, WalletController.getBalances);
router.get('/currencies', walletLimiter, WalletController.getSupportedCurrencies);
router.get('/stats', walletLimiter, WalletController.getWalletStats);

// Deposit routes
router.get('/deposit/:currency/address', walletLimiter, WalletController.generateDepositAddress);
router.post('/deposit/simulate', walletLimiter, WalletController.simulateDeposit);

// Withdrawal routes (require email verification and 2FA for security)
router.post('/withdraw', requireEmailVerification, withdrawalLimiter, WalletController.processWithdrawal);

// Transfer routes (require email verification for security)
router.post('/transfer', requireEmailVerification, transferLimiter, WalletController.internalTransfer);

// Transaction history routes
router.get('/transactions', walletLimiter, WalletController.getTransactionHistory);
router.get('/transactions/:transactionId', walletLimiter, WalletController.getTransaction);

module.exports = router;