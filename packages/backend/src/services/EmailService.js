const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new EmailService();
    }
    return this.instance;
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@yourexchange.com',
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email sending failed', {
        to,
        subject,
        error: error.message,
        code: error.code,
        response: error.response,
        responseCode: error.responseCode,
        command: error.command
      });
      // Throw the original error with more context
      const enhancedError = new Error(`Failed to send email: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.emailTo = to;
      throw enhancedError;
    }
  }

  static async sendVerificationEmail(email, code) {
    const service = this.getInstance();
    
    const subject = 'Verify Your Email - Win Exchange';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .code { font-size: 24px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; background: white; border: 2px dashed #2563eb; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Win Exchange</h1>
            <p>Email Verification Required</p>
          </div>
          <div class="content">
            <h2>Welcome to Win Exchange!</h2>
            <p>Thank you for registering with us. To complete your account setup, please verify your email address using the verification code below:</p>
            <div class="code">${code}</div>
            <p>This verification code will expire in 15 minutes.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Win Exchange. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Win Exchange - Email Verification
      
      Welcome to Win Exchange!
      
      Your verification code is: ${code}
      
      This code will expire in 15 minutes.
      
      If you didn't create an account with us, please ignore this email.
    `;

    return await service.sendEmail({ to: email, subject, html, text });
  }

  static async sendPasswordResetEmail(email, code) {
    const service = this.getInstance();
    
    const subject = 'Password Reset - Win Exchange';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .code { font-size: 24px; font-weight: bold; color: #dc2626; text-align: center; padding: 20px; background: white; border: 2px dashed #dc2626; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Win Exchange</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <h2>Password Reset Code</h2>
            <p>We received a request to reset your password. Use the verification code below to reset your password:</p>
            <div class="code">${code}</div>
            <div class="warning">
              <strong>Security Notice:</strong>
              <ul>
                <li>This code will expire in 30 minutes</li>
                <li>Never share this code with anyone</li>
                <li>If you didn't request this reset, please secure your account immediately</li>
              </ul>
            </div>
            <p>If you didn't request a password reset, please ignore this email and consider changing your password as a precaution.</p>
          </div>
          <div class="footer">
            <p>© 2024 Win Exchange. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Win Exchange - Password Reset
      
      We received a request to reset your password.
      
      Your password reset code is: ${code}
      
      This code will expire in 30 minutes.
      
      If you didn't request this reset, please ignore this email.
    `;

    return await service.sendEmail({ to: email, subject, html, text });
  }

  static async sendSecurityAlert(email, details) {
    const service = this.getInstance();
    
    const subject = 'Security Alert - Win Exchange';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .alert { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Win Exchange</h1>
            <p>Security Alert</p>
          </div>
          <div class="content">
            <div class="alert">
              <h2>Important Security Notice</h2>
              <p><strong>Event:</strong> ${details.event}</p>
              <p><strong>Time:</strong> ${details.timestamp}</p>
              <p><strong>IP Address:</strong> ${details.ipAddress}</p>
              <p><strong>Location:</strong> ${details.location || 'Unknown'}</p>
            </div>
            <p>If this was you, no action is required. If this wasn't you, please:</p>
            <ul>
              <li>Change your password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Review your account activity</li>
              <li>Contact support if you notice any unauthorized activity</li>
            </ul>
          </div>
          <div class="footer">
            <p>© 2024 Win Exchange. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Win Exchange - Security Alert
      
      Event: ${details.event}
      Time: ${details.timestamp}
      IP Address: ${details.ipAddress}
      
      If this wasn't you, please secure your account immediately.
    `;

    return await service.sendEmail({ to: email, subject, html, text });
  }

  static async sendWelcomeEmail(email, userName) {
    const service = this.getInstance();
    
    const subject = 'Welcome to Win Exchange!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Win Exchange</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .features { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Win Exchange!</h1>
            <p>Your trading journey starts here</p>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'Trader'}!</h2>
            <p>Welcome to Win Exchange - the secure and reliable cryptocurrency exchange platform.</p>
            
            <div class="features">
              <h3>Getting Started:</h3>
              <ul>
                <li>🔐 Enable two-factor authentication</li>
                <li>💰 Fund your account to start trading</li>
                <li>📈 Explore our trading pairs</li>
              </ul>
            </div>
            
            <p>Need help? Our support team is available 24/7 to assist you.</p>
          </div>
          <div class="footer">
            <p>© 2024 Win Exchange. All rights reserved.</p>
            <p>Happy trading!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Win Exchange!

      Hello ${userName || 'Trader'}!

      Welcome to Win Exchange - the secure and reliable cryptocurrency exchange platform.

      Getting Started:
      - Enable two-factor authentication
      - Fund your account to start trading
      - Explore our trading pairs
      
      Need help? Our support team is available 24/7.
    `;

    return await service.sendEmail({ to: email, subject, html, text });
  }
}

module.exports = EmailService;