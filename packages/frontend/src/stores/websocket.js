import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io } from 'socket.io-client'
import { useAuthStore } from './auth'
import { useNotificationStore } from './notification'

export const useWebSocketStore = defineStore('websocket', () => {
  // State
  const socket = ref(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const subscriptions = ref(new Set())
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectInterval = ref(1000)

  // Real-time data
  const orderBooks = ref({})
  const recentTrades = ref({})
  const tickerData = ref({})
  const userOrders = ref([])
  const userTrades = ref([])

  // Getters
  const connectionStatus = computed(() => {
    if (isConnecting.value) {return 'connecting'}
    if (isConnected.value) {return 'connected'}
    return 'disconnected'
  })

  const getOrderBook = computed(() => (symbol) => {
    return orderBooks.value[symbol] || { bids: [], asks: [] }
  })

  const getRecentTrades = computed(() => (symbol) => {
    return recentTrades.value[symbol] || []
  })

  const getTicker = computed(() => (symbol) => {
    return tickerData.value[symbol] || {}
  })

  // Actions
  const connect = () => {
    const authStore = useAuthStore()
    const notificationStore = useNotificationStore()

    if (socket.value?.connected) {
      return
    }

    isConnecting.value = true

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
      
      socket.value = io(wsUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectInterval.value,
        timeout: 10000
      })

      // Connection events
      socket.value.on('connect', () => {
        console.log('WebSocket connected')
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts.value = 0

        // Authenticate if user is logged in
        if (authStore.isAuthenticated && authStore.token) {
          socket.value.emit('authenticate', { token: authStore.token })
        }

        // Resubscribe to all active subscriptions
        subscriptions.value.forEach(subscription => {
          const [type, symbol] = subscription.split(':')
          socket.value.emit('subscribe', { type, symbol })
        })
      })

      socket.value.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        isConnected.value = false
        isConnecting.value = false

        if (reason === 'io server disconnect') {
          // Server disconnected, manual reconnection needed
          setTimeout(() => {
            if (reconnectAttempts.value < maxReconnectAttempts) {
              reconnectAttempts.value++
              connect()
            }
          }, reconnectInterval.value)
        }
      })

      socket.value.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        isConnecting.value = false
        
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          setTimeout(() => {
            connect()
          }, reconnectInterval.value * reconnectAttempts.value)
        } else {
          notificationStore.error(
            'Connection Failed',
            'Unable to establish real-time connection. Some features may not work properly.'
          )
        }
      })

      // Authentication events
      socket.value.on('authenticated', () => {
        console.log('WebSocket authenticated')
      })

      socket.value.on('auth_error', (data) => {
        console.error('WebSocket auth error:', data)
        // Token might be invalid, refresh or logout
        authStore.refreshToken().catch(() => {
          authStore.logout()
        })
      })

      // Market data events
      socket.value.on('orderbook_update', (data) => {
        if (data.trading_pair) {
          // Trigger orderbook refresh for this trading pair
          // In a production app, you might want to fetch the updated orderbook
          console.log('Order book updated for', data.trading_pair)
        }
      })

      socket.value.on('new_trade', (data) => {
        if (data.trading_pair && data.trade) {
          if (!recentTrades.value[data.trading_pair]) {
            recentTrades.value[data.trading_pair] = []
          }
          
          // Add new trade to the beginning
          recentTrades.value[data.trading_pair].unshift(data.trade)
          
          // Keep only last 50 trades
          if (recentTrades.value[data.trading_pair].length > 50) {
            recentTrades.value[data.trading_pair] = recentTrades.value[data.trading_pair].slice(0, 50)
          }
        }
      })

      socket.value.on('ticker_update', (data) => {
        if (data.trading_pair) {
          tickerData.value[data.trading_pair] = {
            ...tickerData.value[data.trading_pair],
            last_price: data.last_price,
            timestamp: data.timestamp
          }
        }
      })

      // User-specific events
      socket.value.on('order_update', (data) => {
        if (data.type === 'order_placed') {
          userOrders.value.unshift(data.order)
          notificationStore.success('Order Placed', 'Your order has been placed successfully')
        } else if (data.type === 'order_canceled') {
          const index = userOrders.value.findIndex(order => order.id === data.order.id)
          if (index > -1) {
            userOrders.value.splice(index, 1)
          }
          notificationStore.info('Order Canceled', 'Your order has been canceled')
        }
      })

      socket.value.on('trade_update', (data) => {
        if (data.type === 'trade_executed') {
          userTrades.value.unshift(data.trade)
          notificationStore.success(
            'Trade Executed',
            `Your ${data.trade.side} order has been executed at ${data.trade.price}`
          )
        }
      })

      // Subscription events
      socket.value.on('subscribed', (data) => {
        console.log('Subscribed to', data.type, data.symbol)
      })

      socket.value.on('unsubscribed', (data) => {
        console.log('Unsubscribed from', data.type, data.symbol)
      })

      socket.value.on('error', (error) => {
        console.error('WebSocket error:', error)
        notificationStore.error('Connection Error', error.message || 'An error occurred')
      })

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      isConnecting.value = false
    }
  }

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    isConnected.value = false
    isConnecting.value = false
    subscriptions.value.clear()
    reconnectAttempts.value = 0
  }

  const subscribe = (type, symbol = null) => {
    if (!socket.value?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected')
      return false
    }

    const subscription = symbol ? `${type}:${symbol}` : type
    subscriptions.value.add(subscription)
    
    socket.value.emit('subscribe', { type, symbol })
    return true
  }

  const unsubscribe = (type, symbol = null) => {
    if (!socket.value?.connected) {
      return false
    }

    const subscription = symbol ? `${type}:${symbol}` : type
    subscriptions.value.delete(subscription)
    
    socket.value.emit('unsubscribe', { type, symbol })
    return true
  }

  const subscribeToOrderBook = (symbol) => {
    return subscribe('orderbook', symbol)
  }

  const subscribeToTrades = (symbol) => {
    return subscribe('trades', symbol)
  }

  const subscribeToTicker = () => {
    return subscribe('ticker')
  }

  const unsubscribeFromOrderBook = (symbol) => {
    return unsubscribe('orderbook', symbol)
  }

  const unsubscribeFromTrades = (symbol) => {
    return unsubscribe('trades', symbol)
  }

  const unsubscribeFromTicker = () => {
    return unsubscribe('ticker')
  }

  const updateOrderBook = (symbol, orderBook) => {
    orderBooks.value[symbol] = orderBook
  }

  const updateTicker = (symbol, ticker) => {
    tickerData.value[symbol] = ticker
  }

  const clearUserData = () => {
    userOrders.value = []
    userTrades.value = []
  }

  const sendMessage = (event, data) => {
    if (socket.value?.connected) {
      socket.value.emit(event, data)
      return true
    }
    return false
  }

  return {
    // State
    socket,
    isConnected,
    isConnecting,
    subscriptions,
    reconnectAttempts,
    orderBooks,
    recentTrades,
    tickerData,
    userOrders,
    userTrades,

    // Getters
    connectionStatus,
    getOrderBook,
    getRecentTrades,
    getTicker,

    // Actions
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    subscribeToOrderBook,
    subscribeToTrades,
    subscribeToTicker,
    unsubscribeFromOrderBook,
    unsubscribeFromTrades,
    unsubscribeFromTicker,
    updateOrderBook,
    updateTicker,
    clearUserData,
    sendMessage
  }
})