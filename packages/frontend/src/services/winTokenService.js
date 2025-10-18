import api from './api'

const winTokenService = {
  /**
   * Get current WIN token price
   */
  async getPrice() {
    try {
      const response = await api.get('/api/win-token/price')
      return response
    } catch (error) {
      console.error('Error fetching WIN price:', error)
      throw error
    }
  },

  /**
   * Get WIN token 24h ticker data
   */
  async getTicker24h() {
    try {
      const response = await api.get('/api/win-token/ticker/24h')
      return response
    } catch (error) {
      console.error('Error fetching WIN ticker:', error)
      throw error
    }
  },

  /**
   * Get WIN token market summary
   */
  async getMarketSummary() {
    try {
      const response = await api.get('/api/win-token/market')
      return response
    } catch (error) {
      console.error('Error fetching WIN market summary:', error)
      throw error
    }
  },

  /**
   * Get WIN token price history for charting
   * @param {string} timeframe - '1m', '5m', '15m', '1h', '4h', '1d'
   * @param {number} limit - Number of candles to fetch
   */
  async getChartData(timeframe = '1h', limit = 100) {
    try {
      const response = await api.get(`/api/win-token/chart/${timeframe}`, {
        params: { limit }
      })
      return response
    } catch (error) {
      console.error('Error fetching WIN chart data:', error)
      throw error
    }
  },

  /**
   * Get recent WIN token trades
   * @param {number} limit - Number of trades to fetch
   */
  async getRecentTrades(limit = 50) {
    try {
      const response = await api.get('/api/win-token/trades', {
        params: { limit }
      })
      return response
    } catch (error) {
      console.error('Error fetching WIN trades:', error)
      throw error
    }
  },

  /**
   * Get WIN token statistics
   * @param {number} hours - Number of hours for stats (default 24)
   */
  async getStats(hours = 24) {
    try {
      const response = await api.get('/api/win-token/stats', {
        params: { hours }
      })
      return response
    } catch (error) {
      console.error('Error fetching WIN stats:', error)
      throw error
    }
  }
}

export default winTokenService
