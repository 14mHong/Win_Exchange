const Order = require('../models/Order');
const Trade = require('../models/Trade');
const TradingPair = require('../models/TradingPair');
const Wallet = require('../models/Wallet');
const WalletService = require('./WalletService');
const Transaction = require('../models/Transaction');
const { transaction } = require('../config/database');
const logger = require('../config/logger');
const EventEmitter = require('events');

class TradingEngine extends EventEmitter {
  constructor() {
    super();
    this.isProcessing = new Map(); // Track processing status per trading pair
    this.orderBooks = new Map(); // In-memory order books for performance
  }

  // Place a new order
  async placeOrder(userId, {
    trading_pair_symbol,
    order_type,
    side,
    quantity,
    price = null,
    time_in_force = 'GTC'
  }) {
    try {
      // Validate trading pair
      const tradingPair = await TradingPair.findBySymbol(trading_pair_symbol);
      if (!tradingPair || !tradingPair.is_active) {
        throw new Error('Invalid or inactive trading pair');
      }

      // Validate order parameters
      this.validateOrderParameters({
        tradingPair,
        order_type,
        side,
        quantity,
        price
      });

      // Check and lock user funds
      await this.checkAndLockFunds(userId, tradingPair, side, quantity, price, order_type);

      // Create order
      const order = await Order.create({
        user_id: userId,
        trading_pair_id: tradingPair.id,
        order_type,
        side,
        price: order_type === 'limit' ? price : null,
        quantity,
        time_in_force
      });

      logger.logUserAction(userId, 'ORDER_PLACED', {
        orderId: order.id,
        tradingPair: trading_pair_symbol,
        orderType: order_type,
        side,
        quantity,
        price
      });

      // Process order matching
      await this.processOrderMatching(order, tradingPair);

      // Emit order placed event
      this.emit('orderPlaced', {
        order: order.toPublic(),
        tradingPair: tradingPair.toJSON()
      });

      return {
        success: true,
        order: order.toJSON(),
        message: 'Order placed successfully'
      };
    } catch (error) {
      logger.error('Place order error:', error);
      throw error;
    }
  }

  // Cancel an existing order
  async cancelOrder(userId, orderId) {
    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.user_id !== userId) {
        throw new Error('Access denied');
      }

      if (!order.isOpen()) {
        throw new Error('Cannot cancel order that is not open');
      }

      // Get trading pair
      const tradingPair = await TradingPair.findById(order.trading_pair_id);
      
      // Release locked funds
      await this.releaseFunds(userId, tradingPair, order);

      // Cancel order
      await order.cancel('User requested cancellation');

      logger.logUserAction(userId, 'ORDER_CANCELED', {
        orderId: order.id,
        tradingPair: tradingPair.symbol
      });

      // Emit order canceled event
      this.emit('orderCanceled', {
        order: order.toPublic(),
        tradingPair: tradingPair.toJSON()
      });

      return {
        success: true,
        order: order.toJSON(),
        message: 'Order canceled successfully'
      };
    } catch (error) {
      logger.error('Cancel order error:', error);
      throw error;
    }
  }

  // Validate order parameters
  validateOrderParameters({ tradingPair, order_type, side, quantity, price }) {
    // Validate order type
    if (!['market', 'limit'].includes(order_type)) {
      throw new Error('Invalid order type');
    }

    // Validate side
    if (!['buy', 'sell'].includes(side)) {
      throw new Error('Invalid order side');
    }

    // Validate quantity
    if (!tradingPair.validateOrderSize(quantity)) {
      throw new Error(`Quantity must be between ${tradingPair.min_order_size} and ${tradingPair.max_order_size}`);
    }

    // Validate price for limit orders
    if (order_type === 'limit') {
      if (!price || price <= 0) {
        throw new Error('Price is required for limit orders');
      }
    }
  }

  // Check and lock user funds
  async checkAndLockFunds(userId, tradingPair, side, quantity, price, order_type) {
    if (side === 'buy') {
      // For buy orders, need quote currency
      const quoteWallet = await WalletService.getUserWallet(userId, tradingPair.quote_currency);
      
      let requiredAmount;
      if (order_type === 'market') {
        // For market orders, estimate based on current market price
        const orderBook = await Order.getOrderBook(tradingPair.id, 1);
        if (orderBook.asks.length === 0) {
          throw new Error('No asks available for market buy order');
        }
        requiredAmount = quantity * orderBook.asks[0].price * 1.1; // 10% buffer for market orders
      } else {
        requiredAmount = quantity * price;
      }

      if (!quoteWallet.canLock(requiredAmount)) {
        throw new Error(`Insufficient ${tradingPair.quote_currency} balance`);
      }

      await quoteWallet.lockBalance(requiredAmount);
    } else {
      // For sell orders, need base currency
      const baseWallet = await WalletService.getUserWallet(userId, tradingPair.base_currency);
      
      if (!baseWallet.canLock(quantity)) {
        throw new Error(`Insufficient ${tradingPair.base_currency} balance`);
      }

      await baseWallet.lockBalance(quantity);
    }
  }

  // Release locked funds when order is canceled or fails
  async releaseFunds(userId, tradingPair, order) {
    if (order.isBuy()) {
      const quoteWallet = await WalletService.getUserWallet(userId, tradingPair.quote_currency);
      const lockedAmount = order.remaining_quantity * (order.price || 0);
      if (lockedAmount > 0) {
        await quoteWallet.unlockBalance(lockedAmount);
      }
    } else {
      const baseWallet = await WalletService.getUserWallet(userId, tradingPair.base_currency);
      if (order.remaining_quantity > 0) {
        await baseWallet.unlockBalance(order.remaining_quantity);
      }
    }
  }

  // Process order matching
  async processOrderMatching(newOrder, tradingPair) {
    const tradingPairId = tradingPair.id;
    
    // Prevent concurrent processing for the same trading pair
    if (this.isProcessing.get(tradingPairId)) {
      return;
    }

    this.isProcessing.set(tradingPairId, true);

    try {
      // Get opposite side orders
      const oppositeSide = newOrder.isBuy() ? 'sell' : 'buy';
      const matchingOrders = await Order.findOpenOrders(tradingPairId, oppositeSide);

      // Process matches
      for (const matchingOrder of matchingOrders) {
        if (!newOrder.isOpen() || !matchingOrder.isOpen()) {
          continue;
        }

        if (newOrder.canMatch(matchingOrder)) {
          await this.executeMatch(newOrder, matchingOrder, tradingPair);
        }

        // Stop if the new order is fully filled
        if (newOrder.isCompleted()) {
          break;
        }
      }

      // Handle market order that couldn't be fully filled
      if (newOrder.isMarketOrder() && newOrder.isOpen()) {
        await this.handleUnfilledMarketOrder(newOrder, tradingPair);
      }

    } finally {
      this.isProcessing.set(tradingPairId, false);
    }
  }

  // Execute a match between two orders
  async executeMatch(order1, order2, tradingPair) {
    return await transaction(async (client) => {
      try {
        // Determine buy and sell orders
        const buyOrder = order1.isBuy() ? order1 : order2;
        const sellOrder = order1.isSell() ? order1 : order2;

        // Determine match price and quantity
        const matchPrice = buyOrder.getMatchPrice(sellOrder);
        const matchQuantity = Math.min(buyOrder.getFillableQuantity(), sellOrder.getFillableQuantity());

        // Calculate fees
        const fees = tradingPair.getTradingFees();
        const buyerFee = matchQuantity * matchPrice * fees.taker_fee;
        const sellerFee = matchQuantity * fees.maker_fee;

        // Create trade record
        const trade = await Trade.create({
          buy_order_id: buyOrder.id,
          sell_order_id: sellOrder.id,
          trading_pair_id: tradingPair.id,
          price: matchPrice,
          quantity: matchQuantity,
          buyer_fee: buyerFee,
          seller_fee: sellerFee
        });

        // Update orders
        await buyOrder.updateFill(matchQuantity, matchPrice);
        await sellOrder.updateFill(matchQuantity, matchPrice);

        // Process wallet updates
        await this.processTradeSettlement(trade, tradingPair, buyOrder, sellOrder);

        // Log trade execution
        logger.logTradeExecution({
          id: trade.id,
          trading_pair: tradingPair.symbol,
          price: matchPrice,
          quantity: matchQuantity,
          buy_order_id: buyOrder.id,
          sell_order_id: sellOrder.id
        });

        // Emit trade executed event
        this.emit('tradeExecuted', {
          trade: trade.toJSON(),
          tradingPair: tradingPair.toJSON(),
          buyOrder: buyOrder.toPublic(),
          sellOrder: sellOrder.toPublic()
        });

        return trade;
      } catch (error) {
        logger.error('Trade execution error:', error);
        throw error;
      }
    });
  }

  // Process trade settlement (update wallets)
  async processTradeSettlement(trade, tradingPair, buyOrder, sellOrder) {
    // Get wallets
    const buyerBaseWallet = await WalletService.getUserWallet(buyOrder.user_id, tradingPair.base_currency);
    const buyerQuoteWallet = await WalletService.getUserWallet(buyOrder.user_id, tradingPair.quote_currency);
    const sellerBaseWallet = await WalletService.getUserWallet(sellOrder.user_id, tradingPair.base_currency);
    const sellerQuoteWallet = await WalletService.getUserWallet(sellOrder.user_id, tradingPair.quote_currency);

    const tradeValue = trade.price * trade.quantity;

    // Buyer: Give quote currency, receive base currency
    await buyerQuoteWallet.releaseLockedBalance(tradeValue + trade.buyer_fee);
    await buyerBaseWallet.updateBalance(trade.quantity);

    // Seller: Give base currency, receive quote currency
    await sellerBaseWallet.releaseLockedBalance(trade.quantity);
    await sellerQuoteWallet.updateBalance(tradeValue - trade.seller_fee);

    // Create transaction records
    await Transaction.create({
      user_id: buyOrder.user_id,
      wallet_id: buyerBaseWallet.id,
      type: 'trade_buy',
      currency: tradingPair.base_currency,
      amount: trade.quantity,
      status: 'completed',
      notes: `Trade execution - Buy ${tradingPair.symbol}`
    });

    await Transaction.create({
      user_id: buyOrder.user_id,
      wallet_id: buyerQuoteWallet.id,
      type: 'trade_sell',
      currency: tradingPair.quote_currency,
      amount: -(tradeValue + trade.buyer_fee),
      status: 'completed',
      notes: `Trade execution - Buy ${tradingPair.symbol}`
    });

    await Transaction.create({
      user_id: sellOrder.user_id,
      wallet_id: sellerBaseWallet.id,
      type: 'trade_sell',
      currency: tradingPair.base_currency,
      amount: -trade.quantity,
      status: 'completed',
      notes: `Trade execution - Sell ${tradingPair.symbol}`
    });

    await Transaction.create({
      user_id: sellOrder.user_id,
      wallet_id: sellerQuoteWallet.id,
      type: 'trade_buy',
      currency: tradingPair.quote_currency,
      amount: tradeValue - trade.seller_fee,
      status: 'completed',
      notes: `Trade execution - Sell ${tradingPair.symbol}`
    });

    // Record fees
    if (trade.buyer_fee > 0) {
      await Transaction.create({
        user_id: buyOrder.user_id,
        wallet_id: buyerQuoteWallet.id,
        type: 'fee',
        currency: tradingPair.quote_currency,
        amount: -trade.buyer_fee,
        status: 'completed',
        notes: `Trading fee - ${tradingPair.symbol}`
      });
    }

    if (trade.seller_fee > 0) {
      await Transaction.create({
        user_id: sellOrder.user_id,
        wallet_id: sellerQuoteWallet.id,
        type: 'fee',
        currency: tradingPair.quote_currency,
        amount: -trade.seller_fee,
        status: 'completed',
        notes: `Trading fee - ${tradingPair.symbol}`
      });
    }
  }

  // Handle unfilled market orders
  async handleUnfilledMarketOrder(order, tradingPair) {
    // Cancel remaining quantity for market orders that couldn't be filled
    await this.releaseFunds(order.user_id, tradingPair, order);
    await order.cancel('Market order partially filled - remaining quantity canceled');
  }

  // Get order book for a trading pair
  async getOrderBook(tradingPairSymbol, depth = 20) {
    try {
      const tradingPair = await TradingPair.findBySymbol(tradingPairSymbol);
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      const orderBook = await Order.getOrderBook(tradingPair.id, depth);
      
      return {
        success: true,
        trading_pair: tradingPair.symbol,
        timestamp: new Date().toISOString(),
        bids: orderBook.bids,
        asks: orderBook.asks
      };
    } catch (error) {
      logger.error('Get order book error:', error);
      throw error;
    }
  }

  // Get recent trades for a trading pair
  async getRecentTrades(tradingPairSymbol, limit = 50) {
    try {
      const tradingPair = await TradingPair.findBySymbol(tradingPairSymbol);
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      const trades = await Trade.getRecentTrades(tradingPair.id, limit);
      
      return {
        success: true,
        trading_pair: tradingPair.symbol,
        trades: trades.map(trade => trade.toMarketData())
      };
    } catch (error) {
      logger.error('Get recent trades error:', error);
      throw error;
    }
  }

  // Get 24h statistics for a trading pair
  async get24hStats(tradingPairSymbol) {
    try {
      const tradingPair = await TradingPair.findBySymbol(tradingPairSymbol);
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      const stats = await Trade.get24hStats(tradingPair.id);
      
      return {
        success: true,
        trading_pair: tradingPair.symbol,
        stats
      };
    } catch (error) {
      logger.error('Get 24h stats error:', error);
      throw error;
    }
  }

  // Get OHLCV data for charts
  async getOHLCVData(tradingPairSymbol, interval = '1h', limit = 100) {
    try {
      const tradingPair = await TradingPair.findBySymbol(tradingPairSymbol);
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      const ohlcvData = await Trade.getOHLCVData(tradingPair.id, interval, limit);
      
      return {
        success: true,
        trading_pair: tradingPair.symbol,
        interval,
        data: ohlcvData
      };
    } catch (error) {
      logger.error('Get OHLCV data error:', error);
      throw error;
    }
  }
}

// Singleton instance
const tradingEngine = new TradingEngine();

module.exports = tradingEngine;