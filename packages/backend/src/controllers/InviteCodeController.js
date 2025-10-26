const Joi = require('joi');
const InviteCode = require('../models/InviteCode');
const EthereumService = require('../services/EthereumService');
const logger = require('../config/logger');

class InviteCodeController {
  /**
   * Get payment configuration for invite code purchase
   * GET /api/invite-codes/payment-config
   */
  static async getPaymentConfig(req, res) {
    try {
      const config = EthereumService.getPaymentConfig();

      // Get ETH price from CoinGecko cache (won't make new API call if recently cached)
      const CoinGeckoService = require('../services/CoinGeckoService');
      let ethPriceUSD = 2500; // Fallback price

      try {
        // This will use cached price if available (30 second cache)
        ethPriceUSD = await CoinGeckoService.getPrice('ETH');
      } catch (priceError) {
        logger.warn('Could not fetch ETH price, using fallback', { error: priceError.message });
        // Use fallback price, don't throw error
      }

      res.json({
        success: true,
        config: {
          ...config,
          priceUSD: (parseFloat(config.priceETH) * ethPriceUSD).toFixed(2),
          ethPriceUSD
        }
      });
    } catch (error) {
      logger.error('Error fetching payment config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment configuration'
      });
    }
  }

  /**
   * Purchase invite code with Ethereum transaction
   * POST /api/invite-codes/purchase
   */
  static async purchaseInviteCode(req, res) {
    try {
      // Validate request
      const schema = Joi.object({
        txHash: Joi.string()
          .pattern(/^0x[a-fA-F0-9]{64}$/)
          .required()
          .messages({
            'string.pattern.base': 'Invalid transaction hash format',
            'any.required': 'Transaction hash is required'
          }),
        email: Joi.string().email().required().messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required'
        })
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { txHash, email } = value;

      // Verify the Ethereum transaction
      logger.info('Verifying payment transaction', { txHash, email });
      const verification = await EthereumService.verifyPaymentTransaction(txHash, email);

      if (!verification.success) {
        return res.status(400).json({
          success: false,
          error: verification.error,
          confirmations: verification.confirmations,
          required: verification.required
        });
      }

      // Generate invite code
      const inviteCode = await InviteCode.generate({
        createdBy: null, // System-generated
        expiresAt: null, // No expiration
        maxUses: 1,      // One-time use
        notes: `Purchased via ETH payment. TxHash: ${txHash}, Email: ${email}, Amount: ${verification.amount} ETH`
      });

      logger.info('Invite code purchased successfully', {
        code: inviteCode.code,
        txHash,
        email,
        amount: verification.amount
      });

      res.json({
        success: true,
        message: 'Payment verified! Your invite code has been generated.',
        inviteCode: inviteCode.code,
        transaction: {
          hash: txHash,
          amount: verification.amount,
          confirmations: verification.confirmations,
          timestamp: verification.timestamp
        }
      });

    } catch (error) {
      logger.error('Error purchasing invite code:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process invite code purchase'
      });
    }
  }

  /**
   * Check transaction status
   * GET /api/invite-codes/check-transaction/:txHash
   */
  static async checkTransaction(req, res) {
    try {
      const { txHash } = req.params;

      if (!EthereumService.isValidTxHash(txHash)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction hash format'
        });
      }

      // This is a simplified check - just verifies the transaction
      // without generating a code
      const verification = await EthereumService.verifyPaymentTransaction(txHash, 'check-only');

      res.json({
        success: true,
        verified: verification.success,
        error: verification.error,
        confirmations: verification.confirmations,
        required: verification.required
      });

    } catch (error) {
      logger.error('Error checking transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check transaction status'
      });
    }
  }

  /**
   * Validate invite code
   * GET /api/invite-codes/validate/:code
   */
  static async validateCode(req, res) {
    try {
      const { code } = req.params;

      const isValid = await InviteCode.isValid(code);

      res.json({
        success: true,
        valid: isValid
      });

    } catch (error) {
      logger.error('Error validating invite code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate invite code'
      });
    }
  }
}

module.exports = InviteCodeController;
