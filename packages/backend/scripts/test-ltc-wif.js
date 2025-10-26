/**
 * Diagnostic script to verify Litecoin WIF generation is working correctly
 * Run this on production to verify the fix is deployed
 */

require('dotenv').config();
const CryptoWalletService = require('../src/services/CryptoWalletService');

try {
  console.log('=== Litecoin WIF Generation Test ===\n');

  // Initialize wallet service with master seed from env
  if (!process.env.MASTER_SEED_MNEMONIC) {
    console.error('❌ ERROR: MASTER_SEED_MNEMONIC not set in environment');
    process.exit(1);
  }

  const walletService = new CryptoWalletService(process.env.MASTER_SEED_MNEMONIC);

  // Test LTC wallet generation for a test user
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const ltcWallet = walletService.deriveUserWallet(testUserId, 'LTC', 0);

  console.log('Generated Litecoin Wallet:');
  console.log('Address:', ltcWallet.address);
  console.log('Private Key:', ltcWallet.privateKey);
  console.log('');

  // Check the first character
  const firstChar = ltcWallet.privateKey.charAt(0);
  console.log('Private Key First Character:', firstChar);
  console.log('');

  // Determine if correct
  if (firstChar === 'T' || firstChar === '6') {
    console.log('✅ SUCCESS: Private key has correct Litecoin WIF format!');
    console.log('   Private keys starting with T or 6 are valid Litecoin WIF format.');
    console.log('   Users can import this into Litecoin wallets.');
  } else if (firstChar === 'K' || firstChar === 'L' || firstChar === '5') {
    console.log('❌ FAILED: Private key is using Bitcoin WIF format!');
    console.log('   Private keys starting with K, L, or 5 are Bitcoin WIF format.');
    console.log('   This will NOT work with Litecoin wallets.');
    console.log('');
    console.log('   The fix has NOT been deployed yet.');
    console.log('   Please ensure the latest code is deployed to production.');
  } else {
    console.log('⚠️  UNKNOWN: Private key format is unexpected.');
    console.log('   First character should be T, 6, K, L, or 5');
  }

  console.log('\n=== Test Complete ===');

} catch (error) {
  console.error('❌ Error running test:', error.message);
  process.exit(1);
}
