const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.phone = data.phone;
    this.password_hash = data.password_hash;
    this.two_fa_enabled = data.two_fa_enabled;
    this.two_fa_secret = data.two_fa_secret;
    this.email_verified = data.email_verified;
    this.phone_verified = data.phone_verified;
    this.is_active = data.is_active;
    this.is_admin = data.is_admin || false;
    this.failed_login_attempts = data.failed_login_attempts;
    this.locked_until = data.locked_until;
    this.google_id = data.google_id;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.profile_image = data.profile_image;
    this.provider = data.provider;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create({ email, phone, password }) {
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    
    const queryText = `
      INSERT INTO users (id, email, phone, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await query(queryText, [id, email, phone, password_hash]);
    return new User(result.rows[0]);
  }

  static async createFromPending({ email, phone, first_name, last_name, password_hash, email_verified = false }) {
    const id = uuidv4();

    const queryText = `
      INSERT INTO users (id, email, phone, first_name, last_name, password_hash, email_verified, provider)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'local')
      RETURNING *
    `;

    const result = await query(queryText, [id, email, phone, first_name, last_name, password_hash, email_verified]);
    return new User(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByPhone(phone) {
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  async validatePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  async updatePassword(newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 12);
    const queryText = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
    await query(queryText, [password_hash, this.id]);
    this.password_hash = password_hash;
  }

  generateJWT() {
    return jwt.sign(
      {
        id: this.id,
        email: this.email,
        two_fa_enabled: this.two_fa_enabled,
        is_admin: this.is_admin
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }

  async setup2FA() {
    const secret = speakeasy.generateSecret({
      name: `Win Exchange (${this.email})`,
      issuer: 'Win Exchange',
      length: 32
    });

    const queryText = `
      UPDATE users 
      SET two_fa_secret = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
    
    await query(queryText, [secret.base32, this.id]);
    this.two_fa_secret = secret.base32;

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url
    };
  }

  async enable2FA() {
    const queryText = `
      UPDATE users 
      SET two_fa_enabled = true, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await query(queryText, [this.id]);
    this.two_fa_enabled = true;
  }

  async disable2FA() {
    const queryText = `
      UPDATE users 
      SET two_fa_enabled = false, two_fa_secret = null, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await query(queryText, [this.id]);
    this.two_fa_enabled = false;
    this.two_fa_secret = null;
  }

  verify2FAToken(token) {
    if (!this.two_fa_secret) return false;
    
    return speakeasy.totp.verify({
      secret: this.two_fa_secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step behind and ahead
    });
  }

  async verifyEmail() {
    const queryText = `
      UPDATE users 
      SET email_verified = true, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await query(queryText, [this.id]);
    this.email_verified = true;
  }

  async verifyPhone() {
    const queryText = `
      UPDATE users 
      SET phone_verified = true, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await query(queryText, [this.id]);
    this.phone_verified = true;
  }

  async incrementFailedAttempts() {
    const queryText = `
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE 
            WHEN failed_login_attempts >= 4 THEN CURRENT_TIMESTAMP + INTERVAL '1 hour'
            ELSE locked_until
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING failed_login_attempts, locked_until
    `;
    const result = await query(queryText, [this.id]);
    this.failed_login_attempts = result.rows[0].failed_login_attempts;
    this.locked_until = result.rows[0].locked_until;
  }

  async resetFailedAttempts() {
    const queryText = `
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = null, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await query(queryText, [this.id]);
    this.failed_login_attempts = 0;
    this.locked_until = null;
  }

  isLocked() {
    return this.locked_until && new Date() < new Date(this.locked_until);
  }

  static async updateProfile(userId, updates) {
    const allowedFields = ['phone', 'first_name', 'last_name'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;

        // If phone is being updated, reset phone verification
        if (key === 'phone') {
          fields.push(`phone_verified = false`);
        }
      }
    }

    if (fields.length === 0) {
      // No valid fields to update, just return the current user
      return await User.findById(userId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const queryText = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(queryText, values);
    return new User(result.rows[0]);
  }

  toJSON() {
    const { password_hash, two_fa_secret, ...user } = this;
    return user;
  }

  toPublic() {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      two_fa_enabled: this.two_fa_enabled,
      email_verified: this.email_verified,
      phone_verified: this.phone_verified,
      is_active: this.is_active,
      is_admin: this.is_admin,
      first_name: this.first_name,
      last_name: this.last_name,
      profile_image: this.profile_image,
      provider: this.provider,
      created_at: this.created_at
    };
  }

  // OAuth-specific methods
  static async findByGoogleId(googleId) {
    const result = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async createOAuthUser(userData) {
    const id = uuidv4();

    const queryText = `
      INSERT INTO users (
        id, email, google_id, first_name, last_name,
        profile_image, email_verified, provider
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      userData.email,
      userData.google_id || null,
      userData.first_name || null,
      userData.last_name || null,
      userData.profile_image || null,
      userData.email_verified || false,
      userData.provider || 'local'
    ];

    const result = await query(queryText, values);
    return new User(result.rows[0]);
  }

  static async linkGoogleAccount(userId, googleId) {
    const queryText = `
      UPDATE users
      SET google_id = $1, email_verified = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await query(queryText, [googleId, userId]);
  }
}

module.exports = User;