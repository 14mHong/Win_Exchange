// Load .env from root directory
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const nodemailer = require('nodemailer');

// Test email configuration
async function testEmail() {
  console.log('🔍 Testing SendGrid Email Configuration...\n');

  // Display current configuration
  console.log('Configuration:');
  console.log('- SMTP Host:', process.env.SMTP_HOST || 'smtp.sendgrid.net');
  console.log('- SMTP User:', process.env.SMTP_USER || 'apikey');
  console.log('- SendGrid API Key:', process.env.SENDGRID_API_KEY ? '***' + process.env.SENDGRID_API_KEY.slice(-4) : 'NOT SET');
  console.log('- From Email:', process.env.FROM_EMAIL || 'NOT SET');
  console.log('');

  // Check if required vars are set
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY is not set in .env file');
    process.exit(1);
  }

  if (!process.env.FROM_EMAIL) {
    console.error('❌ FROM_EMAIL is not set in .env file');
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  });

  // Verify connection
  console.log('🔌 Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }

  // Get test email from command line or use FROM_EMAIL
  const testEmail = process.argv[2] || process.env.FROM_EMAIL;

  console.log(`📧 Sending test email to: ${testEmail}\n`);

  // Send test email
  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: testEmail,
      subject: '✅ Win Exchange - Email Test Successful',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px; background: #f9f9f9; margin-top: 20px; border-radius: 5px; }
            .success { color: #059669; font-size: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Email Test Successful!</h1>
            </div>
            <div class="content">
              <p class="success">✅ Your SendGrid email service is working correctly!</p>
              <p>This test email confirms that:</p>
              <ul>
                <li>SendGrid API key is valid</li>
                <li>SMTP connection is working</li>
                <li>From email (${process.env.FROM_EMAIL}) is verified</li>
                <li>Email delivery is functional</li>
              </ul>
              <p>You can now use the registration system with confidence.</p>
              <hr>
              <p><small>Test conducted at: ${new Date().toISOString()}</small></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ✅ Email Test Successful!

        Your SendGrid email service is working correctly!

        This confirms:
        - SendGrid API key is valid
        - SMTP connection is working
        - From email (${process.env.FROM_EMAIL}) is verified
        - Email delivery is functional

        Test conducted at: ${new Date().toISOString()}
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('\n🎉 Email service is working correctly!\n');

  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    console.error('\nFull error details:');
    console.error('- Code:', error.code);
    console.error('- Response:', error.response);
    console.error('- Command:', error.command);
    console.error('\nCommon issues:');
    console.error('1. FROM_EMAIL not verified in SendGrid');
    console.error('2. SendGrid API key is invalid or expired');
    console.error('3. Domain not authenticated in SendGrid');
    console.error('4. SendGrid account suspended or limited');
    process.exit(1);
  }
}

// Run the test
testEmail().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
