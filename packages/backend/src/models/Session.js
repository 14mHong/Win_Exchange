const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Session {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.token = data.token;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
    this.expires_at = data.expires_at;
    this.created_at = data.created_at;
  }

  static async create({ user_id, token, ip_address, user_agent, expires_at }) {
    const id = uuidv4();
    
    const queryText = `
      INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await query(queryText, [
      id, user_id, token, ip_address, user_agent, expires_at
    ]);
    
    return new Session(result.rows[0]);
  }

  static async findByToken(token) {
    const queryText = `
      SELECT s.*, u.email, u.is_active, u.two_fa_enabled, u.is_admin
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `;

    const result = await query(queryText, [token]);
    return result.rows[0] ? {
      session: new Session(result.rows[0]),
      user: {
        id: result.rows[0].user_id,
        email: result.rows[0].email,
        is_active: result.rows[0].is_active,
        two_fa_enabled: result.rows[0].two_fa_enabled,
        is_admin: result.rows[0].is_admin
      }
    } : null;
  }

  static async findByUserId(user_id) {
    const queryText = `
      SELECT * FROM sessions 
      WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
    
    const result = await query(queryText, [user_id]);
    return result.rows.map(row => new Session(row));
  }

  static async deleteExpired() {
    const queryText = 'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP';
    const result = await query(queryText);
    return result.rowCount;
  }

  static async deleteByToken(token) {
    const queryText = 'DELETE FROM sessions WHERE token = $1';
    const result = await query(queryText, [token]);
    return result.rowCount > 0;
  }

  static async deleteByUserId(user_id) {
    const queryText = 'DELETE FROM sessions WHERE user_id = $1';
    const result = await query(queryText, [user_id]);
    return result.rowCount;
  }

  async delete() {
    const queryText = 'DELETE FROM sessions WHERE id = $1';
    const result = await query(queryText, [this.id]);
    return result.rowCount > 0;
  }

  async updateExpiry(expires_at) {
    const queryText = `
      UPDATE sessions 
      SET expires_at = $1 
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await query(queryText, [expires_at, this.id]);
    if (result.rows[0]) {
      this.expires_at = result.rows[0].expires_at;
      return true;
    }
    return false;
  }

  isExpired() {
    return new Date() > new Date(this.expires_at);
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
      ip_address: this.ip_address,
      user_agent: this.user_agent,
      expires_at: this.expires_at,
      created_at: this.created_at,
      remaining_time: this.getRemainingTime()
    };
  }
}

module.exports = Session;