/**
 * Script to regenerate Litecoin private keys with correct WIF encoding
 *
 * Problem: LTC private keys were generated with Bitcoin's WIF prefix (0x80)
 * instead of Litecoin's (0xb0), causing import failures.
 *
 * Solution: Regenerate all LTC deposit addresses with correct WIF format.
 *
 * IMPORTANT: Run this AFTER deploying the CryptoWalletService fix
 */

require('dotenv').config();
const { query, getClient } = require('../src/config/database');
const logger = require('../src/config/logger');
const CryptoWalletService = require('../src/services/CryptoWalletService');

async function regenerateLTCPrivateKeys() {
  const client = await getClient();

  try {
    logger.info('=== Starting LTC Private Key Regeneration ===');

    await client.query('BEGIN');

    // Get all users with LTC deposit addresses
    const addressesResult = await client.query(`
      SELECT id, user_id, currency, address, private_key, derivation_path, created_at
      FROM deposit_addresses
      WHERE currency = 'LTC'
      ORDER BY user_id, created_at
    `);

    const addresses = addressesResult.rows;

    if (addresses.length === 0) {
      logger.info('No LTC addresses found. Nothing to fix.');
      await client.query('COMMIT');
      return;
    }

    logger.info(`Found ${addresses.length} LTC addresses to regenerate`);

    // Initialize wallet service
    const walletService = new CryptoWalletService(process.env.MASTER_SEED);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const addr of addresses) {
      try {
        // Extract derivation index from path (e.g., "m/84'/2'/0'/0/5" -> 5)
        const pathParts = addr.derivation_path.split('/');
        const index = parseInt(pathParts[pathParts.length - 1]);

        // Regenerate wallet with correct network parameters
        const newWallet = walletService.deriveUserWallet(addr.user_id, 'LTC', index);

        // Verify the address matches (it should!)
        if (newWallet.address !== addr.address) {
          throw new Error(`Address mismatch! Expected: ${addr.address}, Got: ${newWallet.address}`);
        }

        // Check if private key changed (it should for all of them)
        const privateKeyChanged = newWallet.privateKey !== addr.private_key;
        const oldKeyPrefix = addr.private_key ? addr.private_key.charAt(0) : 'N/A';
        const newKeyPrefix = newWallet.privateKey.charAt(0);

        logger.info(`User ${addr.user_id}: ${oldKeyPrefix} -> ${newKeyPrefix} ${privateKeyChanged ? '(FIXED)' : '(same)'}`);

        // Update the private key in database
        await client.query(`
          UPDATE deposit_addresses
          SET
            private_key = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newWallet.privateKey, addr.id]);

        successCount++;

      } catch (error) {
        errorCount++;
        errors.push({
          userId: addr.user_id,
          address: addr.address,
          error: error.message
        });
        logger.error(`Failed to regenerate for user ${addr.user_id}:`, error.message);
      }
    }

    await client.query('COMMIT');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('REGENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total addresses: ${addresses.length}`);
    console.log(`Successfully regenerated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  User ${err.userId} (${err.address}): ${err.error}`);
      });
    }

    console.log('\nAll Litecoin private keys have been regenerated with correct WIF format!');
    console.log('   - Old format: Started with K, L, or 5 (Bitcoin WIF prefix 0x80)');
    console.log('   - New format: Starts with T or 6 (Litecoin WIF prefix 0xb0)');
    console.log('\nUsers can now successfully import their LTC private keys into wallets.');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Fatal error in regeneration script:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
regenerateLTCPrivateKeys()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
