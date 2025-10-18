const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class VerificationCode {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.code = data.code;
    this.type = data.type;
    this.expires_at = data.expires_at;
    this.used_at = data.used_at;
    this.created_at = data.created_at;
  }

  static generateCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[crypto.randomInt(0, digits.length)];
    }
    return code;
  }

  static async create({ user_id, type, expiryMinutes = 15 }) {
    const id = uuidv4();
    const code = this.generateCode();
    const expires_at = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    // Delete any existing unused codes of the same type for this user
    await query(
      'DELETE FROM verification_codes WHERE user_id = $1 AND type = $2 AND used_at IS NULL',
      [user_id, type]
    );
    
    const queryText = `
      INSERT INTO verification_codes (id, user_id, code, type, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await query(queryText, [id, user_id, code, type, expires_at]);
    return new VerificationCode(result.rows[0]);
  }

  static async findByUserAndType(user_id, type) {
    const queryText = `
      SELECT * FROM verification_codes 
      WHERE user_id = $1 AND type = $2 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await query(queryText, [user_id, type]);
    return result.rows[0] ? new VerificationCode(result.rows[0]) : null;
  }

  static async verify(user_id, code, type) {
    const queryText = `
      SELECT * FROM verification_codes 
      WHERE user_id = $1 AND code = $2 AND type = $3 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `;
    
    const result = await query(queryText, [user_id, code, type]);
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid or expired verification code' };
    }

    const verificationCode = new VerificationCode(result.rows[0]);
    await verificationCode.markAsUsed();
    
    return { success: true, verificationCode };
  }

  static async cleanupExpired() {
    const queryText = 'DELETE FROM verification_codes WHERE expires_at <= CURRENT_TIMESTAMP';
    const result = await query(queryText);
    return result.rowCount;
  }

  async markAsUsed() {
    const queryText = `
      UPDATE verification_codes 
      SET used_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [this.id]);
    if (result.rows[0]) {
      this.used_at = result.rows[0].used_at;
      return true;
    }
    return false;
  }

  isExpired() {
    return new Date() > new Date(this.expires_at);
  }

  isUsed() {
    return this.used_at !== null;
  }

  isValid() {
    return !this.isExpired() && !this.isUsed();
  }

  getRemainingTime() {
    const now = new Date();
    const expiry = new Date(this.expires_at);
    return Math.max(0, expiry.getTime() - now.getTime());
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      type: this.type,
      expires_at: this.expires_at,
      used_at: this.used_at,
      created_at: this.created_at,
      remaining_time: this.getRemainingTime(),
      is_valid: this.isValid()
    };
  }

  // Don't expose the actual code in JSON
  toPublic() {
    const { code, ...publicData } = this.toJSON();
    return publicData;
  }
}

module.exports = VerificationCode;