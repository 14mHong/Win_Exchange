#!/usr/bin/env node

/**
 * Master Seed Generator
 *
 * Generates a BIP39 mnemonic phrase (24 words) for HD wallet master seed.
 *
 * ⚠️ WARNING: Run this ONCE and store the output SECURELY!
 *
 * Usage:
 *   node scripts/generate-master-seed.js
 */

const bip39 = require('bip39');
const crypto = require('crypto');

console.log('\n=================================================');
console.log('        HD WALLET MASTER SEED GENERATOR');
console.log('=================================================\n');

console.log('⚠️  CRITICAL SECURITY WARNING ⚠️\n');
console.log('1. Run this script ONLY ONCE');
console.log('2. Store the seed in a SECURE location');
console.log('3. NEVER commit the seed to git');
console.log('4. NEVER share the seed with anyone');
console.log('5. Consider using HSM/KMS in production\n');

console.log('Generating master seed...\n');

// Generate 256-bit entropy (24 words)
const mnemonic = bip39.generateMnemonic(256);

// Validate
if (!bip39.validateMnemonic(mnemonic)) {
  console.error('❌ Error: Generated invalid mnemonic!');
  process.exit(1);
}

console.log('✅ Master seed generated successfully!\n');
console.log('=================================================');
console.log('            YOUR MASTER SEED (24 WORDS)');
console.log('=================================================\n');

// Print with word numbers for easy verification
const words = mnemonic.split(' ');
words.forEach((word, index) => {
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${word}`);
});

console.log('\n=================================================\n');

// Generate encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('💾 Save to .env file:\n');
console.log('MASTER_SEED_MNEMONIC="' + mnemonic + '"\n');

console.log('=================================================');
console.log('   OPTIONAL: ENCRYPTION KEY (for encrypting seed)');
console.log('=================================================\n');
console.log('MASTER_SEED_ENCRYPTION_KEY=' + encryptionKey + '\n');

// Test derivation
console.log('=================================================');
console.log('             TEST DERIVATION');
console.log('=================================================\n');

const CryptoWalletService = require('../src/services/CryptoWalletService');

// Temporarily set master seed
const originalSeed = process.env.MASTER_SEED_MNEMONIC;
process.env.MASTER_SEED_MNEMONIC = mnemonic;

try {
  const testWallet = CryptoWalletService.deriveUserWallet(1, 'ETH');
  console.log('Test ETH address for user 1:');
  console.log(testWallet.address);
  console.log('\nDerivation path:', testWallet.derivationPath);
  console.log('\n✅ Derivation test passed!\n');
} catch (error) {
  console.error('❌ Derivation test failed:', error.message);
}

// Restore original
process.env.MASTER_SEED_MNEMONIC = originalSeed;

console.log('=================================================');
console.log('              NEXT STEPS');
console.log('=================================================\n');

console.log('1. Copy the master seed to your .env file');
console.log('2. BACKUP the seed in multiple secure locations');
console.log('3. Test with testnet first');
console.log('4. In production, use HSM/KMS for storage\n');

console.log('⚠️  REMEMBER: Losing this seed = losing ALL funds!\n');
