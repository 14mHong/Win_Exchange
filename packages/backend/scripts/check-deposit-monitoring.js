#!/usr/bin/env node

/**
 * Diagnostic script to check deposit monitoring status
 * Run with: node scripts/check-deposit-monitoring.js
 */

const logger = require('../src/config/logger');
const { query } = require('../src/config/database');

async function checkMonitoringStatus() {
  console.log('\n=== DEPOSIT MONITORING DIAGNOSTIC ===\n');

  // 1. Check environment configuration
  console.log('1. Environment Configuration:');
  console.log('   ETHEREUM_RPC_URL:', process.env.ETHEREUM_RPC_URL ? '✓ Set' : '✗ NOT SET');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('');

  // 2. Check USDC deposit addresses
  console.log('2. USDC Deposit Addresses:');
  try {
    const addresses = await query(
      `SELECT id, user_id, address, network, created_at 
       FROM deposit_addresses 
       WHERE currency = 'USDC' 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    if (addresses.rows.length === 0) {
      console.log('   ✗ No USDC addresses found');
    } else {
      console.log(`   ✓ Found ${addresses.rows.length} USDC address(es):`);
      addresses.rows.forEach((addr, i) => {
        console.log(`   ${i + 1}. Address: ${addr.address}`);
        console.log(`      Network: ${addr.network}`);
        console.log(`      User ID: ${addr.user_id}`);
        console.log(`      Created: ${addr.created_at}`);
        console.log('');
      });
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }

  // 3. Check pending USDC transactions
  console.log('3. USDC Transactions:');
  try {
    const txns = await query(
      `SELECT id, user_id, type, amount, status, confirmations, tx_hash, created_at 
       FROM transactions 
       WHERE currency = 'USDC' 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    if (txns.rows.length === 0) {
      console.log('   No USDC transactions yet');
    } else {
      console.log(`   Found ${txns.rows.length} USDC transaction(s):`);
      txns.rows.forEach((tx, i) => {
        console.log(`   ${i + 1}. Type: ${tx.type}, Amount: ${tx.amount}, Status: ${tx.status}`);
        console.log(`      Confirmations: ${tx.confirmations || 0}/12`);
        console.log(`      TX Hash: ${tx.tx_hash || 'N/A'}`);
        console.log(`      Created: ${tx.created_at}`);
        console.log('');
      });
    }
  } catch (error) {
    console.log('   ✗ Error:', error.message);
  }

  // 4. Check blockchain monitor service
  console.log('4. Blockchain Monitor Service:');
  try {
    const blockchainMonitor = require('../src/services/BlockchainMonitorService');
    console.log('   Service loaded:', blockchainMonitor ? '✓' : '✗');
    console.log('   Is monitoring:', blockchainMonitor.isMonitoring ? '✓ YES' : '✗ NO');
    
    if (blockchainMonitor.providers.ETH) {
      console.log('   ETH provider:', '✓ Connected');
      const blockNumber = await blockchainMonitor.providers.ETH.getBlockNumber();
      console.log('   Current block:', blockNumber);
      console.log('   Network type:', blockchainMonitor.isTestnet ? 'Testnet (Sepolia)' : 'Mainnet');
    } else {
      console.log('   ETH provider: ✗ NOT CONNECTED (check ETHEREUM_RPC_URL)');
    }
  } catch (error) {
    console.log('   ✗ Error loading service:', error.message);
  }

  console.log('\n=== END DIAGNOSTIC ===\n');
  process.exit(0);
}

checkMonitoringStatus().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
