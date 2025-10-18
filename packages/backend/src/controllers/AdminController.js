const { query } = require('../config/database');
const logger = require('../config/logger');
const CryptoWalletService = require('../services/CryptoWalletService');

class AdminController {
  /**
   * Get all users with their wallet balances
   */
  static async getAllUsers(req, res) {
    try {
      const result = await query(`
        SELECT
          u.id,
          u.email,
          u.phone,
          u.first_name,
          u.last_name,
          u.email_verified,
          u.phone_verified,
          u.two_fa_enabled,
          u.is_active,
          u.is_admin,
          u.provider,
          u.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'currency', w.currency,
                'balance', w.balance,
                'locked_balance', w.locked_balance
              )
            ) FILTER (WHERE w.id IS NOT NULL),
            '[]'
          ) as wallets
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      // Log admin action
      logger.logUserAction(req.user.id, 'ADMIN_VIEW_ALL_USERS', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userCount: result.rows.length
      });

      res.json({
        success: true,
        users: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      logger.error('Admin get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users'
      });
    }
  }

  /**
   * Get detailed user information including deposit addresses
   */
  static async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      // Get user basic info
      const userResult = await query(`
        SELECT
          id, email, phone, first_name, last_name,
          email_verified, phone_verified, two_fa_enabled,
          is_active, is_admin, provider, created_at
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Get wallets with balances
      const walletsResult = await query(`
        SELECT currency, balance, locked_balance, created_at
        FROM wallets
        WHERE user_id = $1
      `, [userId]);

      // Get deposit addresses
      const addressesResult = await query(`
        SELECT currency, address, derivation_path, created_at
        FROM deposit_addresses
        WHERE user_id = $1
      `, [userId]);

      // Get recent transactions
      const transactionsResult = await query(`
        SELECT
          type, currency, amount, fee, status,
          tx_hash, created_at, completed_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [userId]);

      // Log admin action
      logger.logUserAction(req.user.id, 'ADMIN_VIEW_USER_DETAILS', {
        targetUserId: userId,
        targetUserEmail: user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        user: {
          ...user,
          wallets: walletsResult.rows,
          deposit_addresses: addressesResult.rows,
          recent_transactions: transactionsResult.rows
        }
      });
    } catch (error) {
      logger.error('Admin get user details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user details'
      });
    }
  }

  /**
   * Get private keys for a user's deposit addresses
   * CRITICAL: This should only be used in emergency situations
   */
  static async getUserPrivateKeys(req, res) {
    try {
      const { userId } = req.params;

      // Get user info
      const userResult = await query(`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Get deposit addresses
      const addressesResult = await query(`
        SELECT currency, address, derivation_path
        FROM deposit_addresses
        WHERE user_id = $1
      `, [userId]);

      if (addressesResult.rows.length === 0) {
        return res.json({
          success: true,
          message: 'No deposit addresses found for this user',
          private_keys: []
        });
      }

      // Retrieve private keys for each address
      const privateKeys = [];
      for (const addr of addressesResult.rows) {
        try {
          const keyData = CryptoWalletService.getPrivateKey(addr.derivation_path);
          privateKeys.push({
            currency: addr.currency,
            address: addr.address,
            derivation_path: addr.derivation_path,
            private_key: keyData.privateKey,
            private_key_hex: keyData.privateKeyHex || keyData.privateKey,
            public_key: keyData.publicKey,
            format: keyData.format,
            verified_address: keyData.address // Cross-check with stored address
          });
        } catch (err) {
          logger.error('Failed to retrieve private key:', {
            userId,
            currency: addr.currency,
            error: err.message
          });
          // Add error entry instead of skipping
          privateKeys.push({
            currency: addr.currency,
            address: addr.address,
            derivation_path: addr.derivation_path,
            error: err.message
          });
        }
      }

      // CRITICAL SECURITY LOG
      logger.logSecurityEvent('ADMIN_PRIVATE_KEY_ACCESS', {
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: user.email,
        addressCount: privateKeys.length,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        WARNING: 'CRITICAL: Private keys were accessed by admin'
      });

      // Also log to audit logs table
      await query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.id,
        'PRIVATE_KEY_ACCESS',
        'user_wallet',
        userId,
        req.ip,
        req.get('User-Agent'),
        JSON.stringify({
          targetUserEmail: user.email,
          addressCount: privateKeys.length,
          severity: 'CRITICAL'
        })
      ]);

      res.json({
        success: true,
        warning: 'CRITICAL: These private keys provide full access to user funds. Handle with extreme care.',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
        },
        private_keys: privateKeys
      });
    } catch (error) {
      logger.error('Admin get private keys error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve private keys'
      });
    }
  }

  /**
   * Get platform statistics
   */
  static async getPlatformStats(req, res) {
    try {
      // Get user statistics
      const userStatsResult = await query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE email_verified = true) as verified_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
          COUNT(*) FILTER (WHERE is_admin = true) as admin_users
        FROM users
      `);

      // Get wallet statistics
      const walletStatsResult = await query(`
        SELECT
          currency,
          COUNT(*) as wallet_count,
          SUM(balance) as total_balance,
          SUM(locked_balance) as total_locked
        FROM wallets
        GROUP BY currency
      `);

      // Get transaction statistics
      const txStatsResult = await query(`
        SELECT
          type,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM transactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY type
      `);

      // Get order statistics
      const orderStatsResult = await query(`
        SELECT
          status,
          COUNT(*) as count
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status
      `);

      // Log admin action
      logger.logUserAction(req.user.id, 'ADMIN_VIEW_PLATFORM_STATS', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        stats: {
          users: userStatsResult.rows[0],
          wallets: walletStatsResult.rows,
          transactions_30d: txStatsResult.rows,
          orders_30d: orderStatsResult.rows
        }
      });
    } catch (error) {
      logger.error('Admin get platform stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform statistics'
      });
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(req, res) {
    try {
      const { limit = 100, offset = 0, userId, action } = req.query;

      let queryText = `
        SELECT
          al.*,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      if (userId) {
        queryText += ` AND al.user_id = $${paramCount}`;
        params.push(userId);
        paramCount++;
      }

      if (action) {
        queryText += ` AND al.action = $${paramCount}`;
        params.push(action);
        paramCount++;
      }

      queryText += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await query(queryText, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
      const countParams = [];
      if (userId) {
        countQuery += ' AND user_id = $1';
        countParams.push(userId);
      }
      if (action && userId) {
        countQuery += ' AND action = $2';
        countParams.push(action);
      } else if (action) {
        countQuery += ' AND action = $1';
        countParams.push(action);
      }

      const countResult = await query(countQuery, countParams);

      // Log admin action
      logger.logUserAction(req.user.id, 'ADMIN_VIEW_AUDIT_LOGS', {
        ipAddress: req.ip,
        filters: { userId, action, limit, offset }
      });

      res.json({
        success: true,
        logs: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      logger.error('Admin get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch audit logs'
      });
    }
  }
}

module.exports = AdminController;
