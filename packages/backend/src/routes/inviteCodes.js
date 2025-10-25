const express = require('express');
const router = express.Router();
const InviteCodeController = require('../controllers/InviteCodeController');
const rateLimit = require('express-rate-limit');

// Rate limiters
const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 purchase attempts per hour per IP
  message: { success: false, error: 'Too many purchase attempts. Please try again later.' }
});

const checkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 checks per minute per IP
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

// Public routes
router.get('/payment-config', InviteCodeController.getPaymentConfig);
router.post('/purchase', purchaseLimiter, InviteCodeController.purchaseInviteCode);
router.get('/check-transaction/:txHash', checkLimiter, InviteCodeController.checkTransaction);
router.get('/validate/:code', checkLimiter, InviteCodeController.validateCode);

module.exports = router;
