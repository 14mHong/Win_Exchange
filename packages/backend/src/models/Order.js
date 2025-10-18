const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Order {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.trading_pair_id = data.trading_pair_id;
    this.order_type = data.order_type;
    this.side = data.side;
    this.price = data.price ? parseFloat(data.price) : null;
    this.quantity = parseFloat(data.quantity);
    this.filled_quantity = parseFloat(data.filled_quantity) || 0;
    this.remaining_quantity = parseFloat(data.remaining_quantity) || this.quantity;
    this.status = data.status;
    this.time_in_force = data.time_in_force;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.filled_at = data.filled_at;
    this.canceled_at = data.canceled_at;
  }

  static async create({
    user_id,
    trading_pair_id,
    order_type,
    side,
    price,
    quantity,
    time_in_force = 'GTC'
  }) {
    const id = uuidv4();
    const remaining_quantity = quantity;
    
    const queryText = `
      INSERT INTO orders (
        id, user_id, trading_pair_id, order_type, side, 
        price, quantity, remaining_quantity, time_in_force
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await query(queryText, [
      id, user_id, trading_pair_id, order_type, side,
      price, quantity, remaining_quantity, time_in_force
    ]);
    
    return new Order(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] ? new Order(result.rows[0]) : null;
  }

  static async findByUserId(user_id, options = {}) {
    const {
      status = null,
      trading_pair_id = null,
      side = null,
      limit = 50,
      offset = 0
    } = options;

    let queryText = `
      SELECT o.*, tp.symbol as trading_pair_symbol
      FROM orders o
      JOIN trading_pairs tp ON o.trading_pair_id = tp.id
      WHERE o.user_id = $1
    `;
    
    const params = [user_id];
    let paramCount = 1;

    if (status) {
      queryText += ` AND o.status = $${++paramCount}`;
      params.push(status);
    }

    if (trading_pair_id) {
      queryText += ` AND o.trading_pair_id = $${++paramCount}`;
      params.push(trading_pair_id);
    }

    if (side) {
      queryText += ` AND o.side = $${++paramCount}`;
      params.push(side);
    }

    queryText += ` ORDER BY o.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    return result.rows.map(row => {
      const order = new Order(row);
      order.trading_pair_symbol = row.trading_pair_symbol;
      return order;
    });
  }

  static async findOpenOrders(trading_pair_id = null, side = null) {
    let queryText = `
      SELECT o.*, tp.symbol as trading_pair_symbol
      FROM orders o
      JOIN trading_pairs tp ON o.trading_pair_id = tp.id
      WHERE o.status = 'open'
    `;
    
    const params = [];
    let paramCount = 0;

    if (trading_pair_id) {
      queryText += ` AND o.trading_pair_id = $${++paramCount}`;
      params.push(trading_pair_id);
    }

    if (side) {
      queryText += ` AND o.side = $${++paramCount}`;
      params.push(side);
    }

    queryText += ` ORDER BY 
      CASE WHEN o.side = 'buy' THEN o.price END DESC,
      CASE WHEN o.side = 'sell' THEN o.price END ASC,
      o.created_at ASC
    `;

    const result = await query(queryText, params);
    return result.rows.map(row => {
      const order = new Order(row);
      order.trading_pair_symbol = row.trading_pair_symbol;
      return order;
    });
  }

  static async getOrderBook(trading_pair_id, depth = 20) {
    const queryText = `
      SELECT 
        side,
        price,
        SUM(remaining_quantity) as total_quantity,
        COUNT(*) as order_count
      FROM orders
      WHERE trading_pair_id = $1 AND status = 'open'
      GROUP BY side, price
      ORDER BY 
        side,
        CASE WHEN side = 'buy' THEN price END DESC,
        CASE WHEN side = 'sell' THEN price END ASC
    `;

    const result = await query(queryText, [trading_pair_id]);
    
    const orderBook = {
      bids: [],
      asks: []
    };

    result.rows.forEach(row => {
      const level = {
        price: parseFloat(row.price),
        quantity: parseFloat(row.total_quantity),
        order_count: parseInt(row.order_count)
      };

      if (row.side === 'buy') {
        orderBook.bids.push(level);
      } else {
        orderBook.asks.push(level);
      }
    });

    // Limit depth
    orderBook.bids = orderBook.bids.slice(0, depth);
    orderBook.asks = orderBook.asks.slice(0, depth);

    return orderBook;
  }

  async updateFill(filled_quantity, filled_price = null) {
    const new_filled_quantity = this.filled_quantity + filled_quantity;
    const new_remaining_quantity = this.quantity - new_filled_quantity;
    
    let status = 'open';
    if (new_remaining_quantity <= 0) {
      status = 'filled';
    } else if (new_filled_quantity > 0) {
      status = 'partially_filled';
    }

    const queryText = `
      UPDATE orders 
      SET 
        filled_quantity = $1,
        remaining_quantity = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP,
        filled_at = CASE WHEN $3 = 'filled' THEN CURRENT_TIMESTAMP ELSE filled_at END
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await query(queryText, [
      new_filled_quantity,
      new_remaining_quantity,
      status,
      this.id
    ]);
    
    if (result.rows[0]) {
      Object.assign(this, result.rows[0]);
      this.price = this.price ? parseFloat(this.price) : null;
      this.quantity = parseFloat(this.quantity);
      this.filled_quantity = parseFloat(this.filled_quantity);
      this.remaining_quantity = parseFloat(this.remaining_quantity);
    }
    
    return this;
  }

  async cancel(reason = '') {
    if (this.status !== 'open' && this.status !== 'partially_filled') {
      throw new Error('Cannot cancel order that is not open or partially filled');
    }

    const queryText = `
      UPDATE orders 
      SET 
        status = 'canceled',
        canceled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [this.id]);
    
    if (result.rows[0]) {
      Object.assign(this, result.rows[0]);
    }
    
    return this;
  }

  async expire() {
    const queryText = `
      UPDATE orders 
      SET 
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [this.id]);
    
    if (result.rows[0]) {
      Object.assign(this, result.rows[0]);
    }
    
    return this;
  }

  isBuy() {
    return this.side === 'buy';
  }

  isSell() {
    return this.side === 'sell';
  }

  isMarketOrder() {
    return this.order_type === 'market';
  }

  isLimitOrder() {
    return this.order_type === 'limit';
  }

  isOpen() {
    return this.status === 'open' || this.status === 'partially_filled';
  }

  isCompleted() {
    return this.status === 'filled';
  }

  isCanceled() {
    return this.status === 'canceled';
  }

  isExpired() {
    return this.status === 'expired';
  }

  canMatch(other_order) {
    // Basic matching logic
    if (this.trading_pair_id !== other_order.trading_pair_id) return false;
    if (this.side === other_order.side) return false;
    if (!this.isOpen() || !other_order.isOpen()) return false;

    // Price matching
    if (this.isMarketOrder() || other_order.isMarketOrder()) {
      return true;
    }

    // For limit orders
    if (this.isBuy() && other_order.isSell()) {
      return this.price >= other_order.price;
    } else if (this.isSell() && other_order.isBuy()) {
      return this.price <= other_order.price;
    }

    return false;
  }

  getMatchPrice(other_order) {
    // Market orders use the price of the limit order
    if (this.isMarketOrder()) {
      return other_order.price;
    }
    if (other_order.isMarketOrder()) {
      return this.price;
    }

    // For limit orders, use the price of the earlier order (price-time priority)
    return new Date(this.created_at) < new Date(other_order.created_at) 
      ? this.price 
      : other_order.price;
  }

  getFillableQuantity() {
    return this.remaining_quantity;
  }

  getRequiredQuoteAmount() {
    if (this.isBuy()) {
      return this.remaining_quantity * (this.price || 0);
    }
    return 0;
  }

  getRequiredBaseAmount() {
    if (this.isSell()) {
      return this.remaining_quantity;
    }
    return 0;
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      trading_pair_id: this.trading_pair_id,
      trading_pair_symbol: this.trading_pair_symbol || null,
      order_type: this.order_type,
      side: this.side,
      price: this.price,
      quantity: this.quantity,
      filled_quantity: this.filled_quantity,
      remaining_quantity: this.remaining_quantity,
      fill_percentage: (this.filled_quantity / this.quantity) * 100,
      status: this.status,
      time_in_force: this.time_in_force,
      created_at: this.created_at,
      updated_at: this.updated_at,
      filled_at: this.filled_at,
      canceled_at: this.canceled_at
    };
  }

  toPublic() {
    const { user_id, ...publicData } = this.toJSON();
    return publicData;
  }
}

module.exports = Order;