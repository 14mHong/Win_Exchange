/**
 * Test Script: Verify SegWit Address Generation
 *
 * This script tests that BTC and LTC addresses are being generated
 * in Native SegWit (bech32) format instead of legacy P2PKH.
 */

const CryptoWalletService = require('../src/services/CryptoWalletService');
const logger = require('../src/config/logger');

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function testAddressGeneration() {
  console.log('\n' + '='.repeat(70));
  console.log('  Native SegWit (Bech32) Address Generation Test');
  console.log('='.repeat(70) + '\n');

  const testCases = [
    {
      currency: 'BTC',
      userId: 1,
      expectedPrefix: 'bc1',
      expectedFormat: 'P2WPKH (Native SegWit)',
      description: 'Bitcoin Mainnet SegWit'
    },
    {
      currency: 'LTC',
      userId: 1,
      expectedPrefix: 'ltc1',
      expectedFormat: 'P2WPKH (Native SegWit)',
      description: 'Litecoin Mainnet SegWit'
    },
    {
      currency: 'BTC',
      userId: 100,
      expectedPrefix: 'bc1',
      expectedFormat: 'P2WPKH (Native SegWit)',
      description: 'Bitcoin with different user ID'
    },
    {
      currency: 'LTC',
      userId: 100,
      expectedPrefix: 'ltc1',
      expectedFormat: 'P2WPKH (Native SegWit)',
      description: 'Litecoin with different user ID'
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of testCases) {
    try {
      // Generate address
      const addressData = CryptoWalletService.generateDepositAddress(
        test.userId,
        test.currency
      );

      const address = addressData.address;
      const prefix = address.substring(0, test.expectedPrefix.length);
      const isCorrectFormat = prefix === test.expectedPrefix;

      // Display result
      console.log(`${colors.cyan}Test:${colors.reset} ${test.description}`);
      console.log(`  Currency: ${test.currency}`);
      console.log(`  User ID: ${test.userId}`);
      console.log(`  Address: ${address}`);
      console.log(`  Derivation: ${addressData.derivationPath}`);
      console.log(`  Network: ${addressData.network}`);
      console.log(`  Expected: ${test.expectedPrefix}...`);
      console.log(`  Actual Prefix: ${prefix}`);

      if (isCorrectFormat) {
        console.log(`  ${colors.green}✓ PASSED${colors.reset} - Correct SegWit format\n`);
        passedTests++;
      } else {
        console.log(`  ${colors.red}✗ FAILED${colors.reset} - Wrong format (expected ${test.expectedPrefix}...)\n`);
        failedTests++;
      }

      // Additional validations
      validateAddressProperties(address, test.currency);

    } catch (error) {
      console.log(`  ${colors.red}✗ ERROR${colors.reset} - ${error.message}\n`);
      failedTests++;
    }
  }

  // Summary
  console.log('='.repeat(70));
  console.log('Test Summary:');
  console.log(`  ${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`  Total: ${testCases.length}`);
  console.log('='.repeat(70) + '\n');

  // Exit with appropriate code
  if (failedTests > 0) {
    console.log(`${colors.red}⚠️  TESTS FAILED${colors.reset}`);
    console.log('Please check the code changes in CryptoWalletService.js\n');
    process.exit(1);
  } else {
    console.log(`${colors.green}✓ ALL TESTS PASSED${colors.reset}`);
    console.log('SegWit address generation is working correctly!\n');
    process.exit(0);
  }
}

function validateAddressProperties(address, currency) {
  const properties = [];

  // Check length (bech32 addresses are typically 42-62 characters)
  if (address.length >= 42 && address.length <= 62) {
    properties.push(`${colors.green}✓${colors.reset} Valid length (${address.length} chars)`);
  } else {
    properties.push(`${colors.yellow}⚠${colors.reset} Unusual length (${address.length} chars)`);
  }

  // Check character set (bech32 uses lowercase a-z and 0-9, no uppercase)
  const hasUppercase = /[A-Z]/.test(address);
  if (!hasUppercase) {
    properties.push(`${colors.green}✓${colors.reset} Lowercase only (bech32 standard)`);
  } else {
    properties.push(`${colors.red}✗${colors.reset} Contains uppercase (invalid bech32)`);
  }

  // Check for invalid bech32 characters
  const invalidChars = /[^a-z0-9]/.test(address);
  if (!invalidChars) {
    properties.push(`${colors.green}✓${colors.reset} Valid character set`);
  } else {
    properties.push(`${colors.red}✗${colors.reset} Invalid characters found`);
  }

  console.log('  Properties:');
  properties.forEach(prop => console.log(`    ${prop}`));
}

// Additional test: Address validation
function testAddressValidation() {
  console.log('\n' + '='.repeat(70));
  console.log('  Address Validation Test');
  console.log('='.repeat(70) + '\n');

  const validationTests = [
    { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', currency: 'BTC', shouldBeValid: true },
    { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', currency: 'BTC', shouldBeValid: true }, // Legacy also valid
    { address: 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kgmn4n9', currency: 'LTC', shouldBeValid: true },
    { address: 'LbXt9mKq7Jk3TmkQN7vmYfYQ6K6xCWDh5g', currency: 'LTC', shouldBeValid: true }, // Legacy also valid
    { address: 'invalid_address_123', currency: 'BTC', shouldBeValid: false },
  ];

  validationTests.forEach(test => {
    const isValid = CryptoWalletService.validateAddress(test.address, test.currency);
    const status = isValid === test.shouldBeValid
      ? `${colors.green}✓ PASS${colors.reset}`
      : `${colors.red}✗ FAIL${colors.reset}`;

    console.log(`${status} - ${test.currency}: ${test.address.substring(0, 20)}...`);
    console.log(`  Expected: ${test.shouldBeValid ? 'Valid' : 'Invalid'}`);
    console.log(`  Got: ${isValid ? 'Valid' : 'Invalid'}\n`);
  });
}

// Run tests
try {
  testAddressGeneration();
  testAddressValidation();
} catch (error) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
}
