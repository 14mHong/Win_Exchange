<template>
  <div class="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div class="text-center">
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Trade Crypto with
            <span class="text-green-600 dark:text-green-400">Confidence</span>
          </h1>
          <p class="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Professional cryptocurrency exchange with advanced trading tools, 
            secure wallet management, and real-time market data.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <router-link
              to="/get-invite-code"
              class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              🎟️ Get Invite Code
            </router-link>
            <router-link
              to="/register"
              class="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Get Started
            </router-link>
            <router-link
              to="/login"
              class="border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Sign In
            </router-link>
          </div>
          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Need an invite code to register? Purchase one with ETH!
          </p>
        </div>
      </div>
    </section>

    <!-- Market Overview Section -->
    <section
      id="markets"
      class="py-12 bg-white dark:bg-gray-800"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Live Market Data
          </h2>
          <p class="text-gray-600 dark:text-gray-300">
            Real-time prices and 24h changes for top cryptocurrencies
          </p>
        </div>

        <!-- Market Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div
            v-for="token in showAllTokens ? marketData : marketData.slice(0, 8)"
            :key="token.symbol"
            class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            @click="viewTokenChart(token.symbol)"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  {{ token.symbol.substring(0, 2) }}
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-white">
                    {{ token.symbol }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ token.name }}
                  </p>
                </div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-sm text-gray-500">Price</span>
                <span class="font-semibold text-gray-900 dark:text-white">${{ formatPrice(token.price) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500">24h Change</span>
                <span
                  :class="(token.change24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'"
                  class="font-semibold"
                >
                  {{ (token.change24h || 0) >= 0 ? '+' : '' }}{{ (token.change24h || 0).toFixed(2) }}%
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500">Volume</span>
                <span class="text-sm text-gray-900 dark:text-white">${{ formatVolume(token.volume24h) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Show More Tokens Button -->
        <div v-if="!showAllTokens && marketData.length > 8" class="text-center mb-12">
          <button
            @click="showAllTokens = true"
            class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            View All {{ marketData.length }} Tokens
          </button>
        </div>

        <!-- Featured Chart -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ marketData.find(t => t.symbol === selectedSymbol)?.name || 'Bitcoin' }}/USDT Price Chart
            </h3>
            <div class="flex items-center gap-4">
              <!-- Token Selector -->
              <select
                v-model="selectedSymbol"
                class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium"
              >
                <option v-for="token in marketData" :key="token.symbol" :value="token.symbol">
                  {{ token.symbol }}
                </option>
              </select>
              <!-- Time Range Selector (only for WIN token) -->
              <div v-if="selectedSymbol === 'WIN'" class="flex gap-1">
                <button
                  v-for="range in timeRanges"
                  :key="range.value"
                  @click="selectedTimeRange = range.value"
                  :class="[
                    'px-3 py-1 text-sm font-medium rounded transition-colors',
                    selectedTimeRange === range.value
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  ]"
                >
                  {{ range.label }}
                </button>
              </div>
            </div>
          </div>
          <div class="relative">
            <div
              ref="chartContainer"
              class="h-96"
            >
              <!-- TradingView Widget -->
              <div class="tradingview-widget-container" style="height:100%;width:100%">
                <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section
      id="features"
      class="py-12 bg-gray-50 dark:bg-gray-900"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose Our Exchange?
          </h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center">
            <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                class="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Secure Trading
            </h3>
            <p class="text-gray-600 dark:text-gray-300">
              Advanced security measures including 2FA and cold storage
            </p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                class="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Real-time Data
            </h3>
            <p class="text-gray-600 dark:text-gray-300">
              Live market data and advanced charting tools
            </p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                class="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Low Fees
            </h3>
            <p class="text-gray-600 dark:text-gray-300">
              Competitive trading fees starting from 0.1%
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import winTokenService from '@/services/winTokenService'

export default {
  name: 'LandingPage',
  setup() {
    const marketData = ref([
      { symbol: 'WIN', name: 'Win Exchange Token', price: 0, change24h: 0, volume24h: 0, isCustomToken: true },
      { symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'bitcoin' },
      { symbol: 'ETH', name: 'Ethereum', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'ethereum' },
      { symbol: 'USDT', name: 'Tether', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'usd-coin' },
      { symbol: 'ADA', name: 'Cardano', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'cardano' },
      { symbol: 'LTC', name: 'Litecoin', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'litecoin' },
      { symbol: 'XRP', name: 'Ripple', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'ripple' },
      { symbol: 'DOGE', name: 'Dogecoin', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'dogecoin' },
      { symbol: 'DOT', name: 'Polkadot', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'polkadot' },
      { symbol: 'SOL', name: 'Solana', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'solana' },
      { symbol: 'MATIC', name: 'Polygon', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'matic-network' },
      { symbol: 'LINK', name: 'Chainlink', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'chainlink' },
      { symbol: 'ATOM', name: 'Cosmos', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'cosmos' },
      { symbol: 'UNI', name: 'Uniswap', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'uniswap' },
      { symbol: 'AVAX', name: 'Avalanche', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'avalanche-2' },
      { symbol: 'BNB', name: 'Binance Coin', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'binancecoin' },
      { symbol: 'XLM', name: 'Stellar', price: 0, change24h: 0, volume24h: 0, coinGeckoId: 'stellar' }
    ])

    // TradingView symbol mapping
    const tradingViewSymbols = {
      'WIN': null, // Custom token - will use custom chart data
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

    const winChartData = ref([])
    const winChartWidget = ref(null)

    const selectedSymbol = ref('BTC')
    const selectedTimeRange = ref('1h')
    const showAllTokens = ref(false)
    const chartContainer = ref(null)
    let tradingViewWidget = null

    // Time ranges for WIN chart
    const timeRanges = [
      { label: '5M', value: '5m', timeframe: '5m', limit: 60 },
      { label: '30M', value: '30m', timeframe: '30m', limit: 60 },
      { label: '1H', value: '1h', timeframe: '1h', limit: 60 },
      { label: '4H', value: '4h', timeframe: '4h', limit: 48 },
      { label: '1D', value: '1d', timeframe: '1h', limit: 24 },
      { label: '1W', value: '1w', timeframe: '4h', limit: 42 },
      { label: '1M', value: '1m', timeframe: '1d', limit: 30 }
    ]

    const formatPrice = (price) => {
      if (price == null || isNaN(price)) return '0.0000'
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }).format(price)
    }

    const formatVolume = (volume) => {
      if (volume == null || isNaN(volume)) return '0'
      if (volume >= 1e9) {
        return (volume / 1e9).toFixed(1) + 'B'
      } else if (volume >= 1e6) {
        return (volume / 1e6).toFixed(1) + 'M'
      } else if (volume >= 1e3) {
        return (volume / 1e3).toFixed(1) + 'K'
      }
      return volume.toString()
    }

    const fetchWinTokenData = async () => {
      try {
        const tickerData = await winTokenService.getTicker24h()
        if (tickerData.success) {
          const winIndex = marketData.value.findIndex(t => t.symbol === 'WIN')
          if (winIndex !== -1) {
            marketData.value[winIndex] = {
              ...marketData.value[winIndex],
              price: tickerData.data.last_price,
              change24h: tickerData.data.price_change_percent,
              volume24h: tickerData.data.volume
            }
          }
        }
      } catch (error) {
        console.error('Error fetching WIN token data:', error)
      }
    }

    const fetchMarketData = async () => {
      try {
        // Fetch WIN token data from our backend
        await fetchWinTokenData()

        // Fetch other tokens from CoinGecko
        const ids = marketData.value
          .filter(t => t.coinGeckoId)
          .map(t => t.coinGeckoId)
          .join(',')

        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
        )
        const data = await response.json()

        marketData.value = marketData.value.map(token => {
          if (token.isCustomToken) return token // Skip custom tokens

          const coinData = data.find(d => d.id === token.coinGeckoId)
          if (coinData) {
            return {
              ...token,
              price: coinData.current_price,
              change24h: coinData.price_change_percentage_24h || 0,
              volume24h: coinData.total_volume || 0
            }
          }
          return token
        })
      } catch (error) {
        console.error('Error fetching market data:', error)
      }
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
      if (selectedSymbol.value === 'WIN') {
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
        const symbol = tradingViewSymbols[selectedSymbol.value] || 'BINANCE:BTCUSDT'

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
        // Get time range settings
        const range = timeRanges.find(r => r.value === selectedTimeRange.value) || timeRanges[0]

        // Fetch WIN chart data with selected timeframe
        const chartResponse = await winTokenService.getChartData(range.timeframe, range.limit)
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
          },
          entireTextOnly: false,
          visible: true
        },
        timeScale: {
          borderColor: '#cccccc',
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 12,
          minBarSpacing: 8,
          rightOffset: 5,
          lockVisibleTimeRangeOnResize: true
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true
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

      // Format data for lightweight charts
      const formattedData = candles.map(candle => ({
        time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close)
      })).sort((a, b) => a.time - b.time) // Ensure chronological order

      candlestickSeries.setData(formattedData)

      // Fit content to show all candles
      chart.timeScale().fitContent()

      // Handle resize
      const resizeHandler = () => {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight
        })
      }
      window.addEventListener('resize', resizeHandler)

      // Store chart and series reference with cleanup
      if (winChartWidget.value) {
        // Clean up old chart properly
        if (winChartWidget.value.cleanup) {
          winChartWidget.value.cleanup()
        }
        if (winChartWidget.value.chart) {
          try {
            winChartWidget.value.chart.remove()
          } catch (e) {
            console.warn('Error removing old chart:', e)
          }
        }
      }
      winChartWidget.value = {
        chart,
        series: candlestickSeries,
        cleanup: () => window.removeEventListener('resize', resizeHandler)
      }
    }

    // Update WIN chart data without recreating the chart
    const updateWinChartData = async () => {
      try {
        if (selectedSymbol.value !== 'WIN' || !winChartWidget.value?.series || !winChartWidget.value?.chart) {
          return
        }

        // Safety check: ensure chart hasn't been disposed
        try {
          // Test if chart is still valid by checking its options
          winChartWidget.value.chart.options()
        } catch (e) {
          console.warn('Chart has been disposed, skipping update')
          return
        }

        const range = timeRanges.find(r => r.value === selectedTimeRange.value) || timeRanges[0]
        const chartResponse = await winTokenService.getChartData(range.timeframe, range.limit)

        if (!chartResponse.success) {
          return
        }

        // Format and update data
        const formattedData = chartResponse.data.candles.map(candle => ({
          time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        })).sort((a, b) => a.time - b.time)

        // Update the series data smoothly
        winChartWidget.value.series.setData(formattedData)

        // Fit the time scale to show all data
        winChartWidget.value.chart.timeScale().fitContent()
      } catch (error) {
        console.error('Error updating WIN chart data:', error)
      }
    }

    const viewTokenChart = (symbol) => {
      selectedSymbol.value = symbol
    }

    // Watch for symbol changes
    watch(selectedSymbol, () => {
      initTradingViewChart()
    })

    // Watch for time range changes (WIN chart only)
    watch(selectedTimeRange, () => {
      if (selectedSymbol.value === 'WIN') {
        initTradingViewChart()
      }
    })

    onMounted(async () => {
      // Fetch initial market data
      await fetchMarketData()

      // Start periodic updates every 30 seconds
      const marketInterval = setInterval(fetchMarketData, 30000)

      // Auto-refresh WIN chart data every 1 second for fastest real-time updates
      const chartRefreshInterval = setInterval(() => {
        updateWinChartData()
      }, 1000) // Refresh every 1 second

      // Initialize chart
      initTradingViewChart()

      // Cleanup
      onUnmounted(() => {
        clearInterval(marketInterval)
        clearInterval(chartRefreshInterval)
        if (winChartWidget.value) {
          if (winChartWidget.value.cleanup) {
            winChartWidget.value.cleanup()
          }
          if (winChartWidget.value.chart) {
            try {
              winChartWidget.value.chart.remove()
            } catch (e) {
              console.warn('Error removing chart on unmount:', e)
            }
          }
          winChartWidget.value = null
        }
      })
    })

    return {
      marketData,
      selectedSymbol,
      selectedTimeRange,
      timeRanges,
      showAllTokens,
      chartContainer,
      formatPrice,
      formatVolume,
      viewTokenChart
    }
  }
}
</script>