const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class PendingUser {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.phone = data.phone;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.password_hash = data.password_hash;
    this.verification_code = data.verification_code;
    this.verification_expires_at = data.verification_expires_at;
    this.created_at = data.created_at;
    this.attempts = data.attempts;
  }

  static async create({ email, phone, first_name, last_name, password, invite_code }) {
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    const verification_code = crypto.randomInt(100000, 999999).toString(); // 6-digit code
    const verification_expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const queryText = `
      INSERT INTO pending_users (id, email, phone, first_name, last_name, password_hash, verification_code, verification_expires_at, invite_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await query(queryText, [id, email, phone, first_name, last_name, password_hash, verification_code, verification_expires_at, invite_code]);
    return new PendingUser(result.rows[0]);
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM pending_users WHERE email = $1', [email]);
    return result.rows[0] ? new PendingUser(result.rows[0]) : null;
  }

  static async findByVerificationCode(code) {
    const result = await query(
      'SELECT * FROM pending_users WHERE verification_code = $1 AND verification_expires_at > NOW()', 
      [code]
    );
    return result.rows[0] ? new PendingUser(result.rows[0]) : null;
  }

  static async deleteByEmail(email) {
    await query('DELETE FROM pending_users WHERE email = $1', [email]);
  }

  static async deleteExpired() {
    await query('DELETE FROM pending_users WHERE verification_expires_at < NOW()');
  }

  async incrementAttempts() {
    const queryText = `
      UPDATE pending_users 
      SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING attempts
    `;
    const result = await query(queryText, [this.id]);
    this.attempts = result.rows[0].attempts;
    return this.attempts;
  }

  async regenerateCode() {
    const verification_code = crypto.randomInt(100000, 999999).toString();
    const verification_expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    const queryText = `
      UPDATE pending_users 
      SET verification_code = $1, verification_expires_at = $2, attempts = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await query(queryText, [verification_code, verification_expires_at, this.id]);
    const updated = new PendingUser(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  isExpired() {
    return new Date() > new Date(this.verification_expires_at);
  }

  hasExceededAttempts() {
    return this.attempts >= 5; // Max 5 verification attempts
  }

  async createUser() {
    const User = require('./User');
    const InviteCode = require('./InviteCode');

    // Create the actual user
    const user = await User.createFromPending({
      email: this.email,
      phone: this.phone,
      first_name: this.first_name,
      last_name: this.last_name,
      password_hash: this.password_hash,
      email_verified: true // Email is verified since they completed OTP
    });

    // Mark invite code as used
    if (this.invite_code) {
      await InviteCode.validateAndUse(this.invite_code, user.id);
    }

    // Clean up pending user
    await PendingUser.deleteByEmail(this.email);

    return user;
  }
}

module.exports = PendingUser;