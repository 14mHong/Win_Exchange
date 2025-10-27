<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Trading</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Buy and sell tokens at live market prices or set limit orders</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Trading Interface -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Trading Pair Selector -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trading Pair</label>
                <select
                  v-model="selectedPair"
                  @change="onPairChange"
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <optgroup label="WIN Token Pairs">
                    <option value="WIN/USDT">WIN/USDT</option>
                    <option value="WIN/BTC">WIN/BTC</option>
                    <option value="WIN/ETH">WIN/ETH</option>
                    <option value="WIN/USDC">WIN/USDC</option>
                  </optgroup>
                  <optgroup label="Other Trading Pairs">
                    <option v-for="token in otherTokens" :key="token" :value="`${token}/USDT`">{{ token }}/USDT</option>
                  </optgroup>
                </select>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600 dark:text-gray-400">Last Price</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">${{ formatPrice(baseTokenPrice) }}</p>
              </div>
            </div>
          </div>

          <!-- Trading Form -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <!-- Buy/Sell Tabs -->
            <div class="flex border-b border-gray-200 dark:border-gray-700">
              <button
                @click="orderSide = 'buy'"
                :class="[
                  'flex-1 py-3 font-semibold transition-colors',
                  orderSide === 'buy'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                ]"
              >
                Buy {{ baseCurrency }}
              </button>
              <button
                @click="orderSide = 'sell'"
                :class="[
                  'flex-1 py-3 font-semibold transition-colors',
                  orderSide === 'sell'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                ]"
              >
                Sell {{ baseCurrency }}
              </button>
            </div>

            <div class="p-6">
              <!-- Order Type Toggle -->
              <div class="mb-6">
                <div class="flex gap-2">
                  <button
                    @click="orderType = 'market'"
                    :class="[
                      'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
                      orderType === 'market'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    ]"
                  >
                    Market
                  </button>
                  <button
                    @click="orderType = 'limit'"
                    :class="[
                      'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
                      orderType === 'limit'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    ]"
                  >
                    Limit
                  </button>
                </div>
              </div>

              <!-- Price Input (for limit orders only) -->
              <div v-if="orderType === 'limit'" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price ({{ quoteCurrency }})
                </label>
                <input
                  v-model="orderPrice"
                  type="number"
                  step="0.00001"
                  placeholder="0.00"
                  class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                />
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Order will execute when price reaches {{ orderPrice || '0' }} {{ quoteCurrency }}
                </p>
              </div>

              <!-- Amount Input -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount ({{ baseCurrency }})
                </label>
                <input
                  v-model="orderAmount"
                  @input="calculateOrderTotal"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                />
                <div class="flex justify-between mt-2 text-sm">
                  <span class="text-gray-600 dark:text-gray-400">
                    Available: {{ formatAmount(getAvailableBalance()) }} {{ getAvailableCurrency() }}
                  </span>
                  <button
                    @click="setMaxAmount"
                    class="text-green-600 hover:text-green-700 font-medium"
                  >
                    Max
                  </button>
                </div>
              </div>

              <!-- Total Display -->
              <div class="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Total</span>
                  <span class="text-lg font-bold text-gray-900 dark:text-white">
                    {{ formatAmount(orderTotal) }} {{ quoteCurrency }}
                  </span>
                </div>
                <div v-if="orderType === 'market' && orderAmount" class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between">
                    <span>Exchange Rate:</span>
                    <span>1 {{ baseCurrency }} = {{ formatAmount(getExchangeRate()) }} {{ quoteCurrency }}</span>
                  </div>
                </div>
              </div>

              <!-- Action Button -->
              <button
                @click="placeOrder"
                :disabled="isPlacingOrder || !canPlaceOrder()"
                :class="[
                  'w-full py-3 rounded-lg font-semibold transition-colors',
                  orderSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                ]"
              >
                <span v-if="isPlacingOrder">Processing...</span>
                <span v-else>
                  {{ orderType === 'market' ? (orderSide === 'buy' ? 'Buy' : 'Sell') : 'Place Limit Order' }} {{ baseCurrency }}
                </span>
              </button>
            </div>
          </div>

          <!-- Price Chart -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ selectedPair }} Price Chart</h2>
            <div class="h-96" ref="chartContainer">
              <!-- TradingView Widget -->
              <div class="tradingview-widget-container" style="height:100%;width:100%">
                <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Balances & Orders -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Token Balances -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Balances</h2>
            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="token in allTokens"
                :key="token"
                class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p class="font-semibold text-gray-900 dark:text-white">{{ token }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">${{ formatPrice(getTokenPrice(token)) }}</p>
                </div>
                <div class="text-right">
                  <p class="font-medium text-gray-900 dark:text-white">{{ formatAmount(getBalance(token)) }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    ${{ formatPrice(getBalance(token) * getTokenPrice(token)) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Limit Orders -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Limit Orders</h2>
              <button
                v-if="limitOrders.length > 0"
                @click="fetchLimitOrders"
                class="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Refresh
              </button>
            </div>
            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div v-if="limitOrders.length > 0">
                <div
                  v-for="order in limitOrders"
                  :key="order.id"
                  class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <span class="text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {{ order.status.toUpperCase() }}
                      </span>
                    </div>
                    <button
                      v-if="order.status === 'open'"
                      @click="cancelLimitOrder(order.id)"
                      class="text-xs text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <div class="text-sm space-y-1">
                    <div class="flex justify-between">
                      <span class="text-gray-600 dark:text-gray-400">Pair:</span>
                      <span class="text-gray-900 dark:text-white font-medium">{{ order.from_token }} → {{ order.to_token }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600 dark:text-gray-400">Amount:</span>
                      <span class="text-gray-900 dark:text-white">{{ formatAmount(order.from_amount) }} {{ order.from_token }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600 dark:text-gray-400">Target Price:</span>
                      <span class="text-gray-900 dark:text-white">{{ formatAmount(order.target_price) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600 dark:text-gray-400">Created:</span>
                      <span class="text-gray-900 dark:text-white text-xs">{{ formatTime(order.created_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                No limit orders
              </div>
            </div>
          </div>

          <!-- Swap History -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Recent Swaps</h2>
              <button
                v-if="swapHistory.length > 0"
                @click="fetchSwapHistory"
                class="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Refresh
              </button>
            </div>
            <div class="space-y-3 max-h-64 overflow-y-auto">
              <div v-if="swapHistory.length > 0">
                <div
                  v-for="swap in swapHistory"
                  :key="swap.id"
                  class="border-b border-gray-200 dark:border-gray-700 pb-3"
                >
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ swap.from_token }} → {{ swap.to_token }}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatTime(swap.created_at) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">{{ formatAmount(swap.from_amount) }} {{ swap.from_token }}</span>
                    <span class="text-gray-600 dark:text-gray-400">→</span>
                    <span class="text-gray-900 dark:text-white font-medium">{{ formatAmount(swap.to_amount) }} {{ swap.to_token }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                No swap history
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { apiHelpers } from '@/services/api'

export default {
  name: 'Trading',
  setup() {
    const notificationStore = useNotificationStore()

    // Other tokens (excluding WIN since it has special pairs)
    const otherTokens = ref([
      'BTC', 'ETH', 'USDC', 'ADA', 'LTC', 'XRP', 'DOGE', 'DOT',
      'SOL', 'MATIC', 'LINK', 'ATOM', 'UNI', 'AVAX', 'BNB', 'XLM'
    ])

    // All tokens including USDT (for balance display)
    const allTokens = ref([
      'WIN', 'BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'LTC', 'XRP', 'DOGE', 'DOT',
      'SOL', 'MATIC', 'LINK', 'ATOM', 'UNI', 'AVAX', 'BNB', 'XLM'
    ])

    // TradingView symbol mapping
    const tradingViewSymbols = {
      'WIN': null, // Custom token - will use custom chart
      'BTC': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT',
      'USDT': 'BINANCE:USDTUSD',
      'USDC': 'BINANCE:USDCUSDT',
      'ADA': 'BINANCE:ADAUSDT',
      'LTC': 'BINANCE:LTCUSDT',
      'XRP': 'BINANCE:XRPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'DOT': 'BINANCE:DOTUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'MATIC': 'BINANCE:MATICUSDT',
      'LINK': 'BINANCE:LINKUSDT',
      'ATOM': 'BINANCE:ATOMUSDT',
      'UNI': 'BINANCE:UNIUSDT',
      'AVAX': 'BINANCE:AVAXUSDT',
      'BNB': 'BINANCE:BNBUSDT',
      'XLM': 'BINANCE:XLMUSDT'
    }

    // CoinGecko ID mapping
    const coinGeckoIds = {
      'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'USDC': 'usd-coin',
      'ADA': 'cardano', 'LTC': 'litecoin', 'XRP': 'ripple', 'DOGE': 'dogecoin',
      'DOT': 'polkadot', 'SOL': 'solana', 'MATIC': 'matic-network', 'LINK': 'chainlink',
      'ATOM': 'cosmos', 'UNI': 'uniswap', 'AVAX': 'avalanche-2', 'BNB': 'binancecoin',
      'XLM': 'stellar'
    }

    // Trading state (Buy/Sell model)
    const selectedPair = ref('WIN/USDT')
    const baseCurrency = computed(() => selectedPair.value.split('/')[0])
    const quoteCurrency = computed(() => selectedPair.value.split('/')[1])
    const orderSide = ref('buy') // 'buy' or 'sell'
    const orderType = ref('market') // 'market' or 'limit'
    const orderAmount = ref('')
    const orderPrice = ref('') // For limit orders
    const isPlacingOrder = ref(false)

    // Price state
    const tokenPrices = ref({})
    const baseTokenPrice = computed(() => tokenPrices.value[baseCurrency.value] || 0)
    const quoteTokenPrice = computed(() => tokenPrices.value[quoteCurrency.value] || 0)

    // Order total calculation
    const orderTotal = computed(() => {
      const amount = parseFloat(orderAmount.value) || 0
      if (orderType.value === 'market') {
        // For market orders, calculate based on current prices
        // Total in quote currency = amount * (base price / quote price)
        if (quoteTokenPrice.value === 0) return 0
        return amount * (baseTokenPrice.value / quoteTokenPrice.value)
      } else {
        // For limit orders, use the specified price (already in quote currency)
        return amount * (parseFloat(orderPrice.value) || 0)
      }
    })

    // Data state
    const balances = ref({})
    const limitOrders = ref([])
    const swapHistory = ref([])

    // Chart state
    const chartContainer = ref(null)
    let tradingViewWidget = null

    // Auto-refresh
    let priceRefreshInterval = null
    let dataRefreshInterval = null

    const getCoinGeckoId = (token) => {
      return coinGeckoIds[token] || 'bitcoin'
    }

    const getBalance = (token) => {
      return parseFloat(balances.value[token] || 0)
    }

    const getTokenPrice = (token) => {
      return tokenPrices.value[token] || 0
    }

    const formatPrice = (price) => {
      return parseFloat(price || 0).toFixed(2)
    }

    const formatAmount = (amount) => {
      return parseFloat(amount || 0).toFixed(4)
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleString()
    }

    // New methods for buy/sell model
    const onPairChange = () => {
      orderAmount.value = ''
      orderPrice.value = ''
      initTradingViewChart()
    }

    const getAvailableBalance = () => {
      if (orderSide.value === 'buy') {
        // For buying, we need USDT balance
        return getBalance(quoteCurrency.value)
      } else {
        // For selling, we need base currency balance
        return getBalance(baseCurrency.value)
      }
    }

    const getAvailableCurrency = () => {
      return orderSide.value === 'buy' ? quoteCurrency.value : baseCurrency.value
    }

    const getExchangeRate = () => {
      // Exchange rate: how much quote currency for 1 base currency
      if (quoteTokenPrice.value === 0) return 0
      return baseTokenPrice.value / quoteTokenPrice.value
    }

    const setMaxAmount = () => {
      const available = getAvailableBalance()
      if (orderSide.value === 'buy') {
        // For buy, calculate max base currency amount we can buy with available USDT
        const rate = orderType.value === 'market' ? baseTokenPrice.value : parseFloat(orderPrice.value)
        if (rate > 0) {
          orderAmount.value = (available / rate).toFixed(4)
        }
      } else {
        // For sell, we can sell all available base currency
        orderAmount.value = available.toFixed(4)
      }
    }

    const calculateOrderTotal = () => {
      // Total is already computed reactively
      // This method is called to trigger recalculation if needed
    }

    const initTradingViewChart = async () => {
      if (!chartContainer.value) return

      // Clear existing widget
      const container = chartContainer.value.querySelector('.tradingview-widget-container__widget')
      if (container) {
        container.innerHTML = ''
        container.id = 'tradingview-widget-' + Date.now()
      }

      // For WIN token, use custom chart with our data
      if (baseCurrency.value === 'WIN') {
        await initWinChart(container)
        return
      }

      // For other tokens, use TradingView external data
      if (!window.TradingView) {
        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/tv.js'
        script.async = true
        script.onload = () => createWidget()
        document.head.appendChild(script)
      } else {
        createWidget()
      }

      function createWidget() {
        if (!container) return
        const symbol = tradingViewSymbols[baseCurrency.value] || 'BINANCE:BTCUSDT'

        tradingViewWidget = new window.TradingView.widget({
          width: '100%',
          height: '100%',
          symbol: symbol,
          interval: '60',
          timezone: 'Etc/UTC',
          theme: 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: container.id,
          studies: [],
          show_popup_button: false,
          popup_width: '1000',
          popup_height: '650'
        })
      }
    }

    const initWinChart = async (container) => {
      try {
        const winTokenService = await import('@/services/winTokenService')
        const chartResponse = await winTokenService.default.getChartData('1h', 100)

        if (!chartResponse.success) {
          container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Failed to load WIN chart data</div>'
          return
        }

        // Load TradingView Lightweight Charts (version 4.1.0 - stable)
        if (!window.LightweightCharts) {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js'
          script.async = true
          script.onload = () => createWinChart(container, chartResponse.data.candles)
          script.onerror = () => {
            console.error('Failed to load Lightweight Charts library')
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Failed to load chart library</div>'
          }
          document.head.appendChild(script)
        } else {
          createWinChart(container, chartResponse.data.candles)
        }
      } catch (error) {
        console.error('Error initializing WIN chart:', error)
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart</div>'
      }
    }

    const createWinChart = (container, candles) => {
      if (!window.LightweightCharts) {
        console.error('LightweightCharts is not loaded')
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Chart library not loaded</div>'
        return
      }

      container.innerHTML = ''

      const chart = window.LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: 'solid', color: '#ffffff' },
          textColor: '#333'
        },
        grid: {
          vertLines: { color: '#e0e0e0' },
          horzLines: { color: '#e0e0e0' }
        },
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode.Normal
        },
        rightPriceScale: {
          borderColor: '#cccccc',
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1
          }
        },
        timeScale: {
          borderColor: '#cccccc',
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 12,
          minBarSpacing: 8
        }
      })

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickVisible: true,
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001
        }
      })

      const formattedData = candles.map(candle => ({
        time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close)
      })).sort((a, b) => a.time - b.time)

      candlestickSeries.setData(formattedData)
      chart.timeScale().fitContent()

      const resizeHandler = () => {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight
        })
      }
      window.addEventListener('resize', resizeHandler)

      tradingViewWidget = { chart, cleanup: () => window.removeEventListener('resize', resizeHandler) }
    }

    const fetchTokenPrices = async () => {
      try {
        const symbols = allTokens.value.join(',')
        const response = await apiHelpers.get(`/api/swap/prices?symbols=${symbols}`)
        if (response.success) {
          tokenPrices.value = response.prices
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error)
      }
    }

    const fetchBalances = async () => {
      try {
        const response = await apiHelpers.get('/api/wallet/balances')
        if (response.success) {
          const balanceMap = {}
          response.balances.forEach(b => {
            balanceMap[b.currency] = b.balance
          })
          balances.value = balanceMap
        }
      } catch (error) {
        console.error('Failed to fetch balances:', error)
      }
    }

    const canPlaceOrder = () => {
      const amount = parseFloat(orderAmount.value)
      if (!amount || amount <= 0) return false

      // Check if we have sufficient balance
      if (orderSide.value === 'buy') {
        // For buy, check if we have enough USDT to buy the base currency
        const required = orderTotal.value
        if (required > getBalance(quoteCurrency.value)) return false
      } else {
        // For sell, check if we have enough base currency
        if (amount > getBalance(baseCurrency.value)) return false
      }

      // For limit orders, check price is set
      if (orderType.value === 'limit') {
        const price = parseFloat(orderPrice.value)
        if (!price || price <= 0) return false
      }

      return true
    }

    const placeOrder = async () => {
      if (!canPlaceOrder()) return

      try {
        isPlacingOrder.value = true

        // Determine fromToken and toToken based on buy/sell
        let fromToken, toToken, fromAmount
        const baseAmount = parseFloat(orderAmount.value)

        if (orderSide.value === 'buy') {
          // Buying base currency with USDT
          // We need to swap USDT for base currency
          fromToken = quoteCurrency.value // USDT
          toToken = baseCurrency.value    // e.g., ADA
          // For buy, we need to calculate USDT amount to spend
          // Backend expects fromAmount (USDT to spend)
          fromAmount = orderTotal.value   // Total USDT to spend
        } else {
          // Selling base currency for USDT
          fromToken = baseCurrency.value  // e.g., ADA
          toToken = quoteCurrency.value   // USDT
          fromAmount = baseAmount // Amount of base currency to sell
        }

        let response
        if (orderType.value === 'market') {
          // Execute market order
          response = await apiHelpers.post('/api/swap/market', {
            fromToken,
            toToken,
            fromAmount
          })

          if (response.success) {
            const action = orderSide.value === 'buy' ? 'Bought' : 'Sold'
            const primaryAmount = orderSide.value === 'buy' ? response.swap.toAmount : response.swap.fromAmount
            const secondaryAmount = orderSide.value === 'buy' ? response.swap.fromAmount : response.swap.toAmount
            notificationStore.success(
              `${action} Successfully`,
              `${action} ${formatAmount(primaryAmount)} ${baseCurrency.value} ${orderSide.value === 'buy' ? 'with' : 'for'} ${formatAmount(secondaryAmount)} ${quoteCurrency.value}`
            )
          }
        } else {
          // Create limit order
          // For limit orders, targetPrice is the rate
          response = await apiHelpers.post('/api/swap/limit', {
            fromToken,
            toToken,
            fromAmount,
            targetPrice: parseFloat(orderPrice.value)
          })

          if (response.success) {
            notificationStore.success('Limit Order Created', 'Your limit order has been placed successfully')
          }
        }

        // Reset form
        orderAmount.value = ''
        orderPrice.value = ''

        // Refresh data
        await Promise.all([fetchBalances(), fetchLimitOrders(), fetchSwapHistory()])
      } catch (error) {
        notificationStore.error('Order Failed', error.message || 'Failed to place order')
      } finally {
        isPlacingOrder.value = false
      }
    }

    const fetchLimitOrders = async () => {
      try {
        const response = await apiHelpers.get('/api/swap/limit')
        if (response.success) {
          limitOrders.value = response.orders
        }
      } catch (error) {
        console.error('Failed to fetch limit orders:', error)
      }
    }

    const cancelLimitOrder = async (orderId) => {
      try {
        const response = await apiHelpers.delete(`/api/swap/limit/${orderId}`)
        if (response.success) {
          notificationStore.success('Order Canceled', 'Limit order canceled successfully')
          await Promise.all([fetchBalances(), fetchLimitOrders()])
        }
      } catch (error) {
        notificationStore.error('Cancel Failed', error.message || 'Failed to cancel order')
      }
    }

    const fetchSwapHistory = async () => {
      try {
        const response = await apiHelpers.get('/api/swap/history', { limit: 10 })
        if (response.success) {
          swapHistory.value = response.swaps
        }
      } catch (error) {
        console.error('Failed to fetch swap history:', error)
      }
    }

    const startAutoRefresh = () => {
      // Refresh prices every 10 seconds
      priceRefreshInterval = setInterval(fetchTokenPrices, 10000)

      // Refresh data every 30 seconds
      dataRefreshInterval = setInterval(async () => {
        await Promise.all([
          fetchBalances(),
          fetchLimitOrders(),
          fetchSwapHistory()
        ])
      }, 30000)
    }

    onMounted(async () => {
      await Promise.all([
        fetchTokenPrices(),
        fetchBalances(),
        fetchLimitOrders(),
        fetchSwapHistory()
      ])
      startAutoRefresh()
      initTradingViewChart()
    })

    onUnmounted(() => {
      if (priceRefreshInterval) clearInterval(priceRefreshInterval)
      if (dataRefreshInterval) clearInterval(dataRefreshInterval)
    })

    return {
      selectedPair,
      otherTokens,
      allTokens,
      baseCurrency,
      quoteCurrency,
      orderSide,
      orderType,
      orderAmount,
      orderPrice,
      orderTotal,
      isPlacingOrder,
      baseTokenPrice,
      quoteTokenPrice,
      balances,
      limitOrders,
      swapHistory,
      chartContainer,
      getCoinGeckoId,
      getBalance,
      getTokenPrice,
      formatPrice,
      formatAmount,
      formatTime,
      onPairChange,
      getAvailableBalance,
      getAvailableCurrency,
      getExchangeRate,
      setMaxAmount,
      calculateOrderTotal,
      canPlaceOrder,
      placeOrder,
      fetchLimitOrders,
      cancelLimitOrder,
      fetchSwapHistory
    }
  }
}
</script>
