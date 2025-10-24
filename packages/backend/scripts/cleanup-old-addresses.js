/**
 * Cleanup Old Legacy Addresses Script
 *
 * This script removes old P2PKH (legacy) addresses from the database
 * and replaces them with new Native SegWit addresses.
 *
 * Run this AFTER deploying SegWit code to production.
 */

const { pool, query } = require('../src/config/database');
const logger = require('../src/config/logger');

async function cleanupOldAddresses() {
  let client;

  try {
    console.log('\n' + '='.repeat(70));
    console.log('  Legacy Address Cleanup Script');
    console.log('='.repeat(70) + '\n');

    // Connect to database
    client = await pool.connect();

    // Step 1: Check current state
    console.log('📊 Step 1: Analyzing current addresses...\n');

    const analysis = await client.query(`
      SELECT
        currency,
        COUNT(*) as total_addresses,
        COUNT(CASE WHEN currency = 'BTC' AND address LIKE '1%' THEN 1 END) as btc_legacy,
        COUNT(CASE WHEN currency = 'BTC' AND address LIKE 'bc1%' THEN 1 END) as btc_segwit,
        COUNT(CASE WHEN currency = 'LTC' AND address LIKE 'L%' THEN 1 END) as ltc_legacy_correct,
        COUNT(CASE WHEN currency = 'LTC' AND address LIKE '1%' THEN 1 END) as ltc_legacy_wrong,
        COUNT(CASE WHEN currency = 'LTC' AND address LIKE 'ltc1%' THEN 1 END) as ltc_segwit
      FROM deposit_addresses
      WHERE currency IN ('BTC', 'LTC')
      GROUP BY currency
    `);

    if (analysis.rows.length === 0) {
      console.log('✅ No BTC or LTC addresses found in database.');
      console.log('   This is normal for a new deployment.\n');
      return;
    }

    console.log('Current Address Distribution:');
    console.log('-'.repeat(70));
    analysis.rows.forEach(row => {
      console.log(`\n${row.currency}:`);
      console.log(`  Total: ${row.total_addresses}`);
      if (row.currency === 'BTC') {
        console.log(`  Legacy (1...): ${row.btc_legacy}`);
        console.log(`  SegWit (bc1...): ${row.btc_segwit}`);
      } else if (row.currency === 'LTC') {
        console.log(`  Legacy Correct (L...): ${row.ltc_legacy_correct}`);
        console.log(`  Legacy Wrong (1...): ${row.ltc_legacy_wrong}`);
        console.log(`  SegWit (ltc1...): ${row.ltc_segwit}`);
      }
    });
    console.log();

    // Step 2: Show addresses to be deleted
    console.log('\n📋 Step 2: Addresses to be deleted...\n');

    const toDelete = await client.query(`
      SELECT
        id,
        user_id,
        currency,
        address,
        created_at
      FROM deposit_addresses
      WHERE (currency = 'BTC' AND address LIKE '1%')
         OR (currency = 'LTC' AND (address LIKE 'L%' OR address LIKE '1%'))
      ORDER BY currency, user_id
    `);

    if (toDelete.rows.length === 0) {
      console.log('✅ No legacy addresses found! All addresses are already SegWit format.\n');
      return;
    }

    console.log(`Found ${toDelete.rows.length} legacy addresses to delete:\n`);

    // Group by currency
    const btcAddresses = toDelete.rows.filter(r => r.currency === 'BTC');
    const ltcAddresses = toDelete.rows.filter(r => r.currency === 'LTC');

    if (btcAddresses.length > 0) {
      console.log(`BTC (${btcAddresses.length} addresses):`);
      btcAddresses.forEach((addr, i) => {
        console.log(`  ${i + 1}. User ${addr.user_id}: ${addr.address}`);
      });
      console.log();
    }

    if (ltcAddresses.length > 0) {
      console.log(`LTC (${ltcAddresses.length} addresses):`);
      ltcAddresses.forEach((addr, i) => {
        console.log(`  ${i + 1}. User ${addr.user_id}: ${addr.address}`);
      });
      console.log();
    }

    // Step 3: Check for associated UTXOs
    console.log('\n🔍 Step 3: Checking for deposits to legacy addresses...\n');

    const utxoCheck = await client.query(`
      SELECT
        da.currency,
        da.address,
        COUNT(u.id) as utxo_count,
        SUM(u.amount_satoshi) as total_satoshi,
        SUM(u.amount) as total_amount
      FROM deposit_addresses da
      LEFT JOIN utxos u ON da.address = u.address AND da.currency = u.currency
      WHERE (da.currency = 'BTC' AND da.address LIKE '1%')
         OR (da.currency = 'LTC' AND (da.address LIKE 'L%' OR da.address LIKE '1%'))
      GROUP BY da.currency, da.address
      HAVING COUNT(u.id) > 0
      ORDER BY total_satoshi DESC
    `);

    if (utxoCheck.rows.length > 0) {
      console.log('⚠️  WARNING: Found deposits to legacy addresses!\n');
      console.log('Addresses with deposits:');
      utxoCheck.rows.forEach(row => {
        console.log(`  ${row.currency}: ${row.address}`);
        console.log(`    UTXOs: ${row.utxo_count}`);
        console.log(`    Amount: ${row.total_amount} ${row.currency} (${row.total_satoshi} satoshi)`);
      });
      console.log();
      console.log('⚠️  RECOMMENDATION: Do NOT delete these addresses yet!');
      console.log('   Users have deposited funds to these addresses.');
      console.log('   You should:');
      console.log('   1. Keep both legacy and SegWit addresses temporarily');
      console.log('   2. Or sweep funds to new SegWit addresses first');
      console.log('   3. Then run this script again\n');

      // Ask for confirmation
      console.log('⚠️  Exiting without deleting to protect user funds.\n');
      return;
    } else {
      console.log('✅ No deposits found to legacy addresses. Safe to delete.\n');
    }

    // Step 4: Delete legacy addresses
    console.log('\n🗑️  Step 4: Deleting legacy addresses...\n');

    const deleteResult = await client.query(`
      DELETE FROM deposit_addresses
      WHERE (currency = 'BTC' AND address LIKE '1%')
         OR (currency = 'LTC' AND (address LIKE 'L%' OR address LIKE '1%'))
      RETURNING currency, address
    `);

    console.log(`✅ Deleted ${deleteResult.rows.length} legacy addresses:\n`);

    const deletedBTC = deleteResult.rows.filter(r => r.currency === 'BTC').length;
    const deletedLTC = deleteResult.rows.filter(r => r.currency === 'LTC').length;

    console.log(`  BTC: ${deletedBTC} addresses deleted`);
    console.log(`  LTC: ${deletedLTC} addresses deleted\n`);

    // Step 5: Verify cleanup
    console.log('\n✅ Step 5: Verifying cleanup...\n');

    const verification = await client.query(`
      SELECT
        currency,
        COUNT(*) as total_addresses,
        COUNT(CASE WHEN currency = 'BTC' AND address LIKE '1%' THEN 1 END) as btc_legacy,
        COUNT(CASE WHEN currency = 'BTC' AND address LIKE 'bc1%' THEN 1 END) as btc_segwit,
        COUNT(CASE WHEN currency = 'LTC' AND (address LIKE 'L%' OR address LIKE '1%') THEN 1 END) as ltc_legacy,
        COUNT(CASE WHEN currency = 'LTC' AND address LIKE 'ltc1%' THEN 1 END) as ltc_segwit
      FROM deposit_addresses
      WHERE currency IN ('BTC', 'LTC')
      GROUP BY currency
    `);

    console.log('Final Address Distribution:');
    console.log('-'.repeat(70));

    if (verification.rows.length === 0) {
      console.log('\nNo BTC or LTC addresses remaining in database.');
      console.log('New addresses will be generated as SegWit format on first request.\n');
    } else {
      verification.rows.forEach(row => {
        console.log(`\n${row.currency}:`);
        console.log(`  Total: ${row.total_addresses}`);
        if (row.currency === 'BTC') {
          console.log(`  Legacy (1...): ${row.btc_legacy} ${row.btc_legacy === '0' ? '✅' : '⚠️'}`);
          console.log(`  SegWit (bc1...): ${row.btc_segwit}`);
        } else if (row.currency === 'LTC') {
          console.log(`  Legacy (L.../1...): ${row.ltc_legacy} ${row.ltc_legacy === '0' ? '✅' : '⚠️'}`);
          console.log(`  SegWit (ltc1...): ${row.ltc_segwit}`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Test generating new BTC address → should start with bc1');
    console.log('2. Test generating new LTC address → should start with ltc1');
    console.log('3. Verify in backend logs that addresses are SegWit format');
    console.log('4. Monitor first deposits to ensure detection works\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the cleanup
cleanupOldAddresses()
  .then(() => {
    console.log('Script completed successfully.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
