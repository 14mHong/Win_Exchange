const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const Session = require('../models/Session');
const VerificationCode = require('../models/VerificationCode');
const InviteCode = require('../models/InviteCode');
const EmailService = require('./EmailService');
const TwilioService = require('./TwilioService');
const redis = require('../config/redis');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthService {
  static async register({ email, phone, first_name, last_name, password, invite_code }) {
    try {
      // Reserve invite code first (this locks it atomically to prevent race conditions)
      if (!invite_code) {
        throw new Error('An invite code is required to register');
      }

      // Reserve the code immediately - this increments usage and locks the row
      await InviteCode.reserve(invite_code);

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        // If user exists and has OAuth provider, they should login instead
        if (existingUser.google_id || existingUser.facebook_id) {
          throw new Error('An account with this email already exists. Please sign in using your social account.');
        }
        throw new Error('User with this email already exists');
      }

      if (phone) {
        const existingPhone = await User.findByPhone(phone);
        if (existingPhone) {
          throw new Error('User with this phone number already exists');
        }
      }

      // Clean up any expired pending users
      await PendingUser.deleteExpired();

      // Check if there's already a pending registration for this email
      const existingPending = await PendingUser.findByEmail(email);
      if (existingPending) {
        if (existingPending.hasExceededAttempts()) {
          throw new Error('Too many verification attempts. Please try again later.');
        }

        // Regenerate code and resend
        await existingPending.regenerateCode();
        try {
          await EmailService.sendVerificationEmail(email, existingPending.verification_code);
        } catch (emailError) {
          logger.warn('Failed to resend verification email:', emailError);
          // Continue even if email fails
        }

        logger.logUserAction(null, 'REGISTRATION_CODE_RESENT', { email });

        return {
          success: true,
          message: 'A new verification code has been sent to your email address.',
          requiresVerification: true
        };
      }

      // Create pending user with invite code
      const pendingUser = await PendingUser.create({ email, phone, first_name, last_name, password, invite_code });

      // Send verification email with OTP
      try {
        await EmailService.sendVerificationEmail(email, pendingUser.verification_code);
        logger.info('Verification email sent successfully', { email });
      } catch (emailError) {
        logger.error('Failed to send verification email', {
          email,
          error: emailError.message,
          stack: emailError.stack,
          code: emailError.code
        });
        // Continue with registration even if email fails - user can request resend
        // In production, consider throwing an error or using a fallback notification method
      }

      logger.logUserAction(null, 'REGISTRATION_INITIATED', { email, phone: !!phone });

      return {
        success: true,
        message: 'Please check your email for a verification code to complete registration.',
        requiresVerification: true
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  static async verifyRegistration({ verificationCode }) {
    try {
      // Find pending user by verification code
      const pendingUser = await PendingUser.findByVerificationCode(verificationCode);
      
      if (!pendingUser) {
        throw new Error('Invalid or expired verification code');
      }

      if (pendingUser.isExpired()) {
        throw new Error('Verification code has expired. Please request a new one.');
      }

      if (pendingUser.hasExceededAttempts()) {
        throw new Error('Too many verification attempts. Please try again later.');
      }

      // Check if user already exists (race condition protection)
      const existingUser = await User.findByEmail(pendingUser.email);
      if (existingUser) {
        await PendingUser.deleteByEmail(pendingUser.email);
        throw new Error('An account with this email already exists');
      }

      // Create the actual user
      const user = await pendingUser.createUser();

      logger.logUserAction(user.id, 'USER_REGISTRATION_COMPLETED', { 
        email: user.email, 
        phone: !!user.phone 
      });

      return {
        success: true,
        user: user.toPublic(),
        message: 'Registration completed successfully! You can now log in.'
      };
    } catch (error) {
      // Increment attempts if we found a pending user
      try {
        const pendingUser = await PendingUser.findByVerificationCode(verificationCode);
        if (pendingUser && !pendingUser.isExpired()) {
          await pendingUser.incrementAttempts();
        }
      } catch (incrementError) {
        logger.error('Error incrementing verification attempts:', incrementError);
      }

      logger.error('Registration verification error:', error);
      throw error;
    }
  }

  static async login({ email, password, twoFAToken, ipAddress, userAgent }) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is locked
      if (user.isLocked()) {
        throw new Error('Account is temporarily locked due to multiple failed login attempts');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      // Validate password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        await user.incrementFailedAttempts();
        logger.logSecurityEvent('FAILED_LOGIN_ATTEMPT', { 
          userId: user.id, 
          email, 
          ipAddress,
          attempts: user.failed_login_attempts 
        });
        throw new Error('Invalid credentials');
      }

      // Check 2FA if enabled
      if (user.two_fa_enabled) {
        if (!twoFAToken) {
          return {
            success: false,
            requiresTwoFA: true,
            message: 'Two-factor authentication required'
          };
        }

        const isValid2FA = user.verify2FAToken(twoFAToken);
        if (!isValid2FA) {
          await user.incrementFailedAttempts();
          logger.logSecurityEvent('FAILED_2FA_ATTEMPT', { 
            userId: user.id, 
            email, 
            ipAddress 
          });
          throw new Error('Invalid two-factor authentication code');
        }
      }

      // Reset failed attempts on successful login
      await user.resetFailedAttempts();

      // Generate JWT
      const token = user.generateJWT();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create session
      const session = await Session.create({
        user_id: user.id,
        token,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt
      });

      // Store session in Redis
      await redis.setex(`session:${token}`, 24 * 60 * 60, {
        userId: user.id,
        sessionId: session.id
      });

      logger.logUserAction(user.id, 'USER_LOGIN', { 
        ipAddress, 
        userAgent,
        twoFA: user.two_fa_enabled 
      });

      return {
        success: true,
        token,
        user: user.toPublic(),
        expiresAt
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  static async logout(token) {
    try {
      // Remove from Redis
      await redis.del(`session:${token}`);

      // Remove from database
      await Session.deleteByToken(token);

      logger.info('User logged out successfully');

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  static async verifyEmail(userId, code) {
    try {
      const verification = await VerificationCode.verify(userId, code, 'email_verification');
      
      if (!verification.success) {
        throw new Error(verification.error);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.verifyEmail();

      logger.logUserAction(userId, 'EMAIL_VERIFIED');

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  static async verifyPhone(userId, code) {
    try {
      const verification = await VerificationCode.verify(userId, code, 'phone_verification');
      
      if (!verification.success) {
        throw new Error(verification.error);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.verifyPhone();

      logger.logUserAction(userId, 'PHONE_VERIFIED');

      return { success: true, message: 'Phone verified successfully' };
    } catch (error) {
      logger.error('Phone verification error:', error);
      throw error;
    }
  }

  static async resendVerification(userId, type) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      let verificationCode;

      if (type === 'email_verification') {
        verificationCode = await VerificationCode.create({
          user_id: userId,
          type: 'email_verification'
        });
        await EmailService.sendVerificationEmail(user.email, verificationCode.code);
      } else if (type === 'phone_verification') {
        if (!user.phone) {
          throw new Error('No phone number associated with account');
        }
        verificationCode = await VerificationCode.create({
          user_id: userId,
          type: 'phone_verification'
        });
        const smsResult = await TwilioService.sendVerificationCode(user.phone, verificationCode.code);
        if (!smsResult.success) {
          throw new Error(smsResult.error || 'Failed to send SMS verification code');
        }
      } else {
        throw new Error('Invalid verification type');
      }

      logger.logUserAction(userId, 'VERIFICATION_RESENT', { type });

      return { success: true, message: `Verification code sent via ${type.split('_')[0]}` };
    } catch (error) {
      logger.error('Resend verification error:', error);
      throw error;
    }
  }

  static async addPhoneNumber(userId, phoneNumber) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate phone number format
      if (!TwilioService.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format. Please use E.164 format (e.g., +1234567890)');
      }

      // Check if phone number is already in use by another user
      const existingUser = await User.findByPhone(phoneNumber);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('This phone number is already associated with another account');
      }

      // Update user's phone number and set verification to false
      await User.updateProfile(userId, { phone: phoneNumber });

      // Create verification code
      const verificationCode = await VerificationCode.create({
        user_id: userId,
        type: 'phone_verification'
      });

      // Send SMS verification code
      const smsResult = await TwilioService.sendVerificationCode(phoneNumber, verificationCode.code);
      if (!smsResult.success) {
        throw new Error(smsResult.error || 'Failed to send SMS verification code');
      }

      logger.logUserAction(userId, 'PHONE_NUMBER_ADDED', { phoneNumber });

      return {
        success: true,
        message: 'Phone number added. Please verify it using the code sent to your phone.'
      };
    } catch (error) {
      logger.error('Add phone number error:', error);
      throw error;
    }
  }

  static async setup2FA(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.two_fa_enabled) {
        throw new Error('Two-factor authentication is already enabled');
      }

      const twoFASetup = await user.setup2FA();

      logger.logUserAction(userId, '2FA_SETUP_INITIATED');

      return {
        success: true,
        secret: twoFASetup.secret,
        qrCodeUrl: twoFASetup.qrCodeUrl
      };
    } catch (error) {
      logger.error('2FA setup error:', error);
      throw error;
    }
  }

  static async verify2FASetup(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.two_fa_enabled) {
        throw new Error('Two-factor authentication is already enabled');
      }

      const isValid = user.verify2FAToken(token);
      if (!isValid) {
        throw new Error('Invalid two-factor authentication code');
      }

      await user.enable2FA();

      logger.logUserAction(userId, '2FA_ENABLED');

      return { success: true, message: 'Two-factor authentication enabled successfully' };
    } catch (error) {
      logger.error('2FA verification error:', error);
      throw error;
    }
  }

  static async disable2FA(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.two_fa_enabled) {
        throw new Error('Two-factor authentication is not enabled');
      }

      const isValid = user.verify2FAToken(token);
      if (!isValid) {
        throw new Error('Invalid two-factor authentication code');
      }

      await user.disable2FA();

      logger.logUserAction(userId, '2FA_DISABLED');

      return { success: true, message: 'Two-factor authentication disabled successfully' };
    } catch (error) {
      logger.error('2FA disable error:', error);
      throw error;
    }
  }

  static async resetPassword(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return { success: true, message: 'If the email exists, a reset link has been sent' };
      }

      const resetCode = await VerificationCode.create({
        user_id: user.id,
        type: 'password_reset',
        expiryMinutes: 30 // 30 minutes for password reset
      });

      await EmailService.sendPasswordResetEmail(email, resetCode.code);

      logger.logUserAction(user.id, 'PASSWORD_RESET_REQUESTED');

      return { success: true, message: 'If the email exists, a reset link has been sent' };
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  static async confirmPasswordReset(email, code, newPassword) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid reset code');
      }

      const verification = await VerificationCode.verify(user.id, code, 'password_reset');
      
      if (!verification.success) {
        throw new Error('Invalid or expired reset code');
      }

      await user.updatePassword(newPassword);

      // Logout all sessions
      await Session.deleteByUserId(user.id);
      await redis.del(`user_sessions:${user.id}`);

      logger.logUserAction(user.id, 'PASSWORD_RESET_COMPLETED');

      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Password reset confirmation error:', error);
      throw error;
    }
  }

  static async validateSession(token) {
    try {
      // Check Redis first for performance
      const sessionData = await redis.get(`session:${token}`);
      if (!sessionData) {
        return null;
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get full session data from database
      const sessionInfo = await Session.findByToken(token);
      if (!sessionInfo) {
        await redis.del(`session:${token}`);
        return null;
      }

      return {
        user: sessionInfo.user,
        session: sessionInfo.session
      };
    } catch (error) {
      logger.error('Session validation error:', error);
      return null;
    }
  }

  static async refreshToken(oldToken) {
    try {
      const sessionInfo = await this.validateSession(oldToken);
      if (!sessionInfo) {
        throw new Error('Invalid session');
      }

      const user = await User.findById(sessionInfo.user.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken = user.generateJWT();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update session
      await sessionInfo.session.updateExpiry(expiresAt);

      // Update Redis
      await redis.del(`session:${oldToken}`);
      await redis.setex(`session:${newToken}`, 24 * 60 * 60, {
        userId: user.id,
        sessionId: sessionInfo.session.id
      });

      logger.logUserAction(user.id, 'TOKEN_REFRESHED');

      return {
        success: true,
        token: newToken,
        expiresAt
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }
}

module.exports = AuthService;