const twilio = require('twilio');
const logger = require('../config/logger');

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    // Only initialize Twilio client if credentials are provided
    if (this.accountSid && this.authToken && this.phoneNumber) {
      this.client = twilio(this.accountSid, this.authToken);
      this.enabled = true;
      logger.info('Twilio service initialized successfully');
    } else {
      this.enabled = false;
      logger.warn('Twilio credentials not configured. Phone verification will be disabled.');
    }
  }

  /**
   * Send SMS verification code
   */
  async sendVerificationCode(phoneNumber, code) {
    try {
      if (!this.enabled) {
        logger.warn('Twilio not configured. Skipping SMS send.');
        return {
          success: false,
          error: 'SMS service not configured'
        };
      }

      const message = await this.client.messages.create({
        body: `Your Win Exchange verification code is: ${code}. This code will expire in 10 minutes.`,
        from: this.phoneNumber,
        to: phoneNumber
      });

      logger.info('SMS verification code sent', {
        to: phoneNumber,
        messageSid: message.sid
      });

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      logger.error('Failed to send SMS verification code', {
        error: error.message,
        phoneNumber
      });

      return {
        success: false,
        error: 'Failed to send verification code'
      };
    }
  }

  /**
   * Send phone number update notification
   */
  async sendPhoneUpdateNotification(phoneNumber) {
    try {
      if (!this.enabled) {
        logger.warn('Twilio not configured. Skipping SMS send.');
        return {
          success: false,
          error: 'SMS service not configured'
        };
      }

      const message = await this.client.messages.create({
        body: `Your phone number has been successfully verified on Win Exchange. If you didn't make this change, please contact support immediately.`,
        from: this.phoneNumber,
        to: phoneNumber
      });

      logger.info('Phone update notification sent', {
        to: phoneNumber,
        messageSid: message.sid
      });

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      logger.error('Failed to send phone update notification', {
        error: error.message,
        phoneNumber
      });

      return {
        success: false,
        error: 'Failed to send notification'
      };
    }
  }

  /**
   * Send 2FA code via SMS
   */
  async send2FACode(phoneNumber, code) {
    try {
      if (!this.enabled) {
        logger.warn('Twilio not configured. Skipping SMS send.');
        return {
          success: false,
          error: 'SMS service not configured'
        };
      }

      const message = await this.client.messages.create({
        body: `Your Win Exchange 2FA code is: ${code}. Do not share this code with anyone.`,
        from: this.phoneNumber,
        to: phoneNumber
      });

      logger.info('2FA code sent via SMS', {
        to: phoneNumber,
        messageSid: message.sid
      });

      return {
        success: true,
        messageSid: message.sid
      };
    } catch (error) {
      logger.error('Failed to send 2FA code', {
        error: error.message,
        phoneNumber
      });

      return {
        success: false,
        error: 'Failed to send 2FA code'
      };
    }
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    // E.164 format: +[country code][number]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }
}

module.exports = new TwilioService();
