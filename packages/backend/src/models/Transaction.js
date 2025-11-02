const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Transaction {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.wallet_id = data.wallet_id;
    this.type = data.type;
    this.currency = data.currency;
    this.amount = parseFloat(data.amount);
    this.fee = parseFloat(data.fee) || 0;
    this.status = data.status;
    this.tx_hash = data.tx_hash;
    this.block_height = data.block_height;
    this.confirmations = data.confirmations || 0;
    this.external_id = data.external_id;
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.completed_at = data.completed_at;
  }

  static async create({
    user_id,
    wallet_id,
    type,
    currency,
    amount,
    fee = 0,
    status = 'pending',
    tx_hash = null,
    block_number = null,
    from_address = null,
    to_address = null,
    confirmations = 0,
    external_id = null,
    notes = null
  }) {
    const id = uuidv4();

    const queryText = `
      INSERT INTO transactions (
        id, user_id, wallet_id, type, currency, amount, fee,
        status, tx_hash, block_number,
        confirmations, external_id, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await query(queryText, [
      id, user_id, wallet_id, type, currency, amount, fee,
      status, tx_hash, block_number,
      confirmations, external_id, notes
    ]);

    return new Transaction(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);
    return result.rows[0] ? new Transaction(result.rows[0]) : null;
  }

  static async findByUserId(user_id, options = {}) {
    const {
      limit = 50,
      offset = 0,
      type = null,
      currency = null,
      status = null,
      startDate = null,
      endDate = null
    } = options;

    let queryText = `
      SELECT t.*, w.currency as wallet_currency
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE t.user_id = $1
    `;
    
    const params = [user_id];
    let paramCount = 1;

    if (type) {
      queryText += ` AND t.type = $${++paramCount}`;
      params.push(type);
    }

    if (currency) {
      queryText += ` AND t.currency = $${++paramCount}`;
      params.push(currency);
    }

    if (status) {
      queryText += ` AND t.status = $${++paramCount}`;
      params.push(status);
    }

    if (startDate) {
      queryText += ` AND t.created_at >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND t.created_at <= $${++paramCount}`;
      params.push(endDate);
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    return result.rows.map(row => new Transaction(row));
  }

  static async findByWalletId(wallet_id, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    const queryText = `
      SELECT * FROM transactions 
      WHERE wallet_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await query(queryText, [wallet_id, limit, offset]);
    return result.rows.map(row => new Transaction(row));
  }

  static async findByTxHash(tx_hash) {
    const result = await query('SELECT * FROM transactions WHERE tx_hash = $1', [tx_hash]);
    return result.rows.map(row => new Transaction(row));
  }

  static async findByExternalId(external_id) {
    const result = await query('SELECT * FROM transactions WHERE external_id = $1', [external_id]);
    return result.rows[0] ? new Transaction(result.rows[0]) : null;
  }

  static async getPendingTransactions(type = null) {
    let queryText = `
      SELECT t.*, u.email, w.currency
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN wallets w ON t.wallet_id = w.id
      WHERE t.status = 'pending'
    `;
    
    const params = [];
    
    if (type) {
      queryText += ' AND t.type = $1';
      params.push(type);
    }
    
    queryText += ' ORDER BY t.created_at ASC';
    
    const result = await query(queryText, params);
    return result.rows.map(row => new Transaction(row));
  }

  static async getTransactionStats(user_id, period = '30d') {
    const interval = period === '7d' ? '7 days' : period === '1d' ? '1 day' : '30 days';
    
    const queryText = `
      SELECT 
        type,
        currency,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(fee) as total_fees,
        AVG(amount) as avg_amount
      FROM transactions
      WHERE user_id = $1 
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${interval}'
        AND status = 'completed'
      GROUP BY type, currency
      ORDER BY total_amount DESC
    `;
    
    const result = await query(queryText, [user_id]);
    return result.rows;
  }

  async updateStatus(status, additional_data = {}) {
    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    let paramCount = 1;

    if (status === 'completed' && !this.completed_at) {
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (additional_data.tx_hash) {
      updates.push(`tx_hash = $${++paramCount}`);
      params.push(additional_data.tx_hash);
    }

    if (additional_data.block_height) {
      updates.push(`block_height = $${++paramCount}`);
      params.push(additional_data.block_height);
    }

    if (additional_data.confirmations !== undefined) {
      updates.push(`confirmations = $${++paramCount}`);
      params.push(additional_data.confirmations);
    }

    if (additional_data.notes) {
      updates.push(`notes = $${++paramCount}`);
      params.push(additional_data.notes);
    }

    const queryText = `
      UPDATE transactions 
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;
    
    params.push(this.id);

    const result = await query(queryText, params);
    
    if (result.rows[0]) {
      Object.assign(this, result.rows[0]);
      this.amount = parseFloat(this.amount);
      this.fee = parseFloat(this.fee);
    }
    
    return this;
  }

  async addConfirmation() {
    const queryText = `
      UPDATE transactions 
      SET 
        confirmations = confirmations + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [this.id]);
    
    if (result.rows[0]) {
      this.confirmations = result.rows[0].confirmations;
      this.updated_at = result.rows[0].updated_at;
    }
    
    return this;
  }

  async cancel(reason = '') {
    if (this.status !== 'pending') {
      throw new Error('Can only cancel pending transactions');
    }

    const queryText = `
      UPDATE transactions 
      SET 
        status = 'canceled',
        notes = COALESCE(notes || ' | ', '') || $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await query(queryText, [reason, this.id]);
    
    if (result.rows[0]) {
      Object.assign(this, result.rows[0]);
    }
    
    return this;
  }

  isDeposit() {
    return this.type === 'deposit';
  }

  isWithdrawal() {
    return this.type === 'withdrawal';
  }

  isTrade() {
    return ['trade_buy', 'trade_sell'].includes(this.type);
  }

  isFee() {
    return this.type === 'fee';
  }

  isPending() {
    return this.status === 'pending';
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isFailed() {
    return this.status === 'failed';
  }

  isCanceled() {
    return this.status === 'canceled';
  }

  requiresConfirmations() {
    return this.isDeposit() && this.tx_hash && this.confirmations < this.getRequiredConfirmations();
  }

  getRequiredConfirmations() {
    // Define required confirmations per currency
    const confirmationRequirements = {
      'BTC': 6,
      'ETH': 12,
      'LTC': 6,
      'ADA': 15,
      'USDT': 12
    };
    
    return confirmationRequirements[this.currency] || 6;
  }

  getNetAmount() {
    return this.amount - this.fee;
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      wallet_id: this.wallet_id,
      type: this.type,
      currency: this.currency,
      amount: this.amount,
      fee: this.fee,
      net_amount: this.getNetAmount(),
      status: this.status,
      tx_hash: this.tx_hash,
      block_height: this.block_height,
      confirmations: this.confirmations,
      required_confirmations: this.getRequiredConfirmations(),
      external_id: this.external_id,
      notes: this.notes,
      created_at: this.created_at,
      updated_at: this.updated_at,
      completed_at: this.completed_at,
      requires_confirmations: this.requiresConfirmations()
    };
  }

  toPublic() {
    const { user_id, wallet_id, external_id, ...publicData } = this.toJSON();
    return publicData;
  }
}

module.exports = Transaction;