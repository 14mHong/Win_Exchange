const express = require('express');
const logger = require('./config/logger');

// Import middleware
const {
  corsOptions,
  securityHeaders,
  globalRateLimit,
  checkBlacklist,
  requestLogger,
  securityMonitor,
  requestSizeLimiter,
  loginAttemptTracker
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const tradingRoutes = require('./routes/trading');
const swapRoutes = require('./routes/swap');
const adminRoutes = require('./routes/admin');
const winTokenRoutes = require('./routes/api/winToken');
const adminWinTokenRoutes = require('./routes/admin/winToken');
const inviteCodeRoutes = require('./routes/inviteCodes');

// Create Express app
const createApp = () => {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security middleware
  app.use(securityHeaders);
  app.use(require('cors')(corsOptions));
  app.use(requestSizeLimiter);
  app.use(checkBlacklist);
  app.use(globalRateLimit);
  app.use(loginAttemptTracker);
  app.use(requestLogger);
  app.use(securityMonitor);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Win Exchange API is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/trading', tradingRoutes);
  app.use('/api/swap', swapRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/win-token', winTokenRoutes);
  app.use('/api/admin/win-token', adminWinTokenRoutes);
  app.use('/api/invite-codes', inviteCodeRoutes);

  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    
    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
    }
    
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({
        success: false,
        error: 'CORS policy violation'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  return app;
};

module.exports = { createApp };