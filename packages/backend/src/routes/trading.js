const express = require('express');
const TradingController = require('../controllers/TradingController');
const {
  authenticate,
  requireEmailVerification,
  requireActiveAccount,
  optionalAuth
} = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting configurations
const tradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 trading requests per minute
  message: {
    success: false,
    error: 'Too many trading requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 order placements per minute
  message: {
    success: false,
    error: 'Too many order requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const marketDataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 market data requests per minute
  message: {
    success: false,
    error: 'Too many market data requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public market data routes (no authentication required)
router.get('/pairs', marketDataLimiter, TradingController.getTradingPairs);
router.get('/orderbook/:tradingPair', marketDataLimiter, TradingController.getOrderBook);
router.get('/trades/:tradingPair', marketDataLimiter, TradingController.getRecentTrades);
router.get('/stats/:tradingPair?', marketDataLimiter, TradingController.get24hStats);
router.get('/ohlcv/:tradingPair', marketDataLimiter, TradingController.getOHLCVData);

// Protected trading routes (authentication required)
router.use(authenticate);
router.use(requireActiveAccount);

// Order management routes
router.post('/orders', orderLimiter, TradingController.placeOrder);
router.delete('/orders/:orderId', tradingLimiter, TradingController.cancelOrder);
router.delete('/orders', tradingLimiter, TradingController.cancelAllOrders);
router.get('/orders', tradingLimiter, TradingController.getUserOrders);
router.get('/orders/:orderId', tradingLimiter, TradingController.getOrder);
router.get('/orders/count/open', tradingLimiter, TradingController.getOpenOrdersCount);

// Trade history routes
router.get('/trades', tradingLimiter, TradingController.getTradeHistory);
router.get('/stats', tradingLimiter, TradingController.getUserTradingStats);

// Admin routes for managing trading pairs (authenticated users can create pairs)
router.post('/pairs', tradingLimiter, TradingController.createTradingPair);
router.patch('/pairs/:symbol/status', tradingLimiter, TradingController.updateTradingPairStatus);

module.exports = router;