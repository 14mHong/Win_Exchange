const { query } = require('../config/database');
const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * InviteCode Model
 * Manages invite codes for gated registration
 */
class InviteCode {
  /**
   * Generate a new invite code
   */
  static async generate({ createdBy = null, expiresAt = null, maxUses = 1, notes = null }) {
    try {
      // Generate unique code (format: WIN-XXXX-YYYY)
      const code = this.generateUniqueCode();

      const result = await query(`
        INSERT INTO invite_codes (code, created_by, expires_at, max_uses, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [code, createdBy, expiresAt, maxUses, notes]);

      logger.info('Invite code generated', { code, createdBy });
      return result.rows[0];
    } catch (error) {
      logger.error('Error generating invite code:', error);
      throw error;
    }
  }

  /**
   * Generate unique code string
   */
  static generateUniqueCode() {
    const prefix = 'WIN';
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${part1}-${part2}`;
  }

  /**
   * Validate and mark code as used
   * Uses row-level locking to prevent race conditions
   */
  static async validateAndUse(code, userId) {
    const client = await require('../config/database').getClient();

    try {
      await client.query('BEGIN');

      // Lock the row and check if code exists and is valid (FOR UPDATE prevents concurrent modifications)
      const codeResult = await client.query(`
        SELECT * FROM invite_codes
        WHERE code = $1
        FOR UPDATE
      `, [code]);

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { valid: false, error: 'Invalid invite code' };
      }

      const inviteCode = codeResult.rows[0];

      // Check if active
      if (!inviteCode.is_active) {
        await client.query('ROLLBACK');
        return { valid: false, error: 'This invite code is no longer active' };
      }

      // Check expiration
      if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return { valid: false, error: 'This invite code has expired' };
      }

      // Check usage limit (CRITICAL: this check happens AFTER row lock)
      if (inviteCode.current_uses >= inviteCode.max_uses) {
        await client.query('ROLLBACK');
        return { valid: false, error: 'This invite code has already been used' };
      }

      // Mark as used (atomically increment and update)
      const updateResult = await client.query(`
        UPDATE invite_codes
        SET
          current_uses = current_uses + 1,
          used_by = CASE WHEN used_by IS NULL THEN $1 ELSE used_by END,
          used_at = CASE WHEN used_at IS NULL THEN CURRENT_TIMESTAMP ELSE used_at END,
          is_active = CASE WHEN current_uses + 1 >= max_uses THEN FALSE ELSE is_active END
        WHERE code = $2
        RETURNING *
      `, [userId, code]);

      await client.query('COMMIT');

      logger.info('Invite code used', { code, userId, newUsageCount: updateResult.rows[0].current_uses });
      return { valid: true, inviteCode: updateResult.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error validating invite code:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if code is valid (without using it)
   */
  static async isValid(code) {
    try {
      const result = await query(`
        SELECT * FROM invite_codes
        WHERE code = $1
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          AND current_uses < max_uses
      `, [code]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking invite code validity:', error);
      return false;
    }
  }

  /**
   * Get code details
   */
  static async getByCode(code) {
    try {
      const result = await query(`
        SELECT ic.*,
               u1.email as created_by_email,
               u2.email as used_by_email
        FROM invite_codes ic
        LEFT JOIN users u1 ON ic.created_by = u1.id
        LEFT JOIN users u2 ON ic.used_by = u2.id
        WHERE ic.code = $1
      `, [code]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting invite code:', error);
      throw error;
    }
  }

  /**
   * Get all codes (for admin)
   */
  static async getAll(limit = 100, offset = 0) {
    try {
      const result = await query(`
        SELECT ic.*,
               u1.email as created_by_email,
               u2.email as used_by_email
        FROM invite_codes ic
        LEFT JOIN users u1 ON ic.created_by = u1.id
        LEFT JOIN users u2 ON ic.used_by = u2.id
        ORDER BY ic.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting invite codes:', error);
      throw error;
    }
  }

  /**
   * Deactivate a code
   */
  static async deactivate(code) {
    try {
      const result = await query(`
        UPDATE invite_codes
        SET is_active = FALSE
        WHERE code = $1
        RETURNING *
      `, [code]);

      logger.info('Invite code deactivated', { code });
      return result.rows[0];
    } catch (error) {
      logger.error('Error deactivating invite code:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_codes,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_codes,
          COUNT(CASE WHEN current_uses >= max_uses THEN 1 END) as used_codes,
          COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_codes
        FROM invite_codes
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting invite code stats:', error);
      throw error;
    }
  }
}

module.exports = InviteCode;
