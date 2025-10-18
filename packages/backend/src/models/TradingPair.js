const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class TradingPair {
  constructor(data) {
    this.id = data.id;
    this.symbol = data.symbol;
    this.base_currency = data.base_currency;
    this.quote_currency = data.quote_currency;
    this.min_order_size = parseFloat(data.min_order_size);
    this.max_order_size = parseFloat(data.max_order_size);
    this.price_precision = data.price_precision;
    this.quantity_precision = data.quantity_precision;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
  }

  static async findAll() {
    const result = await query('SELECT * FROM trading_pairs ORDER BY symbol');
    return result.rows.map(row => new TradingPair(row));
  }

  static async findActive() {
    const result = await query('SELECT * FROM trading_pairs WHERE is_active = true ORDER BY symbol');
    return result.rows.map(row => new TradingPair(row));
  }

  static async findBySymbol(symbol) {
    const result = await query('SELECT * FROM trading_pairs WHERE symbol = $1', [symbol]);
    return result.rows[0] ? new TradingPair(result.rows[0]) : null;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM trading_pairs WHERE id = $1', [id]);
    return result.rows[0] ? new TradingPair(result.rows[0]) : null;
  }

  static async create({
    symbol,
    base_currency,
    quote_currency,
    min_order_size,
    max_order_size,
    price_precision,
    quantity_precision
  }) {
    const id = uuidv4();
    
    const queryText = `
      INSERT INTO trading_pairs (
        id, symbol, base_currency, quote_currency, 
        min_order_size, max_order_size, price_precision, quantity_precision
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await query(queryText, [
      id, symbol, base_currency, quote_currency,
      min_order_size, max_order_size, price_precision, quantity_precision
    ]);
    
    return new TradingPair(result.rows[0]);
  }

  async updateStatus(is_active) {
    const queryText = 'UPDATE trading_pairs SET is_active = $1 WHERE id = $2 RETURNING *';
    const result = await query(queryText, [is_active, this.id]);
    
    if (result.rows[0]) {
      this.is_active = result.rows[0].is_active;
    }
    
    return this;
  }

  validateOrderSize(quantity) {
    return quantity >= this.min_order_size && quantity <= this.max_order_size;
  }

  formatPrice(price) {
    return parseFloat(price.toFixed(this.price_precision));
  }

  formatQuantity(quantity) {
    return parseFloat(quantity.toFixed(this.quantity_precision));
  }

  getTradingFees() {
    // Default trading fees (can be made configurable)
    return {
      maker_fee: 0.001, // 0.1%
      taker_fee: 0.001  // 0.1%
    };
  }

  toJSON() {
    return {
      id: this.id,
      symbol: this.symbol,
      base_currency: this.base_currency,
      quote_currency: this.quote_currency,
      min_order_size: this.min_order_size,
      max_order_size: this.max_order_size,
      price_precision: this.price_precision,
      quantity_precision: this.quantity_precision,
      is_active: this.is_active,
      fees: this.getTradingFees(),
      created_at: this.created_at
    };
  }
}

module.exports = TradingPair;