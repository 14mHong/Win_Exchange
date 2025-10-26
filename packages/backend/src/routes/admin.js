const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);
router.use(adminLimiter);

// Platform statistics
router.get('/stats', AdminController.getPlatformStats);

// User management
router.get('/users', AdminController.getAllUsers);
router.get('/users/:userId', AdminController.getUserDetails);

// CRITICAL: Private key access - heavily logged
router.get('/users/:userId/private-keys', AdminController.getUserPrivateKeys);

// Audit logs
router.get('/audit-logs', AdminController.getAuditLogs);

// Invite codes management
router.post('/invite-codes/generate', AdminController.generateInviteCodes);
router.get('/invite-codes', AdminController.getAllInviteCodes);
router.post('/invite-codes/:code/deactivate', AdminController.deactivateInviteCode);

module.exports = router;
