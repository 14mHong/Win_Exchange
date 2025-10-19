const redis = require('redis');
const logger = require('./logger');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Too many Redis connection attempts');
        return new Error('Too many retries');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    }
  }
});

client.on('connect', () => {
  logger.info('Connected to Redis server');
});

client.on('error', (err) => {
  logger.error('Redis client error:', err);
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
    logger.info('Redis connection established');
    return true;
  } catch (err) {
    logger.error('Failed to connect to Redis:', err);
    return false;
  }
};

// Redis helper functions
const redisHelpers = {
  // Set key with expiration
  setex: async (key, seconds, value) => {
    try {
      await client.setEx(key, seconds, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Redis SETEX error:', err);
      return false;
    }
  },

  // Get key
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error('Redis GET error:', err);
      return null;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      await client.del(key);
      return true;
    } catch (err) {
      logger.error('Redis DEL error:', err);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (err) {
      logger.error('Redis EXISTS error:', err);
      return false;
    }
  },

  // Increment key
  incr: async (key) => {
    try {
      return await client.incr(key);
    } catch (err) {
      logger.error('Redis INCR error:', err);
      return null;
    }
  },

  // Set expiration on key
  expire: async (key, seconds) => {
    try {
      await client.expire(key, seconds);
      return true;
    } catch (err) {
      logger.error('Redis EXPIRE error:', err);
      return false;
    }
  },

  // Add to set
  sadd: async (key, member) => {
    try {
      await client.sAdd(key, member);
      return true;
    } catch (err) {
      logger.error('Redis SADD error:', err);
      return false;
    }
  },

  // Remove from set
  srem: async (key, member) => {
    try {
      await client.sRem(key, member);
      return true;
    } catch (err) {
      logger.error('Redis SREM error:', err);
      return false;
    }
  },

  // Check if member exists in set
  sismember: async (key, member) => {
    try {
      return await client.sIsMember(key, member);
    } catch (err) {
      logger.error('Redis SISMEMBER error:', err);
      return false;
    }
  }
};

module.exports = {
  client,
  connectRedis,
  ...redisHelpers
};