const winston = require('winston');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'win-backend' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// If we're not in production, also log to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for different log levels
const logHelpers = {
  logSecurityEvent: (event, details) => {
    logger.warn('SECURITY_EVENT', {
      event,
      details,
      timestamp: new Date().toISOString()
    });
  },

  logAPIRequest: (req, res, responseTime) => {
    logger.info('API_REQUEST', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id
    });
  },

  logDatabaseQuery: (query, duration, error = null) => {
    if (error) {
      logger.error('DB_QUERY_ERROR', {
        query,
        duration,
        error: error.message
      });
    } else {
      logger.debug('DB_QUERY', {
        query,
        duration
      });
    }
  },

  logTradeExecution: (trade) => {
    logger.info('TRADE_EXECUTED', {
      tradeId: trade.id,
      tradingPair: trade.trading_pair,
      price: trade.price,
      quantity: trade.quantity,
      buyOrderId: trade.buy_order_id,
      sellOrderId: trade.sell_order_id
    });
  },

  logUserAction: (userId, action, details = {}) => {
    logger.info('USER_ACTION', {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Export both logger methods and helpers
module.exports = Object.assign(logger, logHelpers);