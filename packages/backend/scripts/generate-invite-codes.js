/**
 * Generate Invite Codes Script
 *
 * Usage:
 *   node scripts/generate-invite-codes.js <count>
 *   node scripts/generate-invite-codes.js 10  # Generate 10 codes
 */

const InviteCode = require('../src/models/InviteCode');
const logger = require('../src/config/logger');

async function generateCodes(count = 1) {
  try {
    console.log(`\nGenerating ${count} invite code(s)...\n`);
    console.log('=' .repeat(70));

    const codes = [];
    for (let i = 0; i < count; i++) {
      const inviteCode = await InviteCode.generate({
        createdBy: null, // Can be set to admin user ID
        expiresAt: null, // No expiration
        maxUses: 1,      // One-time use
        notes: `Generated via script on ${new Date().toISOString()}`
      });

      codes.push(inviteCode.code);
      console.log(`✓ ${inviteCode.code}`);
    }

    console.log('='.repeat(70));
    console.log(`\n✅ Successfully generated ${codes.length} invite code(s)!\n`);
    console.log('Users can register at: https://your-exchange.com/register\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating invite codes:', error.message);
    process.exit(1);
  }
}

// Get count from command line arguments
const count = parseInt(process.argv[2]) || 1;

if (count < 1 || count > 100) {
  console.error('❌ Count must be between 1 and 100');
  process.exit(1);
}

generateCodes(count);
