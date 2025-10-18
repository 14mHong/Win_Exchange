const twilio = require('twilio');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new SMSService();
    }
    return this.instance;
  }

  async sendSMS({ to, message }) {
    try {
      if (!this.client || !this.fromNumber) {
        logger.warn('Twilio not configured, simulating SMS send', { to, message });
        return { success: true, messageId: 'simulated-' + Date.now() };
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      logger.info('SMS sent successfully', { 
        to, 
        messageId: result.sid,
        status: result.status 
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      logger.error('SMS sending failed', { to, error: error.message });
      throw new Error('Failed to send SMS');
    }
  }

  static async sendVerificationSMS(phoneNumber, code) {
    const service = this.getInstance();

    const message = `Your Win Exchange verification code is: ${code}. This code will expire in 15 minutes. Do not share this code with anyone.`;

    return await service.sendSMS({
      to: phoneNumber,
      message
    });
  }

  static async sendSecurityAlert(phoneNumber, details) {
    const service = this.getInstance();

    const message = `Win Exchange Security Alert: ${details.event} detected from IP ${details.ipAddress} at ${details.timestamp}. If this wasn't you, secure your account immediately.`;

    return await service.sendSMS({
      to: phoneNumber,
      message
    });
  }

  static async sendLoginNotification(phoneNumber, details) {
    const service = this.getInstance();

    const message = `Win Exchange: New login detected from ${details.location || 'unknown location'} at ${details.timestamp}. If this wasn't you, contact support immediately.`;

    return await service.sendSMS({
      to: phoneNumber,
      message
    });
  }

  static async sendWithdrawalNotification(phoneNumber, details) {
    const service = this.getInstance();

    const message = `Win Exchange: Withdrawal of ${details.amount} ${details.currency} initiated. Transaction ID: ${details.txId}. If you didn't initiate this, contact support immediately.`;

    return await service.sendSMS({
      to: phoneNumber,
      message
    });
  }

  static async send2FABackupCode(phoneNumber, codes) {
    const service = this.getInstance();

    const message = `Win Exchange: Your 2FA backup codes: ${codes.join(', ')}. Store these safely - they can be used once each if you lose access to your authenticator.`;

    return await service.sendSMS({
      to: phoneNumber,
      message
    });
  }

  static formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming US +1 for this example)
    if (cleaned.length === 10) {
      return '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return '+' + cleaned;
    } else {
      return '+' + cleaned;
    }
  }

  static validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }
}

module.exports = SMSService;