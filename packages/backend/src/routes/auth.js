const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticate, requireEmailVerification, require2FA } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per window (increased for better UX)
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes (no authentication required)
router.post('/register', authLimiter, AuthController.register);
router.post('/verify-registration', authLimiter, AuthController.verifyRegistration);
router.post('/login', authLimiter, AuthController.login);
router.post('/reset-password', passwordResetLimiter, AuthController.resetPassword);
router.post('/reset-password/confirm', authLimiter, AuthController.confirmPasswordReset);

// OAuth routes (public)
// No rate limiting on OAuth initiation since it just generates a redirect URL
router.get('/oauth/:provider', AuthController.initiateOAuth);
// Google redirects here with GET request (query params: code, state)
router.get('/oauth/:provider/callback', authLimiter, AuthController.handleOAuthCallback);
// Also support POST for manual callback handling
router.post('/oauth/:provider/callback', authLimiter, AuthController.handleOAuthCallback);

// Protected routes (authentication required)
router.use(authenticate);

// Basic authenticated routes
router.post('/logout', generalLimiter, AuthController.logout);
router.post('/refresh-token', generalLimiter, AuthController.refreshToken);
router.get('/profile', generalLimiter, AuthController.getProfile);
router.put('/profile', generalLimiter, AuthController.updateProfile);

// Email/Phone verification routes
router.post('/verify/email', generalLimiter, AuthController.verifyEmail);
router.post('/verify/phone', generalLimiter, AuthController.verifyPhone);
router.post('/verify/resend', generalLimiter, AuthController.resendVerification);
router.post('/phone/add', generalLimiter, AuthController.addPhoneNumber);

// 2FA routes - no email verification required, users can set up anytime
router.post('/2fa/setup', generalLimiter, AuthController.setup2FA);
router.post('/2fa/verify-setup', generalLimiter, AuthController.verify2FASetup);
router.post('/2fa/disable', authLimiter, AuthController.disable2FA);

module.exports = router;