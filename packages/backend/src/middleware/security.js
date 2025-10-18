const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const logger = require('../config/logger');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Alternative dev server
      'https://your-domain.com', // Production domain
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-2fa-token', 'x-api-key', 'x-api-secret', 'x-timestamp', 'x-signature']
};

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Global rate limiter
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
  // Using default memory store instead of Redis for now
});

// IP blacklist middleware
const ipBlacklist = new Set();

const checkBlacklist = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (ipBlacklist.has(clientIp)) {
    logger.logSecurityEvent('BLACKLISTED_IP_ACCESS', {
      ip: clientIp,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }
  
  next();
};

// Add IP to blacklist
const addToBlacklist = (ip, reason = '') => {
  ipBlacklist.add(ip);
  logger.logSecurityEvent('IP_BLACKLISTED', { ip, reason });
};

// Remove IP from blacklist
const removeFromBlacklist = (ip) => {
  ipBlacklist.delete(ip);
  logger.logSecurityEvent('IP_REMOVED_FROM_BLACKLIST', { ip });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - start;
    
    logger.logAPIRequest(req, res, duration);
    
    // Log failed requests
    if (res.statusCode >= 400) {
      logger.warn('Failed request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: req.user?.id,
        error: body.error,
        duration
      });
    }
    
    return originalJson.call(this, body);
  };

  next();
};

// Security event monitoring
const securityMonitor = (req, res, next) => {
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//g,  // Path traversal
    /<script/gi, // XSS attempts
    /union.*select/gi, // SQL injection
    /javascript:/gi, // JavaScript injection
    /eval\(/gi, // Code execution
  ];

  const requestData = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.logSecurityEvent('SUSPICIOUS_REQUEST_PATTERN', {
        pattern: pattern.toString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        userId: req.user?.id
      });
      
      // Consider adding to blacklist for repeated offenses
      break;
    }
  }

  next();
};

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large'
    });
  }
  
  next();
};

// API key rate limiter (for trading API)
const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per API key
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  message: {
    success: false,
    error: 'API key rate limit exceeded'
  }
});

// Failed login attempt tracking
const loginAttemptTracker = async (req, res, next) => {
  if (req.path === '/api/auth/login' && req.method === 'POST') {
    const ip = req.ip;
    const email = req.body.email;
    
    try {
      // Check failed attempts for this IP
      const ipAttempts = await redis.get(`login_attempts:ip:${ip}`) || 0;
      
      if (ipAttempts >= 10) {
        return res.status(429).json({
          success: false,
          error: 'Too many failed login attempts from this IP. Please try again later.'
        });
      }
      
      // Check failed attempts for this email
      if (email) {
        const emailAttempts = await redis.get(`login_attempts:email:${email}`) || 0;
        
        if (emailAttempts >= 5) {
          return res.status(429).json({
            success: false,
            error: 'Too many failed login attempts for this account. Please try again later.'
          });
        }
      }
    } catch (err) {
      logger.warn('Redis connection error in login tracker, continuing without rate limiting:', err.message);
      // Continue without Redis-based rate limiting if Redis is not available
    }
  }
  
  next();
};

// Track failed login attempts
const trackFailedLogin = async (ip, email) => {
  try {
    const ipKey = `login_attempts:ip:${ip}`;
    const emailKey = `login_attempts:email:${email}`;
    
    await redis.incr(ipKey);
    await redis.expire(ipKey, 3600); // 1 hour
    
    if (email) {
      await redis.incr(emailKey);
      await redis.expire(emailKey, 3600); // 1 hour
    }
  } catch (err) {
    logger.warn('Failed to track login attempts in Redis:', err.message);
  }
};

// Clear login attempts on successful login
const clearLoginAttempts = async (ip, email) => {
  try {
    await redis.del(`login_attempts:ip:${ip}`);
    if (email) {
      await redis.del(`login_attempts:email:${email}`);
    }
  } catch (err) {
    logger.warn('Failed to clear login attempts in Redis:', err.message);
  }
};

module.exports = {
  corsOptions,
  securityHeaders,
  globalRateLimit,
  checkBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  requestLogger,
  securityMonitor,
  requestSizeLimiter,
  apiKeyRateLimit,
  loginAttemptTracker,
  trackFailedLogin,
  clearLoginAttempts
};