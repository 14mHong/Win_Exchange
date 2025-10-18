const axios = require('axios');

class CoinGeckoService {
  constructor() {
    this.baseURL = 'https://api.coingecko.com/api/v3';
    this.cache = new Map();
    this.cacheDuration = 30000; // 30 seconds cache

    // Map token symbols to CoinGecko IDs
    this.tokenMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'ADA': 'cardano',
      'LTC': 'litecoin',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
      'SOL': 'solana',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'ATOM': 'cosmos',
      'UNI': 'uniswap',
      'AVAX': 'avalanche-2',
      'BNB': 'binancecoin',
      'XLM': 'stellar'
    };
  }

  /**
   * Get current price of a token in USD
   * @param {string} symbol - Token symbol (e.g., 'BTC', 'ADA', 'WIN')
   * @returns {Promise<number>} Price in USD
   */
  async getPrice(symbol) {
    const upperSymbol = symbol.toUpperCase();

    // Handle WIN token separately
    if (upperSymbol === 'WIN') {
      const WinToken = require('../models/WinToken');
      const config = await WinToken.getConfig();
      if (!config) {
        throw new Error('WIN token price not available');
      }
      return parseFloat(config.current_price);
    }

    const cacheKey = `price_${symbol}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const coinId = this.tokenMap[upperSymbol];

    if (!coinId) {
      throw new Error(`Unsupported token: ${symbol}`);
    }

    try {
      const response = await axios.get(`${this.baseURL}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd'
        },
        timeout: 10000
      });

      const price = response.data[coinId]?.usd;

      if (!price) {
        throw new Error(`Price not available for ${symbol}`);
      }

      this.setCache(cacheKey, price);
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
  }

  /**
   * Get prices for multiple tokens
   * @param {string[]} symbols - Array of token symbols
   * @returns {Promise<Object>} Object with symbol as key and price as value
   */
  async getPrices(symbols) {
    const cacheKey = `prices_${symbols.sort().join('_')}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const coinIds = symbols
      .map(s => this.tokenMap[s.toUpperCase()])
      .filter(Boolean);

    if (coinIds.length === 0) {
      throw new Error('No valid tokens provided');
    }

    try {
      const response = await axios.get(`${this.baseURL}/simple/price`, {
        params: {
          ids: coinIds.join(','),
          vs_currencies: 'usd'
        },
        timeout: 10000
      });

      const prices = {};
      symbols.forEach(symbol => {
        const coinId = this.tokenMap[symbol.toUpperCase()];
        if (coinId && response.data[coinId]) {
          prices[symbol.toUpperCase()] = response.data[coinId].usd;
        }
      });

      this.setCache(cacheKey, prices);
      return prices;
    } catch (error) {
      console.error('Error fetching multiple prices:', error.message);
      throw new Error('Failed to fetch prices');
    }
  }

  /**
   * Calculate swap output amount
   * @param {string} fromToken - Token to swap from
   * @param {string} toToken - Token to swap to
   * @param {number} fromAmount - Amount to swap
   * @returns {Promise<Object>} Swap calculation result
   */
  async calculateSwap(fromToken, toToken, fromAmount) {
    const fromPrice = await this.getPrice(fromToken);
    const toPrice = await this.getPrice(toToken);

    const fromValueUSD = fromAmount * fromPrice;
    const toAmount = fromValueUSD / toPrice;

    return {
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      fromPrice,
      toPrice,
      rate: fromPrice / toPrice,
      valueUSD: fromValueUSD
    };
  }

  /**
   * Get market chart data for a token
   * @param {string} symbol - Token symbol
   * @param {number} days - Number of days (1, 7, 30, 90, 365, max)
   * @returns {Promise<Array>} Array of [timestamp, price] pairs
   */
  async getMarketChart(symbol, days = 7) {
    const coinId = this.tokenMap[symbol.toUpperCase()];

    if (!coinId) {
      throw new Error(`Unsupported token: ${symbol}`);
    }

    const cacheKey = `chart_${symbol}_${days}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(`${this.baseURL}/coins/${coinId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days
        },
        timeout: 10000
      });

      const chartData = response.data.prices;
      this.setCache(cacheKey, chartData);
      return chartData;
    } catch (error) {
      console.error(`Error fetching chart for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch chart for ${symbol}`);
    }
  }

  /**
   * Cache helpers
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new CoinGeckoService();
