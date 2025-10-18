const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Trade {
  constructor(data) {
    this.id = data.id;
    this.buy_order_id = data.buy_order_id;
    this.sell_order_id = data.sell_order_id;
    this.trading_pair_id = data.trading_pair_id;
    this.price = parseFloat(data.price);
    this.quantity = parseFloat(data.quantity);
    this.buyer_fee = parseFloat(data.buyer_fee) || 0;
    this.seller_fee = parseFloat(data.seller_fee) || 0;
    this.timestamp = data.timestamp;
    
    // Additional fields that might be joined
    this.trading_pair_symbol = data.trading_pair_symbol;
    this.base_currency = data.base_currency;
    this.quote_currency = data.quote_currency;
  }

  static async create({
    buy_order_id,
    sell_order_id,
    trading_pair_id,
    price,
    quantity,
    buyer_fee = 0,
    seller_fee = 0
  }) {
    const id = uuidv4();
    
    const queryText = `
      INSERT INTO trades (
        id, buy_order_id, sell_order_id, trading_pair_id,
        price, quantity, buyer_fee, seller_fee
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await query(queryText, [
      id, buy_order_id, sell_order_id, trading_pair_id,
      price, quantity, buyer_fee, seller_fee
    ]);
    
    return new Trade(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM trades WHERE id = $1', [id]);
    return result.rows[0] ? new Trade(result.rows[0]) : null;
  }

  static async findByOrderId(order_id) {
    const queryText = `
      SELECT t.*, tp.symbol as trading_pair_symbol, tp.base_currency, tp.quote_currency
      FROM trades t
      JOIN trading_pairs tp ON t.trading_pair_id = tp.id
      WHERE t.buy_order_id = $1 OR t.sell_order_id = $1
      ORDER BY t.timestamp DESC
    `;
    
    const result = await query(queryText, [order_id]);
    return result.rows.map(row => new Trade(row));
  }

  static async findByUserId(user_id, options = {}) {
    const {
      trading_pair_id = null,
      limit = 50,
      offset = 0,
      start_date = null,
      end_date = null
    } = options;

    let queryText = `
      SELECT t.*, tp.symbol as trading_pair_symbol, tp.base_currency, tp.quote_currency,
             CASE 
               WHEN bo.user_id = $1 THEN 'buy'
               WHEN so.user_id = $1 THEN 'sell'
             END as user_side,
             CASE 
               WHEN bo.user_id = $1 THEN t.buyer_fee
               WHEN so.user_id = $1 THEN t.seller_fee
             END as user_fee
      FROM trades t
      JOIN trading_pairs tp ON t.trading_pair_id = tp.id
      LEFT JOIN orders bo ON t.buy_order_id = bo.id
      LEFT JOIN orders so ON t.sell_order_id = so.id
      WHERE (bo.user_id = $1 OR so.user_id = $1)
    `;
    
    const params = [user_id];
    let paramCount = 1;

    if (trading_pair_id) {
      queryText += ` AND t.trading_pair_id = $${++paramCount}`;
      params.push(trading_pair_id);
    }

    if (start_date) {
      queryText += ` AND t.timestamp >= $${++paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      queryText += ` AND t.timestamp <= $${++paramCount}`;
      params.push(end_date);
    }

    queryText += ` ORDER BY t.timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    return result.rows.map(row => {
      const trade = new Trade(row);
      trade.user_side = row.user_side;
      trade.user_fee = parseFloat(row.user_fee) || 0;
      return trade;
    });
  }

  static async findByTradingPair(trading_pair_id, options = {}) {
    const {
      limit = 100,
      offset = 0,
      start_date = null,
      end_date = null
    } = options;

    let queryText = `
      SELECT t.*, tp.symbol as trading_pair_symbol, tp.base_currency, tp.quote_currency
      FROM trades t
      JOIN trading_pairs tp ON t.trading_pair_id = tp.id
      WHERE t.trading_pair_id = $1
    `;
    
    const params = [trading_pair_id];
    let paramCount = 1;

    if (start_date) {
      queryText += ` AND t.timestamp >= $${++paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      queryText += ` AND t.timestamp <= $${++paramCount}`;
      params.push(end_date);
    }

    queryText += ` ORDER BY t.timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    return result.rows.map(row => new Trade(row));
  }

  static async getRecentTrades(trading_pair_id, limit = 50) {
    const queryText = `
      SELECT t.*, tp.symbol as trading_pair_symbol
      FROM trades t
      JOIN trading_pairs tp ON t.trading_pair_id = tp.id
      WHERE t.trading_pair_id = $1
      ORDER BY t.timestamp DESC
      LIMIT $2
    `;
    
    const result = await query(queryText, [trading_pair_id, limit]);
    return result.rows.map(row => new Trade(row));
  }

  static async get24hStats(trading_pair_id) {
    const queryText = `
      WITH price_data AS (
        SELECT
          price,
          quantity,
          timestamp,
          ROW_NUMBER() OVER (ORDER BY timestamp ASC) as first_row,
          ROW_NUMBER() OVER (ORDER BY timestamp DESC) as last_row
        FROM trades
        WHERE trading_pair_id = $1
          AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      )
      SELECT
        COUNT(*) as trade_count,
        SUM(quantity) as volume,
        SUM(price * quantity) as quote_volume,
        MIN(price) as low_price,
        MAX(price) as high_price,
        MAX(CASE WHEN first_row = 1 THEN price END) as open_price,
        MAX(CASE WHEN last_row = 1 THEN price END) as close_price,
        AVG(price) as avg_price
      FROM price_data
    `;

    const result = await query(queryText, [trading_pair_id]);
    const stats = result.rows[0];

    if (!stats || stats.trade_count === '0') {
      return {
        trade_count: 0,
        volume: 0,
        quote_volume: 0,
        low_price: 0,
        high_price: 0,
        open_price: 0,
        close_price: 0,
        avg_price: 0,
        price_change: 0,
        price_change_percent: 0
      };
    }

    const price_change = parseFloat(stats.close_price) - parseFloat(stats.open_price);
    const price_change_percent = parseFloat(stats.open_price) > 0
      ? (price_change / parseFloat(stats.open_price)) * 100
      : 0;

    return {
      trade_count: parseInt(stats.trade_count),
      volume: parseFloat(stats.volume),
      quote_volume: parseFloat(stats.quote_volume),
      low_price: parseFloat(stats.low_price),
      high_price: parseFloat(stats.high_price),
      open_price: parseFloat(stats.open_price),
      close_price: parseFloat(stats.close_price),
      avg_price: parseFloat(stats.avg_price),
      price_change,
      price_change_percent
    };
  }

  static async getOHLCVData(trading_pair_id, interval = '1h', limit = 100) {
    const intervalMap = {
      '1m': '1 minute',
      '5m': '5 minutes',
      '15m': '15 minutes',
      '1h': '1 hour',
      '4h': '4 hours',
      '1d': '1 day'
    };

    const intervalStr = intervalMap[interval] || '1 hour';
    const truncPeriod = interval === '1d' ? 'day' : 'hour';

    const queryText = `
      WITH price_data AS (
        SELECT
          date_trunc('${truncPeriod}', timestamp) as period,
          price,
          quantity,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY date_trunc('${truncPeriod}', timestamp) ORDER BY timestamp ASC) as first_row,
          ROW_NUMBER() OVER (PARTITION BY date_trunc('${truncPeriod}', timestamp) ORDER BY timestamp DESC) as last_row
        FROM trades
        WHERE trading_pair_id = $1
          AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${limit} ${intervalStr}'
      )
      SELECT
        period,
        MAX(CASE WHEN first_row = 1 THEN price END) as open,
        MAX(price) as high,
        MIN(price) as low,
        MAX(CASE WHEN last_row = 1 THEN price END) as close,
        SUM(quantity) as volume,
        COUNT(*) as trade_count
      FROM price_data
      GROUP BY period
      ORDER BY period DESC
      LIMIT $2
    `;

    const result = await query(queryText, [trading_pair_id, limit]);
    return result.rows.map(row => ({
      timestamp: row.period,
      open: parseFloat(row.open) || 0,
      high: parseFloat(row.high) || 0,
      low: parseFloat(row.low) || 0,
      close: parseFloat(row.close) || 0,
      volume: parseFloat(row.volume) || 0,
      trade_count: parseInt(row.trade_count) || 0
    }));
  }

  static async getUserTradingStats(user_id, period = '30d') {
    const interval = period === '7d' ? '7 days' : period === '1d' ? '1 day' : '30 days';
    
    const queryText = `
      SELECT 
        tp.symbol as trading_pair,
        COUNT(*) as trade_count,
        SUM(t.quantity) as total_volume,
        SUM(CASE WHEN bo.user_id = $1 THEN t.buyer_fee ELSE t.seller_fee END) as total_fees,
        SUM(CASE WHEN bo.user_id = $1 THEN t.price * t.quantity ELSE 0 END) as buy_volume,
        SUM(CASE WHEN so.user_id = $1 THEN t.price * t.quantity ELSE 0 END) as sell_volume
      FROM trades t
      JOIN trading_pairs tp ON t.trading_pair_id = tp.id
      LEFT JOIN orders bo ON t.buy_order_id = bo.id
      LEFT JOIN orders so ON t.sell_order_id = so.id
      WHERE (bo.user_id = $1 OR so.user_id = $1)
        AND t.timestamp >= CURRENT_TIMESTAMP - INTERVAL '${interval}'
      GROUP BY tp.symbol, tp.id
      ORDER BY total_volume DESC
    `;
    
    const result = await query(queryText, [user_id]);
    return result.rows.map(row => ({
      trading_pair: row.trading_pair,
      trade_count: parseInt(row.trade_count),
      total_volume: parseFloat(row.total_volume),
      total_fees: parseFloat(row.total_fees),
      buy_volume: parseFloat(row.buy_volume),
      sell_volume: parseFloat(row.sell_volume)
    }));
  }

  getValue() {
    return this.price * this.quantity;
  }

  getTotalFees() {
    return this.buyer_fee + this.seller_fee;
  }

  toJSON() {
    return {
      id: this.id,
      buy_order_id: this.buy_order_id,
      sell_order_id: this.sell_order_id,
      trading_pair_id: this.trading_pair_id,
      trading_pair_symbol: this.trading_pair_symbol,
      base_currency: this.base_currency,
      quote_currency: this.quote_currency,
      price: this.price,
      quantity: this.quantity,
      value: this.getValue(),
      buyer_fee: this.buyer_fee,
      seller_fee: this.seller_fee,
      total_fees: this.getTotalFees(),
      timestamp: this.timestamp,
      user_side: this.user_side,
      user_fee: this.user_fee
    };
  }

  toPublic() {
    return {
      id: this.id,
      trading_pair_symbol: this.trading_pair_symbol,
      price: this.price,
      quantity: this.quantity,
      value: this.getValue(),
      timestamp: this.timestamp
    };
  }

  toMarketData() {
    return {
      price: this.price,
      quantity: this.quantity,
      timestamp: this.timestamp,
      side: this.user_side // If available
    };
  }
}

module.exports = Trade;