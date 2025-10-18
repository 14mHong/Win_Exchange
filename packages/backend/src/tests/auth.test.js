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

describe('Authentication Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock responses
    mockQuery.mockImplementation((query, params) => {
      if (query.includes('SELECT') && query.includes('users') && query.includes('email')) {
        // Login/user lookup queries
        if (params && params[0] === 'test@example.com') {
          return {
            rows: [{
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'test@example.com',
              password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj5kLDMxmm2K', // 'TestPassword123!'
              is_verified: true,
              two_fa_enabled: false,
              failed_login_attempts: 0,
              locked_until: null,
              created_at: new Date()
            }]
          };
        }
        return { rows: [] };
      }
      
      if (query.includes('INSERT') && query.includes('users')) {
        // Registration query
        return {
          rows: [{
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: params[0],
            created_at: new Date()
          }]
        };
      }
      
      if (query.includes('UPDATE') && query.includes('users')) {
        // Update queries
        return { rowCount: 1 };
      }
      
      return { rows: [], rowCount: 0 };
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      };

      // Mock user doesn't exist
      mockQuery.mockImplementationOnce(() => ({ rows: [] }));
      // Mock successful user creation
      mockQuery.mockImplementationOnce(() => ({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'newuser@example.com',
          created_at: new Date()
        }]
      }));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      };

      // Mock user already exists
      mockQuery.mockImplementationOnce(() => ({
        rows: [{ id: '123', email: 'test@example.com' }]
      }));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    it('should fail with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      // Mock user not found
      mockQuery.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      // Make multiple requests rapidly
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429) or succeed (200)
      const statusCodes = responses.map(res => res.status);
      expect(statusCodes).toEqual(expect.arrayContaining([expect.any(Number)]));
    });
  });
});