import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import tradingService from '@/services/tradingService'
import { useNotificationStore } from './notification'
import { useWebSocketStore } from './websocket'

export const useTrading = defineStore('trading', () => {
  // State
  const tradingPairs = ref([])
  const selectedPair = ref(null)
  const orderBook = ref({ bids: [], asks: [] })
  const recentTrades = ref([])
  const userOrders = ref([])
  const userTrades = ref([])
  const stats24h = ref({})
  const ohlcvData = ref([])
  const isLoading = ref(false)
  const orderFormData = ref({
    type: 'limit',
    side: 'buy',
    quantity: '',
    price: '',
    total: ''
  })

  // Getters
  const currentPair = computed(() => {
    return tradingPairs.value.find(pair => pair.symbol === selectedPair.value)
  })

  const currentStats = computed(() => {
    return stats24h.value[selectedPair.value] || {}
  })

  const openOrders = computed(() => {
    return userOrders.value.filter(order => 
      ['open', 'partially_filled'].includes(order.status)
    )
  })

  const orderHistory = computed(() => {
    return userOrders.value.filter(order => 
      ['filled', 'canceled', 'expired'].includes(order.status)
    )
  })

  const bestBid = computed(() => {
    return orderBook.value.bids.length > 0 ? orderBook.value.bids[0] : null
  })

  const bestAsk = computed(() => {
    return orderBook.value.asks.length > 0 ? orderBook.value.asks[0] : null
  })

  const spread = computed(() => {
    if (bestBid.value && bestAsk.value) {
      return bestAsk.value.price - bestBid.value.price
    }
    return 0
  })

  const spreadPercentage = computed(() => {
    if (bestBid.value && bestAsk.value && bestBid.value.price > 0) {
      return (spread.value / bestBid.value.price) * 100
    }
    return 0
  })

  // Actions
  const fetchTradingPairs = async () => {
    try {
      const response = await tradingService.getTradingPairs()
      if (response.success) {
        tradingPairs.value = response.trading_pairs
        
        // Set default pair if none selected
        if (!selectedPair.value && tradingPairs.value.length > 0) {
          selectedPair.value = tradingPairs.value[0].symbol
        }
      }
    } catch (error) {
      console.error('Failed to fetch trading pairs:', error)
    }
  }

  const selectTradingPair = async (symbol) => {
    selectedPair.value = symbol
    
    // Fetch initial data for the selected pair
    await Promise.all([
      fetchOrderBook(),
      fetchRecentTrades(),
      fetch24hStats(),
      fetchOHLCVData()
    ])

    // Subscribe to real-time updates
    const wsStore = useWebSocketStore()
    wsStore.subscribeToOrderBook(symbol)
    wsStore.subscribeToTrades(symbol)
  }

  const fetchOrderBook = async (depth = 20) => {
    if (!selectedPair.value) {return}

    try {
      const response = await tradingService.getOrderBook(selectedPair.value, depth)
      if (response.success) {
        orderBook.value = {
          bids: response.bids || [],
          asks: response.asks || []
        }
      }
    } catch (error) {
      console.error('Failed to fetch order book:', error)
    }
  }

  const fetchRecentTrades = async (limit = 50) => {
    if (!selectedPair.value) {return}

    try {
      const response = await tradingService.getRecentTrades(selectedPair.value, limit)
      if (response.success) {
        recentTrades.value = response.trades || []
      }
    } catch (error) {
      console.error('Failed to fetch recent trades:', error)
    }
  }

  const fetch24hStats = async () => {
    try {
      const response = await tradingService.get24hStats(selectedPair.value)
      if (response.success) {
        if (selectedPair.value) {
          stats24h.value[selectedPair.value] = response.stats
        } else {
          // All pairs stats
          response.stats.forEach(stat => {
            stats24h.value[stat.trading_pair] = stat
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch 24h stats:', error)
    }
  }

  const fetchOHLCVData = async (interval = '1h', limit = 100) => {
    if (!selectedPair.value) {return}

    try {
      const response = await tradingService.getOHLCVData(selectedPair.value, interval, limit)
      if (response.success) {
        ohlcvData.value = response.data || []
      }
    } catch (error) {
      console.error('Failed to fetch OHLCV data:', error)
    }
  }

  const fetchUserOrders = async (options = {}) => {
    try {
      isLoading.value = true
      const response = await tradingService.getUserOrders(options)
      if (response.success) {
        userOrders.value = response.orders || []
      }
    } catch (error) {
      console.error('Failed to fetch user orders:', error)
    } finally {
      isLoading.value = false
    }
  }

  const fetchUserTrades = async (options = {}) => {
    try {
      isLoading.value = true
      const response = await tradingService.getTradeHistory(options)
      if (response.success) {
        userTrades.value = response.trades || []
      }
    } catch (error) {
      console.error('Failed to fetch user trades:', error)
    } finally {
      isLoading.value = false
    }
  }

  const placeOrder = async (orderData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await tradingService.placeOrder({
        trading_pair: selectedPair.value,
        ...orderData
      })
      
      if (response.success) {
        notificationStore.success('Order Placed', 'Your order has been placed successfully')
        
        // Refresh user orders
        await fetchUserOrders()
        
        // Clear form
        resetOrderForm()
        
        return response
      }
    } catch (error) {
      notificationStore.error('Order Failed', error.message || 'Failed to place order')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const cancelOrder = async (orderId) => {
    const notificationStore = useNotificationStore()
    
    try {
      const response = await tradingService.cancelOrder(orderId)
      
      if (response.success) {
        notificationStore.success('Order Canceled', 'Your order has been canceled')
        
        // Remove from local state
        const index = userOrders.value.findIndex(order => order.id === orderId)
        if (index > -1) {
          userOrders.value.splice(index, 1)
        }
        
        return response
      }
    } catch (error) {
      notificationStore.error('Cancel Failed', error.message || 'Failed to cancel order')
      throw error
    }
  }

  const cancelAllOrders = async (filters = {}) => {
    const notificationStore = useNotificationStore()
    
    try {
      const response = await tradingService.cancelAllOrders({
        trading_pair: selectedPair.value,
        ...filters
      })
      
      if (response.success) {
        notificationStore.success(
          'Orders Canceled', 
          `${response.canceled_orders.length} orders have been canceled`
        )
        
        // Refresh user orders
        await fetchUserOrders()
        
        return response
      }
    } catch (error) {
      notificationStore.error('Cancel Failed', error.message || 'Failed to cancel orders')
      throw error
    }
  }

  const updateOrderForm = (field, value) => {
    orderFormData.value[field] = value
    
    // Auto-calculate total for limit orders
    if (field === 'quantity' || field === 'price') {
      if (orderFormData.value.type === 'limit' && 
          orderFormData.value.quantity && 
          orderFormData.value.price) {
        orderFormData.value.total = (
          parseFloat(orderFormData.value.quantity) * 
          parseFloat(orderFormData.value.price)
        ).toString()
      }
    }
    
    // Auto-calculate quantity from total
    if (field === 'total' && orderFormData.value.type === 'limit' && orderFormData.value.price) {
      orderFormData.value.quantity = (
        parseFloat(orderFormData.value.total) / 
        parseFloat(orderFormData.value.price)
      ).toString()
    }
  }

  const resetOrderForm = () => {
    orderFormData.value = {
      type: 'limit',
      side: 'buy',
      quantity: '',
      price: '',
      total: ''
    }
  }

  const setOrderFormPrice = (price) => {
    updateOrderForm('price', price.toString())
  }

  const setOrderFormFromOrderBook = (level, side) => {
    orderFormData.value.side =// eslint-disable-line no-unused-vars
       side
    setOrderFormPrice(level.price)
  }

  const calculateOrderValue = () => {
    if (orderFormData.value.quantity && orderFormData.value.price) {
      return parseFloat(orderFormData.value.quantity) * parseFloat(orderFormData.value.price)
    }
    return 0
  }

  const getMarketPrice = (_side) => {
    if (_side === 'buy' && bestAsk.value) {
      return bestAsk.value.price
    } else if (_side === 'sell' && bestBid.value) {
      return bestBid.value.price
    }
    return 0
  }

  const updateRealtimeData = (data) => {
    if (data.orderbook) {
      orderBook.value = data.orderbook
    }
    if (data.trades) {
      recentTrades.value = data.trades
    }
    if (data.ticker) {
      stats24h.value[selectedPair.value] = data.ticker
    }
  }

  const calculateTradingFee = (quantity, price, _side = 'buy') => {
    const pair = currentPair.value
    if (!pair) {return 0}
    
    const feeRate = pair.fees?.taker_fee || 0.001 // 0.1% default
    const value = quantity * price
    return value * feeRate
  }

  const formatPrice = (price) => {
    const pair = currentPair.value
    if (!pair) {return price.toString()}
    
    return parseFloat(price).toFixed(pair.price_precision || 2)
  }

  const formatQuantity = (quantity) => {
    const pair = currentPair.value
    if (!pair) {return quantity.toString()}
    
    return parseFloat(quantity).toFixed(pair.quantity_precision || 8)
  }

  return {
    // State
    tradingPairs,
    selectedPair,
    orderBook,
    recentTrades,
    userOrders,
    userTrades,
    stats24h,
    ohlcvData,
    isLoading,
    orderFormData,

    // Getters
    currentPair,
    currentStats,
    openOrders,
    orderHistory,
    bestBid,
    bestAsk,
    spread,
    spreadPercentage,

    // Actions
    fetchTradingPairs,
    selectTradingPair,
    fetchOrderBook,
    fetchRecentTrades,
    fetch24hStats,
    fetchOHLCVData,
    fetchUserOrders,
    fetchUserTrades,
    placeOrder,
    cancelOrder,
    cancelAllOrders,
    updateOrderForm,
    resetOrderForm,
    setOrderFormPrice,
    setOrderFormFromOrderBook,
    calculateOrderValue,
    getMarketPrice,
    updateRealtimeData,
    calculateTradingFee,
    formatPrice,
    formatQuantity
  }
})