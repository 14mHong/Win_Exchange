const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Wallet {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.currency = data.currency;
    this.balance = parseFloat(data.balance) || 0;
    this.locked_balance = parseFloat(data.locked_balance) || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create({ user_id, currency, balance = 0 }) {
    const id = uuidv4();
    
    const queryText = `
      INSERT INTO wallets (id, user_id, currency, balance)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, currency) DO NOTHING
      RETURNING *
    `;
    
    const result = await query(queryText, [id, user_id, currency, balance]);
    
    if (result.rows.length === 0) {
      // Wallet already exists, fetch it
      return await this.findByUserAndCurrency(user_id, currency);
    }
    
    return new Wallet(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM wallets WHERE id = $1', [id]);
    return result.rows[0] ? new Wallet(result.rows[0]) : null;
  }

  static async findByUserAndCurrency(user_id, currency) {
    const queryText = 'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2';
    const result = await query(queryText, [user_id, currency]);
    return result.rows[0] ? new Wallet(result.rows[0]) : null;
  }

  static async findByUserId(user_id) {
    const queryText = 'SELECT * FROM wallets WHERE user_id = $1 ORDER BY currency';
    const result = await query(queryText, [user_id]);
    return result.rows.map(row => new Wallet(row));
  }

  static async getTotalBalances() {
    const queryText = `
      SELECT 
        currency, 
        SUM(balance) as total_balance,
        SUM(locked_balance) as total_locked,
        COUNT(*) as wallet_count
      FROM wallets 
      GROUP BY currency
      ORDER BY currency
    `;
    
    const result = await query(queryText);
    return result.rows;
  }

  async updateBalance(amount, type = 'available') {
    if (type === 'available') {
      const queryText = `
        UPDATE wallets 
        SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 AND balance + $1 >= 0
        RETURNING *
      `;
      
      const result = await query(queryText, [amount, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Insufficient balance');
      }
      
      this.balance = parseFloat(result.rows[0].balance);
      this.updated_at = result.rows[0].updated_at;
      
    } else if (type === 'locked') {
      const queryText = `
        UPDATE wallets 
        SET locked_balance = locked_balance + $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 AND locked_balance + $1 >= 0
        RETURNING *
      `;
      
      const result = await query(queryText, [amount, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Insufficient locked balance');
      }
      
      this.locked_balance = parseFloat(result.rows[0].locked_balance);
      this.updated_at = result.rows[0].updated_at;
    }
    
    return this;
  }

  async lockBalance(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const queryText = `
      UPDATE wallets 
      SET 
        balance = balance - $1,
        locked_balance = locked_balance + $1,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 AND balance >= $1
      RETURNING *
    `;
    
    const result = await query(queryText, [amount, this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Insufficient balance to lock');
    }
    
    this.balance = parseFloat(result.rows[0].balance);
    this.locked_balance = parseFloat(result.rows[0].locked_balance);
    this.updated_at = result.rows[0].updated_at;
    
    return this;
  }

  async unlockBalance(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const queryText = `
      UPDATE wallets 
      SET 
        balance = balance + $1,
        locked_balance = locked_balance - $1,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 AND locked_balance >= $1
      RETURNING *
    `;
    
    const result = await query(queryText, [amount, this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Insufficient locked balance to unlock');
    }
    
    this.balance = parseFloat(result.rows[0].balance);
    this.locked_balance = parseFloat(result.rows[0].locked_balance);
    this.updated_at = result.rows[0].updated_at;
    
    return this;
  }

  async releaseLockedBalance(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const queryText = `
      UPDATE wallets 
      SET 
        locked_balance = locked_balance - $1,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 AND locked_balance >= $1
      RETURNING *
    `;
    
    const result = await query(queryText, [amount, this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Insufficient locked balance to release');
    }
    
    this.locked_balance = parseFloat(result.rows[0].locked_balance);
    this.updated_at = result.rows[0].updated_at;
    
    return this;
  }

  // Transfer between wallets (atomic operation)
  static async transfer(fromWalletId, toWalletId, amount, description = '') {
    return await transaction(async (client) => {
      // Get both wallets
      const fromResult = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [fromWalletId]);
      const toResult = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [toWalletId]);
      
      if (fromResult.rows.length === 0 || toResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const fromWallet = new Wallet(fromResult.rows[0]);
      const toWallet = new Wallet(toResult.rows[0]);
      
      if (fromWallet.currency !== toWallet.currency) {
        throw new Error('Currency mismatch');
      }
      
      if (fromWallet.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Update balances
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, fromWalletId]
      );
      
      await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, toWalletId]
      );
      
      // Create transaction records
      const transactionId = uuidv4();
      
      await client.query(`
        INSERT INTO transactions (id, user_id, wallet_id, type, currency, amount, status, notes)
        VALUES ($1, $2, $3, 'withdrawal', $4, $5, 'completed', $6)
      `, [uuidv4(), fromWallet.user_id, fromWalletId, fromWallet.currency, -amount, description]);
      
      await client.query(`
        INSERT INTO transactions (id, user_id, wallet_id, type, currency, amount, status, notes)
        VALUES ($1, $2, $3, 'deposit', $4, $5, 'completed', $6)
      `, [uuidv4(), toWallet.user_id, toWalletId, toWallet.currency, amount, description]);
      
      return {
        success: true,
        fromWallet: { ...fromWallet, balance: fromWallet.balance - amount },
        toWallet: { ...toWallet, balance: toWallet.balance + amount }
      };
    });
  }

  getAvailableBalance() {
    return this.balance;
  }

  getTotalBalance() {
    return this.balance + this.locked_balance;
  }

  getLockedBalance() {
    return this.locked_balance;
  }

  canWithdraw(amount) {
    return this.balance >= amount && amount > 0;
  }

  canLock(amount) {
    return this.balance >= amount && amount > 0;
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      currency: this.currency,
      balance: this.balance,
      locked_balance: this.locked_balance,
      available_balance: this.getAvailableBalance(),
      total_balance: this.getTotalBalance(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  toPublic() {
    return {
      id: this.id,
      currency: this.currency,
      balance: this.balance,
      locked_balance: this.locked_balance,
      available_balance: this.getAvailableBalance(),
      total_balance: this.getTotalBalance(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Wallet;