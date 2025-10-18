const request = require('supertest');

// Mock the database and dependencies before importing the app
const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../config/database', () => ({
  query: mockQuery,
  transaction: mockTransaction,
  testConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn()
}));

const { createTestApp } = require('../test-app');
const app = createTestApp();

describe('Trading Endpoints', () => {
  let authToken;
  const testUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'trader@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate a test token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test_jwt_secret',
      { expiresIn: '1h' }
    );

    // Default mock responses
    mockQuery.mockImplementation((query, params) => {
      if (query.includes('SELECT') && query.includes('users') && query.includes('email')) {
        return {
          rows: [{
            id: testUser.id,
            email: testUser.email,
            password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj5kLDMxmm2K',
            is_verified: true,
            two_fa_enabled: false,
            failed_login_attempts: 0,
            locked_until: null,
            created_at: new Date()
          }]
        };
      }
      
      if (query.includes('SELECT') && query.includes('trading_pairs')) {
        return {
          rows: [{
            id: '1',
            symbol: 'BTC-USDT',
            base_currency: 'BTC',
            quote_currency: 'USDT',
            min_order_size: 0.0001,
            max_order_size: 100,
            price_precision: 2,
            quantity_precision: 8,
            is_active: true
          }]
        };
      }
      
      if (query.includes('SELECT') && query.includes('wallets')) {
        return {
          rows: [
            { currency: 'BTC', balance: 1.0, locked_balance: 0 },
            { currency: 'USDT', balance: 50000.0, locked_balance: 0 }
          ]
        };
      }
      
      if (query.includes('INSERT') && query.includes('orders')) {
        return {
          rows: [{
            id: '456e7890-e12f-34g5-h678-901234567890',
            user_id: testUser.id,
            trading_pair_id: '1',
            order_type: params[2] || 'limit',
            side: params[3] || 'buy',
            quantity: params[4] || 0.001,
            price: params[5] || 45000,
            status: 'open',
            created_at: new Date()
          }]
        };
      }
      
      if (query.includes('SELECT') && query.includes('orders')) {
        return {
          rows: [{
            id: '456e7890-e12f-34g5-h678-901234567890',
            trading_pair: 'BTC-USDT',
            order_type: 'limit',
            side: 'buy',
            quantity: 0.001,
            price: 45000,
            status: 'open',
            created_at: new Date()
          }]
        };
      }
      
      if (query.includes('SELECT') && query.includes('trades')) {
        return { rows: [] };
      }
      
      return { rows: [], rowCount: 0 };
    });
  });

  describe('GET /api/trading/pairs', () => {
    it('should get trading pairs', async () => {
      const response = await request(app)
        .get('/api/trading/pairs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.trading_pairs).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/trading/orderbook/:pair', () => {
    it('should get order book for valid pair', async () => {
      // Mock orderbook query
      mockQuery.mockImplementationOnce(() => ({
        rows: [
          { price: 45000, total_quantity: 0.5, side: 'buy' },
          { price: 45100, total_quantity: 0.3, side: 'sell' }
        ]
      }));

      const response = await request(app)
        .get('/api/trading/orderbook/BTC-USDT');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bids).toBeInstanceOf(Array);
      expect(response.body.asks).toBeInstanceOf(Array);
    });

    it('should fail for invalid pair', async () => {
      // Mock no trading pair found
      mockQuery.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .get('/api/trading/orderbook/INVALID-PAIR');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/trading/orders', () => {
    it('should place a valid limit buy order', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'buy',
        quantity: 0.001,
        price: 45000
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.order).toBeDefined();
      expect(response.body.order.side).toBe('buy');
      expect(response.body.order.order_type).toBe('limit');
    });

    it('should place a valid limit sell order', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'sell',
        quantity: 0.001,
        price: 46000
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.order).toBeDefined();
      expect(response.body.order.side).toBe('sell');
    });

    it('should fail without authentication', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'buy',
        quantity: 0.001,
        price: 45000
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .send(orderData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid order data', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'buy',
        quantity: -1, // Invalid negative quantity
        price: 45000
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/trading/orders', () => {
    it('should get user orders', async () => {
      const response = await request(app)
        .get('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orders).toBeInstanceOf(Array);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/trading/orders?status=open')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/trading/orders/:orderId', () => {
    it('should cancel user order', async () => {
      const orderId = '456e7890-e12f-34g5-h678-901234567890';
      
      // Mock order lookup and update
      mockQuery.mockImplementationOnce(() => ({
        rows: [{
          id: orderId,
          user_id: testUser.id,
          status: 'open'
        }]
      }));
      mockQuery.mockImplementationOnce(() => ({
        rows: [{
          id: orderId,
          status: 'canceled'
        }]
      }));

      const response = await request(app)
        .delete(`/api/trading/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail to cancel non-existent order', async () => {
      const orderId = '00000000-0000-0000-0000-000000000000';
      
      // Mock order not found
      mockQuery.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .delete(`/api/trading/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/trading/trades', () => {
    it('should get user trade history', async () => {
      const response = await request(app)
        .get('/api/trading/trades')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.trades).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/trading/stats/:pair', () => {
    it('should get 24h stats for trading pair', async () => {
      // Mock stats query
      mockQuery.mockImplementationOnce(() => ({
        rows: [{
          volume_24h: 100,
          price_change_24h: 5.5,
          high_24h: 46000,
          low_24h: 44000,
          last_price: 45500
        }]
      }));

      const response = await request(app)
        .get('/api/trading/stats/BTC-USDT');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });
  });

  describe('Order Validation', () => {
    it('should validate minimum order size', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'buy',
        quantity: 0.000001, // Below minimum
        price: 45000
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require price for limit orders', async () => {
      const orderData = {
        trading_pair: 'BTC-USDT',
        order_type: 'limit',
        side: 'buy',
        quantity: 0.001
        // Missing price
      };

      const response = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});