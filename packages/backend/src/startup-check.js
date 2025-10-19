#!/usr/bin/env node

/**
 * Startup Diagnostics Script
 * Run this to check if all required environment variables and connections are working
 */

const dotenv = require('dotenv');
dotenv.config();

console.log('========================================');
console.log('CEX Backend Startup Diagnostics');
console.log('========================================\n');

// Check Node version
console.log('✓ Node.js version:', process.version);
console.log('✓ Environment:', process.env.NODE_ENV || 'development');
console.log();

// Check required environment variables
console.log('Checking environment variables:');
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'PORT'
];

const optionalEnvVars = [
  'FRONTEND_URL',
  'TWILIO_ACCOUNT_SID',
  'SENDGRID_API_KEY',
  'GOOGLE_CLIENT_ID',
  'ETHEREUM_RPC_URL',
  'MASTER_SEED_MNEMONIC'
];

let missingRequired = [];

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    // Mask sensitive values
    const value = process.env[varName];
    const masked = varName.includes('SECRET') || varName.includes('PASSWORD') || varName.includes('KEY')
      ? '***' + value.slice(-4)
      : value.length > 50
      ? value.slice(0, 30) + '...' + value.slice(-10)
      : value;
    console.log(`  ✓ ${varName}: ${masked}`);
  } else {
    console.log(`  ✗ ${varName}: MISSING`);
    missingRequired.push(varName);
  }
});

console.log('\nOptional environment variables:');
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✓ ${varName}: SET`);
  } else {
    console.log(`  - ${varName}: not set`);
  }
});

if (missingRequired.length > 0) {
  console.log('\n❌ CRITICAL: Missing required environment variables:');
  console.log('  ', missingRequired.join(', '));
  console.log('\nApplication cannot start without these variables.');
  process.exit(1);
}

console.log('\n✓ All required environment variables are set\n');

// Test Database Connection
console.log('Testing database connection...');
(async () => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const result = await pool.query('SELECT NOW()');
    console.log('  ✓ Database connected successfully');
    console.log('  ✓ Server time:', result.rows[0].now);
    await pool.end();
  } catch (err) {
    console.log('  ✗ Database connection failed:');
    console.log('    Error:', err.message);
    if (err.code) console.log('    Code:', err.code);
    process.exit(1);
  }

  // Test Redis Connection
  console.log('\nTesting Redis connection...');
  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: false // Don't retry for this test
      }
    });

    client.on('error', (err) => {
      console.log('  ✗ Redis connection error:', err.message);
    });

    await client.connect();
    await client.ping();
    console.log('  ✓ Redis connected successfully');
    await client.quit();
  } catch (err) {
    console.log('  ✗ Redis connection failed:');
    console.log('    Error:', err.message);
    if (err.code) console.log('    Code:', err.code);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('✓ ALL CHECKS PASSED');
  console.log('========================================');
  console.log('\nYour environment is ready to start the application.');
  console.log('Run: npm start');
  process.exit(0);
})();
