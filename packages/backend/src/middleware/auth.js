const jwt = require('jsonwebtoken');
const AuthService = require('../services/AuthService');
const redis = require('../config/redis');
const logger = require('../config/logger');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format' 
      });
    }

    // Validate session
    const sessionInfo = await AuthService.validateSession(token);
    
    if (!sessionInfo) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Attach user info to request
    req.user = sessionInfo.user;
    req.session = sessionInfo.session;
    req.token = token;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        const sessionInfo = await AuthService.validateSession(token);
        
        if (sessionInfo) {
          req.user = sessionInfo.user;
          req.session = sessionInfo.session;
          req.token = token;
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    // Continue without authentication for optional auth
    next();
  }
};

// Require email verification
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({ 
      success: false, 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
};

// Require phone verification
const requirePhoneVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  if (!req.user.phone_verified) {
    return res.status(403).json({ 
      success: false, 
      error: 'Phone verification required',
      code: 'PHONE_NOT_VERIFIED'
    });
  }

  next();
};

// Require 2FA for sensitive operations
const require2FA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (!req.user.two_fa_enabled) {
      return res.status(403).json({ 
        success: false, 
        error: 'Two-factor authentication required for this operation',
        code: '2FA_REQUIRED'
      });
    }

    const twoFAToken = req.headers['x-2fa-token'];
    
    if (!twoFAToken) {
      return res.status(403).json({ 
        success: false, 
        error: 'Two-factor authentication token required',
        code: '2FA_TOKEN_REQUIRED'
      });
    }

    // Check if 2FA token was recently used (prevent replay attacks)
    const recentUseKey = `2fa_recent:${req.user.id}:${twoFAToken}`;
    const recentlyUsed = await redis.exists(recentUseKey);
    
    if (recentlyUsed) {
      return res.status(403).json({ 
        success: false, 
        error: 'Two-factor authentication token already used',
        code: '2FA_TOKEN_USED'
      });
    }

    // Verify 2FA token
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user || !user.verify2FAToken(twoFAToken)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid two-factor authentication token',
        code: '2FA_INVALID'
      });
    }

    // Mark token as recently used (valid for 30 seconds)
    await redis.setex(recentUseKey, 30, '1');

    next();
  } catch (error) {
    logger.error('2FA verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Two-factor authentication verification failed' 
    });
  }
};

// Check if user account is active
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  if (!req.user.is_active) {
    return res.status(403).json({ 
      success: false, 
      error: 'Account is deactivated',
      code: 'ACCOUNT_DEACTIVATED'
    });
  }

  next();
};

// Role-based access control (for admin functions)
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// API Key authentication (for trading API endpoints)
const authenticateAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];

    if (!apiKey || !apiSecret || !timestamp || !signature) {
      return res.status(401).json({ 
        success: false, 
        error: 'API key authentication required' 
      });
    }

    // TODO: Implement API key validation logic
    // This would involve:
    // 1. Finding the API key in database
    // 2. Verifying the signature
    // 3. Checking permissions
    // 4. Rate limiting

    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'API key authentication failed' 
    });
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  requireEmailVerification,
  requirePhoneVerification,
  require2FA,
  requireActiveAccount,
  requireRole,
  authenticateAPIKey
};