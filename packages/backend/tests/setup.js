// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock database module
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  },
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock Redis client
jest.mock('../src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn()
}));

// Mock logger for tests
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logSecurityEvent: jest.fn(),
  logAPIRequest: jest.fn(),
  logDatabaseQuery: jest.fn(),
  logTradeExecution: jest.fn(),
  logUserAction: jest.fn()
}));

// Mock external services
jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test_message_sid' })
    }
  }))
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test_message_id' })
  })
}));

// Global test timeout
jest.setTimeout(30000);

// Clean up function to run after each test
afterEach(() => {
  jest.clearAllMocks();
});