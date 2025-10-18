import { apiHelpers } from './api'

const tradingService = {
  // Get trading pairs
  getTradingPairs: async () => {
    return await apiHelpers.get('/api/trading/pairs')
  },

  // Get order book
  getOrderBook: async (tradingPair, depth = 20) => {
    return await apiHelpers.get(`/api/trading/orderbook/${tradingPair}`, { depth })
  },

  // Get recent trades
  getRecentTrades: async (tradingPair, limit = 50) => {
    return await apiHelpers.get(`/api/trading/trades/${tradingPair}`, { limit })
  },

  // Get 24h statistics
  get24hStats: async (tradingPair = null) => {
    const url = tradingPair ? 
      `/api/trading/stats/${tradingPair}` : 
      '/api/trading/stats'
    return await apiHelpers.get(url)
  },

  // Get OHLCV data
  getOHLCVData: async (tradingPair, interval = '1h', limit = 100) => {
    return await apiHelpers.get(`/api/trading/ohlcv/${tradingPair}`, {
      interval,
      limit
    })
  },

  // Place order
  placeOrder: async (orderData) => {
    // Set 2FA token if provided
    if (orderData.two_fa_token) {
      apiHelpers.set2FAToken(orderData.two_fa_token)
    }

    try {
      const result = await apiHelpers.post('/api/trading/orders', orderData)
      return result
    } finally {
      apiHelpers.set2FAToken(null)
    }
  },

  // Cancel order
  cancelOrder: async (orderId) => {
    return await apiHelpers.delete(`/api/trading/orders/${orderId}`)
  },

  // Cancel all orders
  cancelAllOrders: async (filters = {}) => {
    return await apiHelpers.delete('/api/trading/orders', { data: filters })
  },

  // Get user orders
  getUserOrders: async (options = {}) => {
    return await apiHelpers.get('/api/trading/orders', options)
  },

  // Get specific order
  getOrder: async (orderId) => {
    return await apiHelpers.get(`/api/trading/orders/${orderId}`)
  },

  // Get trade history
  getTradeHistory: async (options = {}) => {
    return await apiHelpers.get('/api/trading/trades', options)
  },

  // Get user trading statistics
  getUserTradingStats: async (period = '30d') => {
    return await apiHelpers.get('/api/trading/stats', { period })
  },

  // Get open orders count
  getOpenOrdersCount: async () => {
    return await apiHelpers.get('/api/trading/orders/count/open')
  },

  // Export trading data
  exportTradingData: async (type = 'orders', format = 'csv', options = {}) => {
    const filename = `${type}_${new Date().toISOString().split('T')[0]}.${format}`
    return await apiHelpers.downloadFile(`/api/trading/${type}/export`, filename, {
      format,
      ...options
    })
  },

  // Calculate order value
  calculateOrderValue: (quantity, price) => {
    return parseFloat(quantity) * parseFloat(price)
  },

  // Calculate trading fee
  calculateTradingFee: (quantity, price, feeRate = 0.001) => {
    const value = tradingService.calculateOrderValue(quantity, price)
    return value * feeRate
  },

  // Validate order data
  validateOrderData: (orderData, tradingPair) => {
    const errors = []

    // Required fields
    if (!orderData.order_type) {
      errors.push('Order type is required')
    }

    if (!orderData.side) {
      errors.push('Order side is required')
    }

    if (!orderData.quantity || parseFloat(orderData.quantity) <= 0) {
      errors.push('Valid quantity is required')
    }

    // Price validation for limit orders
    if (orderData.order_type === 'limit') {
      if (!orderData.price || parseFloat(orderData.price) <= 0) {
        errors.push('Valid price is required for limit orders')
      }
    }

    // Trading pair specific validations
    if (tradingPair) {
      const quantity = parseFloat(orderData.quantity)
      
      if (quantity < tradingPair.min_order_size) {
        errors.push(`Minimum order size is ${tradingPair.min_order_size}`)
      }

      if (quantity > tradingPair.max_order_size) {
        errors.push(`Maximum order size is ${tradingPair.max_order_size}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  // Format price according to trading pair precision
  formatPrice: (price, tradingPair) => {
    const precision = tradingPair?.price_precision || 2
    return parseFloat(price).toFixed(precision)
  },

  // Format quantity according to trading pair precision
  formatQuantity: (quantity, tradingPair) => {
    const precision = tradingPair?.quantity_precision || 8
    return parseFloat(quantity).toFixed(precision)
  },

  // Get market price for market orders
  getMarketPrice: (orderBook, side) => {
    if (side === 'buy' && orderBook.asks && orderBook.asks.length > 0) {
      return orderBook.asks[0].price
    } else if (side === 'sell' && orderBook.bids && orderBook.bids.length > 0) {
      return orderBook.bids[0].price
    }
    return 0
  },

  // Estimate market order execution
  estimateMarketOrderExecution: (orderBook, side, quantity) => {
    const levels = side === 'buy' ? orderBook.asks : orderBook.bids
    let remainingQuantity = parseFloat(quantity)
    let totalCost = 0
    let averagePrice = 0
    const executionLevels = []

    for (const level of levels) {
      if (remainingQuantity <= 0) {break}

      const levelQuantity = Math.min(remainingQuantity, level.quantity)
      const levelCost = levelQuantity * level.price

      executionLevels.push({
        price: level.price,
        quantity: levelQuantity,
        cost: levelCost
      })

      totalCost += levelCost
      remainingQuantity -= levelQuantity
    }

    if (remainingQuantity > 0) {
      return {
        canExecute: false,
        message: 'Insufficient liquidity',
        availableQuantity: parseFloat(quantity) - remainingQuantity
      }
    }

    averagePrice = totalCost / parseFloat(quantity)

    return {
      canExecute: true,
      averagePrice,
      totalCost,
      executionLevels,
      slippage: this.calculateSlippage(levels[0].price, averagePrice)
    }
  },

  // Calculate slippage
  calculateSlippage: (expectedPrice, actualPrice) => {
    if (expectedPrice === 0) {return 0}
    return Math.abs((actualPrice - expectedPrice) / expectedPrice) * 100
  },

  // Get order book depth
  getOrderBookDepth: (orderBook, percentage = 2) => {
    const midPrice = this.getMidPrice(orderBook)
    if (!midPrice) {return { bids: [], asks: [] }}

    const priceRange = midPrice * (percentage / 100)
    const minBidPrice = midPrice - priceRange
    const maxAskPrice = midPrice + priceRange

    return {
      bids: orderBook.bids.filter(level => level.price >= minBidPrice),
      asks: orderBook.asks.filter(level => level.price <= maxAskPrice)
    }
  },

  // Get mid price
  getMidPrice: (orderBook) => {
    if (!orderBook.bids.length || !orderBook.asks.length) {return 0}
    return (orderBook.bids[0].price + orderBook.asks[0].price) / 2
  },

  // Get spread
  getSpread: (orderBook) => {
    if (!orderBook.bids.length || !orderBook.asks.length) {return 0}
    return orderBook.asks[0].price - orderBook.bids[0].price
  },

  // Get spread percentage
  getSpreadPercentage: (orderBook) => {
    const spread = this.getSpread(orderBook)
    const midPrice = this.getMidPrice(orderBook)
    return midPrice > 0 ? (spread / midPrice) * 100 : 0
  },

  // Generate trading pair symbol
  generateTradingPairSymbol: (baseCurrency, quoteCurrency) => {
    return `${baseCurrency}-${quoteCurrency}`
  },

  // Parse trading pair symbol
  parseTradingPairSymbol: (symbol) => {
    const parts = symbol.split('-')
    return {
      baseCurrency: parts[0],
      quoteCurrency: parts[1]
    }
  },

  // Get order status color
  getOrderStatusColor: (status) => {
    const colors = {
      'open': 'text-primary-600',
      'partially_filled': 'text-warning-600',
      'filled': 'text-success-600',
      'canceled': 'text-gray-600',
      'expired': 'text-danger-600'
    }
    return colors[status] || 'text-gray-600'
  },

  // Get order status badge
  getOrderStatusBadge: (status) => {
    const badges = {
      'open': 'badge-primary',
      'partially_filled': 'badge-warning',
      'filled': 'badge-success',
      'canceled': 'badge-secondary',
      'expired': 'badge-danger'
    }
    return badges[status] || 'badge-secondary'
  },

  // Format trading pair display name
  formatTradingPairDisplay: (symbol) => {
    return symbol.replace('-', ' / ')
  },

  // Calculate profit/loss
  calculateProfitLoss: (trades, _baseCurrency) => {
    let totalBought = 0
    let totalSold = 0
    let totalBuyValue = 0
    let totalSellValue = 0

    trades.forEach(trade => {
      if (trade.user_side === 'buy') {
        totalBought += trade.quantity
        totalBuyValue += trade.value
      } else {
        totalSold += trade.quantity
        totalSellValue += trade.value
      }
    })

    const netQuantity = totalBought - totalSold
    const netValue = totalSellValue - totalBuyValue
    const averageBuyPrice = totalBought > 0 ? totalBuyValue / totalBought : 0
    const averageSellPrice = totalSold > 0 ? totalSellValue / totalSold : 0

    return {
      netQuantity,
      netValue,
      averageBuyPrice,
      averageSellPrice,
      totalFees: trades.reduce((sum, trade) => sum + (trade.user_fee || 0), 0),
      tradeCount: trades.length
    }
  },

  // Get trading recommendations (basic)
  getTradingRecommendations: (orderBook, recentTrades, stats24h) => {
    const recommendations = []

    // Check spread
    const spread = this.getSpreadPercentage(orderBook)
    if (spread > 1) {
      recommendations.push({
        type: 'warning',
        message: `High spread (${spread.toFixed(2)}%) - consider limit orders`
      })
    }

    // Check volume
    if (stats24h.volume && stats24h.volume < 1000) {
      recommendations.push({
        type: 'warning',
        message: 'Low trading volume - be cautious with large orders'
      })
    }

    // Check recent price movement
    if (stats24h.price_change_percent) {
      if (Math.abs(stats24h.price_change_percent) > 5) {
        recommendations.push({
          type: 'info',
          message: `High volatility (${stats24h.price_change_percent.toFixed(2)}%) detected`
        })
      }
    }

    return recommendations
  }
}

export default tradingService