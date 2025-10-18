const http = require('http');
const socketIo = require('socket.io');

// Import configurations (lazily loaded to avoid test issues)
const logger = require('./config/logger');
const { createApp } = require('./app');

// Import middleware
const { corsOptions } = require('./middleware/security');

// Import services
let TradingEngine, limitOrderMonitor, utxoMonitor, blockchainMonitor, winPriceSimulator;
try {
  logger.info('Loading TradingEngine...');
  TradingEngine = require('./services/TradingEngine');
  logger.info('Loading LimitOrderMonitor...');
  limitOrderMonitor = require('./services/LimitOrderMonitor');
  logger.info('Loading UTXOMonitor...');
  utxoMonitor = require('./services/UTXOMonitor');
  logger.info('Loading BlockchainMonitorService...');
  blockchainMonitor = require('./services/BlockchainMonitorService');
  logger.info('Loading WinPriceSimulator...');
  winPriceSimulator = require('./services/WinPriceSimulator');
  logger.info('All services loaded successfully');
} catch (error) {
  logger.error('Error loading services:', error);
  process.exit(1);
}

// Initialize Express app
const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// WebSocket handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  // Join trading pair rooms for real-time updates
  socket.on('subscribe', (data) => {
    try {
      const { type, symbol } = data;
      
      if (type === 'orderbook' && symbol) {
        socket.join(`orderbook:${symbol}`);
        logger.debug('Client subscribed to orderbook', { socketId: socket.id, symbol });
      }
      
      if (type === 'trades' && symbol) {
        socket.join(`trades:${symbol}`);
        logger.debug('Client subscribed to trades', { socketId: socket.id, symbol });
      }
      
      if (type === 'ticker') {
        socket.join('ticker');
        logger.debug('Client subscribed to ticker', { socketId: socket.id });
      }
      
      socket.emit('subscribed', { type, symbol, success: true });
    } catch (error) {
      logger.error('WebSocket subscription error:', error);
      socket.emit('error', { message: 'Subscription failed' });
    }
  });

  // Unsubscribe from updates
  socket.on('unsubscribe', (data) => {
    try {
      const { type, symbol } = data;
      
      if (type === 'orderbook' && symbol) {
        socket.leave(`orderbook:${symbol}`);
      }
      
      if (type === 'trades' && symbol) {
        socket.leave(`trades:${symbol}`);
      }
      
      if (type === 'ticker') {
        socket.leave('ticker');
      }
      
      socket.emit('unsubscribed', { type, symbol, success: true });
    } catch (error) {
      logger.error('WebSocket unsubscription error:', error);
      socket.emit('error', { message: 'Unsubscription failed' });
    }
  });

  // Handle user authentication for personal updates
  socket.on('authenticate', async (data) => {
    try {
      const { token } = data;
      
      if (!token) {
        socket.emit('auth_error', { message: 'Token required' });
        return;
      }

      // Validate token (simplified for MVP)
      const AuthService = require('./services/AuthService');
      const sessionInfo = await AuthService.validateSession(token);
      
      if (sessionInfo) {
        socket.userId = sessionInfo.user.id;
        socket.join(`user:${sessionInfo.user.id}`);
        socket.emit('authenticated', { success: true });
        logger.debug('WebSocket client authenticated', { 
          socketId: socket.id, 
          userId: sessionInfo.user.id 
        });
      } else {
        socket.emit('auth_error', { message: 'Invalid token' });
      }
    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info('WebSocket client disconnected', { 
      socketId: socket.id, 
      userId: socket.userId,
      reason 
    });
  });

  socket.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Trading engine event handlers for real-time updates
TradingEngine.on('orderPlaced', (data) => {
  const { order, tradingPair } = data;
  
  // Broadcast order book update
  io.to(`orderbook:${tradingPair.symbol}`).emit('orderbook_update', {
    type: 'order_placed',
    trading_pair: tradingPair.symbol,
    timestamp: new Date().toISOString()
  });
  
  // Send personal notification to user
  io.to(`user:${order.user_id}`).emit('order_update', {
    type: 'order_placed',
    order
  });
});

TradingEngine.on('orderCanceled', (data) => {
  const { order, tradingPair } = data;
  
  // Broadcast order book update
  io.to(`orderbook:${tradingPair.symbol}`).emit('orderbook_update', {
    type: 'order_canceled',
    trading_pair: tradingPair.symbol,
    timestamp: new Date().toISOString()
  });
  
  // Send personal notification to user
  io.to(`user:${order.user_id}`).emit('order_update', {
    type: 'order_canceled',
    order
  });
});

TradingEngine.on('tradeExecuted', (data) => {
  const { trade, tradingPair, buyOrder, sellOrder } = data;
  
  // Broadcast new trade
  io.to(`trades:${tradingPair.symbol}`).emit('new_trade', {
    trade: trade.toMarketData(),
    trading_pair: tradingPair.symbol,
    timestamp: new Date().toISOString()
  });
  
  // Broadcast order book update
  io.to(`orderbook:${tradingPair.symbol}`).emit('orderbook_update', {
    type: 'trade_executed',
    trading_pair: tradingPair.symbol,
    timestamp: new Date().toISOString()
  });
  
  // Broadcast ticker update
  io.to('ticker').emit('ticker_update', {
    trading_pair: tradingPair.symbol,
    last_price: trade.price,
    timestamp: new Date().toISOString()
  });
  
  // Send personal notifications
  io.to(`user:${buyOrder.user_id}`).emit('trade_update', {
    type: 'trade_executed',
    trade: { ...trade.toJSON(), side: 'buy' }
  });
  
  io.to(`user:${sellOrder.user_id}`).emit('trade_update', {
    type: 'trade_executed',
    trade: { ...trade.toJSON(), side: 'sell' }
  });
});


// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing server gracefully...');

  // Stop limit order monitor
  limitOrderMonitor.stop();
  logger.info('Limit order monitor stopped');

  // Stop UTXO monitor
  utxoMonitor.stop();
  logger.info('UTXO monitor stopped');

  // Stop blockchain monitor
  blockchainMonitor.stopMonitoring();
  logger.info('Blockchain monitor stopped');

  // Stop WIN price simulator
  winPriceSimulator.stop();
  logger.info('WIN price simulator stopped');

  server.close(() => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      require('./config/database').pool.end(() => {
        logger.info('Database connections closed');
      });
      
      // Close Redis connection
      require('./config/redis').client.quit(() => {
        logger.info('Redis connection closed');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Dynamically import database and redis to avoid test issues
    const { testConnection } = require('./config/database');
    const { connectRedis } = require('./config/redis');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Connect to Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      throw new Error('Redis connection failed');
    }
    
    // Create logs directory
    const fs = require('fs');
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs');
    }
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Win Exchange API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`WebSocket server initialized`);

      // Start limit order monitor
      limitOrderMonitor.start();
      logger.info('Limit order monitor started');

      // Start UTXO monitor for Bitcoin/Litecoin deposit tracking
      utxoMonitor.start();
      logger.info('UTXO monitor started');

      // Start Ethereum/ERC20 blockchain monitor
      blockchainMonitor.startMonitoring();
      logger.info('Blockchain monitor started');

      // Start WIN token price simulator
      winPriceSimulator.start();
      logger.info('WIN token price simulator started');
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Export app for testing
module.exports = { app, server };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}