const AuthService = require('../services/AuthService');
const EmailService = require('../services/EmailService');
const logger = require('../config/logger');
const redis = require('../config/redis');
const Joi = require('joi');
const QRCode = require('qrcode');

class AuthController {
  // Register new user
  static async register(req, res) {
    try {
      // Validation schema
      const schema = Joi.object({
        email: Joi.string().email().required(),
        phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
        first_name: Joi.string().max(100).required(),
        last_name: Joi.string().max(100).required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        invite_code: Joi.string().required().messages({
          'any.required': 'An invite code is required to register',
          'string.empty': 'Please enter your invite code'
        })
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { email, phone, first_name, last_name, password, invite_code } = value;
      const result = await AuthService.register({ email, phone, first_name, last_name, password, invite_code });

      // Log registration attempt (user not created yet, only pending)
      logger.info('Registration initiated', {
        email,
        requiresVerification: result.requiresVerification,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify registration OTP
  static async verifyRegistration(req, res) {
    try {
      // Validation schema
      const schema = Joi.object({
        verificationCode: Joi.string().length(6).pattern(/^\d{6}$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { verificationCode } = value;
      const result = await AuthService.verifyRegistration({ verificationCode });

      logger.logUserAction(result.user.id, 'REGISTRATION_VERIFIED', {
        email: result.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json(result);
    } catch (error) {
      logger.error('Registration verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        twoFAToken: Joi.string().length(6).pattern(/^\d+$/).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { email, password, twoFAToken } = value;
      const result = await AuthService.login({
        email,
        password,
        twoFAToken,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(result);
    } catch (error) {
      logger.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // Logout user
  static async logout(req, res) {
    try {
      const result = await AuthService.logout(req.token);
      
      logger.logUserAction(req.user.id, 'USER_LOGOUT', {
        ipAddress: req.ip
      });

      res.json(result);
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Verify email
  static async verifyEmail(req, res) {
    try {
      const schema = Joi.object({
        code: Joi.string().length(6).pattern(/^\d+$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { code } = value;
      const result = await AuthService.verifyEmail(req.user.id, code);

      // Send welcome email after verification
      if (result.success) {
        await EmailService.sendWelcomeEmail(req.user.email, req.user.email);
      }

      res.json(result);
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify phone
  static async verifyPhone(req, res) {
    try {
      const schema = Joi.object({
        code: Joi.string().length(6).pattern(/^\d+$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { code } = value;
      const result = await AuthService.verifyPhone(req.user.id, code);

      res.json(result);
    } catch (error) {
      logger.error('Phone verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Resend verification code
  static async resendVerification(req, res) {
    try {
      const schema = Joi.object({
        type: Joi.string().valid('email_verification', 'phone_verification').required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { type } = value;
      const result = await AuthService.resendVerification(req.user.id, type);

      res.json(result);
    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Add phone number
  static async addPhoneNumber(req, res) {
    try {
      const schema = Joi.object({
        phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { phone } = value;
      const result = await AuthService.addPhoneNumber(req.user.id, phone);

      res.json(result);
    } catch (error) {
      logger.error('Add phone number error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Setup 2FA
  static async setup2FA(req, res) {
    try {
      const result = await AuthService.setup2FA(req.user.id);

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(result.qrCodeUrl);

      res.json({
        success: true,
        secret: result.secret,
        qrCode: qrCodeDataURL,
        manualEntryKey: result.secret
      });
    } catch (error) {
      logger.error('2FA setup error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify 2FA setup
  static async verify2FASetup(req, res) {
    try {
      const schema = Joi.object({
        token: Joi.string().length(6).pattern(/^\d+$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { token } = value;
      const result = await AuthService.verify2FASetup(req.user.id, token);

      res.json(result);
    } catch (error) {
      logger.error('2FA verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Disable 2FA
  static async disable2FA(req, res) {
    try {
      const schema = Joi.object({
        token: Joi.string().length(6).pattern(/^\d+$/).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { token } = value;
      const result = await AuthService.disable2FA(req.user.id, token);

      res.json(result);
    } catch (error) {
      logger.error('2FA disable error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Reset password request
  static async resetPassword(req, res) {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { email } = value;
      const result = await AuthService.resetPassword(email);

      res.json(result);
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset failed'
      });
    }
  }

  // Confirm password reset
  static async confirmPasswordReset(req, res) {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).pattern(/^\d+$/).required(),
        newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { email, code, newPassword } = value;
      const result = await AuthService.confirmPasswordReset(email, code, newPassword);

      res.json(result);
    } catch (error) {
      logger.error('Password reset confirmation error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Refresh token
  static async refreshToken(req, res) {
    try {
      const result = await AuthService.refreshToken(req.token);
      res.json(result);
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: user.toPublic()
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const schema = Joi.object({
        phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).allow(null, '').optional(),
        first_name: Joi.string().max(100).allow(null, '').optional(),
        last_name: Joi.string().max(100).allow(null, '').optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      // Names cannot be changed once set during registration
      if (value.first_name !== undefined || value.last_name !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'Names cannot be changed after registration.'
        });
      }

      const User = require('../models/User');
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const result = await User.updateProfile(req.user.id, value);

      logger.logUserAction(req.user.id, 'PROFILE_UPDATED', {
        fields: Object.keys(value),
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: result.toPublic()
      });
    } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Profile update failed'
      });
    }
  }

  // Initiate OAuth flow
  static async initiateOAuth(req, res) {
    try {
      const { provider } = req.params;

      if (provider !== 'google') {
        return res.status(400).json({
          success: false,
          error: 'Unsupported OAuth provider. Only Google OAuth is supported.'
        });
      }

      // Generate state parameter for security
      const state = require('crypto').randomBytes(32).toString('hex');

      // Store state in session or cache (for production, use Redis)
      req.session = req.session || {};
      req.session.oauthState = state;

      // Backend OAuth callback URL (where Google redirects after auth)
      const backendUrl = process.env.BACKEND_URL || 'https://win-exchange-bdmv.onrender.com';
      const redirectUri = `${backendUrl}/api/auth/oauth/google/callback`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${state}`;

      res.json({
        success: true,
        authUrl,
        state
      });

    } catch (error) {
      logger.error('OAuth initiation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate OAuth'
      });
    }
  }

  // Handle OAuth callback
  static async handleOAuthCallback(req, res) {
    try {
      const { provider } = req.params;
      // Support both query params (GET from Google) and body params (POST from frontend)
      const code = req.query.code || req.body.code;
      const state = req.query.state || req.body.state;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code is required'
        });
      }

      // Verify state parameter (in production, check against stored state)
      if (!state) {
        return res.status(400).json({
          success: false,
          error: 'State parameter is required'
        });
      }

      if (provider !== 'google') {
        return res.status(400).json({
          success: false,
          error: 'Unsupported OAuth provider. Only Google OAuth is supported.'
        });
      }

      // Exchange code for tokens
      const https = require('https');
      const querystring = require('querystring');

      // Must match the redirect_uri used in initiateOAuth
      const backendUrl = process.env.BACKEND_URL || 'https://win-exchange-bdmv.onrender.com';
      const redirectUri = `${backendUrl}/api/auth/oauth/google/callback`;

      const tokenParams = querystring.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      });

      const tokenResponse = await new Promise((resolve, reject) => {
        const req = https.request('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': tokenParams.length
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.write(tokenParams);
        req.end();
      });

      if (!tokenResponse.access_token) {
        throw new Error('Failed to get access token from Google');
      }

      // Get user profile
      const userProfile = await new Promise((resolve, reject) => {
        const req = https.request('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.end();
      });

      // Process the user profile and create/login user
      const User = require('../models/User');
      let user = await User.findByGoogleId(userProfile.id);

      if (!user && userProfile.email) {
        user = await User.findByEmail(userProfile.email);
        if (user) {
          await User.linkGoogleAccount(user.id, userProfile.id);
        }
      }

      if (!user) {
        user = await User.createOAuthUser({
          email: userProfile.email,
          google_id: userProfile.id,
          first_name: userProfile.given_name,
          last_name: userProfile.family_name,
          profile_image: userProfile.picture,
          email_verified: true,
          provider: 'google'
        });
      }

      // Generate JWT token
      const token = user.generateJWT();

      // Store session
      const Session = require('../models/Session');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const session = await Session.create({
        user_id: user.id,
        token,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        expires_at: expiresAt
      });

      // Store session in Redis (same as regular login)
      await redis.setex(`session:${token}`, 24 * 60 * 60, {
        userId: user.id,
        sessionId: session.id
      });

      logger.logUserAction(user.id, 'OAUTH_LOGIN', {
        provider,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // If this is a GET request (from Google redirect), redirect to frontend with token
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'https://win-exchange-frontend.onrender.com';
        const redirectUrl = `${frontendUrl}/auth/oauth-success?token=${encodeURIComponent(token)}&provider=${provider}`;
        return res.redirect(redirectUrl);
      }

      // If this is a POST request (from frontend), return JSON
      res.json({
        success: true,
        message: `Successfully authenticated with ${provider}`,
        token,
        user: user.toPublic(),
        sessionId: session.id
      });

    } catch (error) {
      logger.error('OAuth callback error:', error);

      // If this is a GET request (from Google), redirect to frontend with error
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'https://win-exchange-frontend.onrender.com';
        const errorMsg = encodeURIComponent(error.message || 'Failed to handle OAuth callback');
        return res.redirect(`${frontendUrl}/login?error=${errorMsg}`);
      }

      // If this is a POST request, return JSON error
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to handle OAuth callback'
      });
    }
  }
}

module.exports = AuthController;