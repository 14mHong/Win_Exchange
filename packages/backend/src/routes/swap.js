const express = require('express');
const SwapController = require('../controllers/SwapController');
const {
  authenticate,
  requireActiveAccount
} = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting configurations
const priceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  message: {
    success: false,
    error: 'Too many price requests, please try again later'
  }
});

const swapLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 swaps per minute
  message: {
    success: false,
    error: 'Too many swap requests, please try again later'
  }
});

// Public routes - Price data
router.get('/price/:symbol', priceLimiter, SwapController.getPrice);
router.get('/prices', priceLimiter, SwapController.getPrices);
router.get('/quote', priceLimiter, SwapController.getSwapQuote);
router.get('/chart/:symbol', priceLimiter, SwapController.getMarketChart);

// Protected routes - Require authentication
router.use(authenticate);
router.use(requireActiveAccount);

// Swap operations
router.post('/market', swapLimiter, SwapController.executeMarketSwap);
router.get('/history', SwapController.getSwapHistory);

// Limit orders
router.post('/limit', swapLimiter, SwapController.createLimitOrder);
router.get('/limit', SwapController.getLimitOrders);
router.delete('/limit/:orderId', SwapController.cancelLimitOrder);

module.exports = router;
