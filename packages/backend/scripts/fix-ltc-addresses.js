/**
 * Script to fix Litecoin addresses that were incorrectly generated
 * with Bitcoin network parameters (starting with '1' instead of 'L')
 *
 * Run this AFTER deploying the LTC network fix
 */

const pool = require('../src/config/database');
const logger = require('../src/config/logger');

async function fixLTCAddresses() {
  let client;

  try {
    logger.info('Starting LTC address fix script...');

    // Connect to database
    client = await pool.connect();

    // Find all LTC deposit addresses that start with '1' (Bitcoin format)
    const query = `
      SELECT id, user_id, currency, address, derivation_path
      FROM deposit_addresses
      WHERE currency = 'LTC'
      AND address LIKE '1%'
      ORDER BY user_id
    `;

    const result = await client.query(query);

    logger.info(`Found ${result.rows.length} incorrect LTC addresses to fix`);

    if (result.rows.length === 0) {
      logger.info('No LTC addresses need fixing. All good!');
      return;
    }

    // Display the addresses that need fixing
    console.log('\n=== Incorrect LTC Addresses (Bitcoin format) ===');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. User ID: ${row.user_id}, Address: ${row.address}`);
    });

    console.log('\n⚠️  IMPORTANT INSTRUCTIONS:');
    console.log('1. These addresses were generated with Bitcoin network parameters');
    console.log('2. They start with "1" instead of "L" (correct LTC format)');
    console.log('3. You have two options:\n');

    console.log('OPTION A - DELETE OLD ADDRESSES (Recommended):');
    console.log('   DELETE FROM deposit_addresses WHERE currency = \'LTC\' AND address LIKE \'1%\';');
    console.log('   - Users will get new correct LTC addresses (starting with "L") on next request');
    console.log('   - Safe if no deposits have been made to these addresses\n');

    console.log('OPTION B - MANUAL MIGRATION:');
    console.log('   - Check if any deposits were made to these old addresses');
    console.log('   - Use private keys to sweep funds to new addresses');
    console.log('   - Then delete old addresses\n');

    console.log('To check if any deposits were made, check your blockchain monitor logs');
    console.log('or query the transactions table for these addresses.\n');

  } catch (error) {
    logger.error('Error in fix script:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the script
fixLTCAddresses()
  .then(() => {
    logger.info('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
