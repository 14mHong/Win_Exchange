const logger = require('../config/logger');

/**
 * Middleware to check if the authenticated user has admin privileges
 * Must be used after the authenticate middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user has admin privileges
    if (!req.user.is_admin) {
      logger.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', {
        userId: req.user.id,
        email: req.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Log successful admin access
    logger.logUserAction(req.user.id, 'ADMIN_ACCESS', {
      endpoint: req.originalUrl,
      method: req.method,
      ipAddress: req.ip
    });

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = { requireAdmin };
