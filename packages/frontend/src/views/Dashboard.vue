<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="md:flex md:items-center md:justify-between">
      <div class="flex-1 min-w-0">
        <h2 class="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:text-3xl sm:truncate">
          Dashboard
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back! Here's your portfolio overview.
        </p>
      </div>
      <div class="mt-4 flex md:mt-0 md:ml-4">
        <button
          @click="refreshData"
          :disabled="isLoading"
          class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <svg
            :class="['w-4 h-4 mr-2', { 'animate-spin': isLoading }]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Total Balance -->
      <div class="bg-white dark:bg-dark-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg
                  class="w-6 h-6 text-blue-600 dark:text-blue-400"
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
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Balance (USD)
                </dt>
                <dd class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <span v-if="isLoading" class="text-gray-400">Loading...</span>
                  <span v-else>${{ formatNumber(totalBalanceUSD) }}</span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Available Balance -->
      <div class="bg-white dark:bg-dark-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <svg
                  class="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Available
                </dt>
                <dd class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <span v-if="isLoading" class="text-gray-400">Loading...</span>
                  <span v-else>${{ formatNumber(availableBalanceUSD) }}</span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Locked Balance -->
      <div class="bg-white dark:bg-dark-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                <svg
                  class="w-6 h-6 text-yellow-600 dark:text-yellow-400"
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
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Locked in Orders
                </dt>
                <dd class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <span v-if="isLoading" class="text-gray-400">Loading...</span>
                  <span v-else>${{ formatNumber(lockedBalanceUSD) }}</span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <router-link
        to="/trading"
        class="relative group bg-white dark:bg-dark-700 p-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg shadow hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <span class="rounded-lg inline-flex p-2 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-800">
            <svg
              class="h-5 w-5"
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
          </span>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Start Trading
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Buy and sell crypto
            </p>
          </div>
        </div>
      </router-link>

      <router-link
        to="/wallet"
        class="relative group bg-white dark:bg-dark-700 p-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg shadow hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <span class="rounded-lg inline-flex p-2 bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-800">
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </span>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Manage Wallet
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Deposits & withdrawals
            </p>
          </div>
        </div>
      </router-link>

      <router-link
        to="/orders"
        class="relative group bg-white dark:bg-dark-700 p-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg shadow hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <span class="rounded-lg inline-flex p-2 bg-yellow-50 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-800">
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </span>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
              View Orders
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Track your trades
            </p>
          </div>
        </div>
      </router-link>
    </div>

    <!-- Token Balances -->
    <div class="bg-white dark:bg-dark-800 shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
          Token Balances
        </h3>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p class="mt-4 text-gray-500 dark:text-gray-400">Loading your balances...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <button @click="refreshData" class="btn btn-primary">
            Try Again
          </button>
        </div>

        <!-- Token List -->
        <div v-else-if="wallets.length > 0" class="overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-dark-700">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Asset
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Available
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Locked
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  USD Value
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="wallet in wallets" :key="wallet.currency" class="hover:bg-gray-50 dark:hover:bg-dark-700">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span class="text-blue-600 dark:text-blue-400 font-bold text-sm">
                        {{ wallet.currency.substring(0, 2) }}
                      </span>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {{ wallet.currency }}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getCurrencyName(wallet.currency) }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                  {{ formatCrypto(wallet.balance) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                  {{ formatCrypto(wallet.locked_balance) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ formatCrypto(wallet.balance + wallet.locked_balance) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ formatNumber(getUSDValue(wallet)) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div v-if="canDepositWithdraw(wallet.currency)">
                    <router-link
                      :to="`/wallet/deposit/${wallet.currency}`"
                      class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                    >
                      Deposit
                    </router-link>
                    <router-link
                      :to="`/wallet/withdraw/${wallet.currency}`"
                      class="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                    >
                      Withdraw
                    </router-link>
                  </div>
                  <span v-else class="text-gray-400 dark:text-gray-500 text-xs">
                    Trading Only
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400 mb-4">No wallet balances found</p>
          <router-link to="/wallet" class="btn btn-primary">
            Go to Wallet
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import walletService from '@/services/walletService'

export default {
  name: 'Dashboard',
  setup() {
    const wallets = ref([])
    const isLoading = ref(true)
    const error = ref(null)
    const cryptoPrices = ref({})

    // All supported tokens (18 tokens including WIN)
    const allTokens = ['WIN', 'BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'LTC', 'XRP', 'DOGE', 'DOT', 'SOL', 'MATIC', 'LINK', 'ATOM', 'UNI', 'AVAX', 'BNB', 'XLM']

    // Currency name mapping (all 18 tokens)
    const currencyNames = {
      'WIN': 'Win Exchange Token',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'USDT': 'Tether',
      'USDC': 'USD Coin',
      'ADA': 'Cardano',
      'LTC': 'Litecoin',
      'XRP': 'Ripple',
      'DOGE': 'Dogecoin',
      'DOT': 'Polkadot',
      'SOL': 'Solana',
      'MATIC': 'Polygon',
      'LINK': 'Chainlink',
      'ATOM': 'Cosmos',
      'UNI': 'Uniswap',
      'AVAX': 'Avalanche',
      'BNB': 'Binance Coin',
      'XLM': 'Stellar'
    }

    // Tokens that support deposit/withdraw (only these have real blockchain integration)
    const depositWithdrawEnabled = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC']

    // Check if token supports deposit/withdraw
    const canDepositWithdraw = (currency) => {
      return depositWithdrawEnabled.includes(currency)
    }

    // Fetch crypto prices from CoinGecko and WIN from backend
    const fetchCryptoPrices = async () => {
      try {
        // Fetch WIN price from our backend
        const winTokenService = await import('@/services/winTokenService')
        const winPriceData = await winTokenService.default.getPrice()

        const coinIds = {
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
        }

        const ids = Object.values(coinIds).join(',')
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        )
        const data = await response.json()

        // Map back to currency symbols
        const prices = {}
        Object.entries(coinIds).forEach(([symbol, coinId]) => {
          prices[symbol] = data[coinId]?.usd || 0
        })

        // Add WIN price
        if (winPriceData.success) {
          prices['WIN'] = winPriceData.data.price
        }

        cryptoPrices.value = prices
      } catch (err) {
        console.error('Error fetching crypto prices:', err)
      }
    }

    // Fetch wallet data
    const fetchWallets = async () => {
      try {
        isLoading.value = true
        error.value = null

        const response = await walletService.getWallets()

        if (response.success && response.wallets) {
          // Create a map of existing wallets
          const walletMap = {}
          response.wallets.forEach(wallet => {
            walletMap[wallet.currency] = wallet
          })

          // Ensure all 17 tokens are displayed (with 0 balance if not exists)
          wallets.value = allTokens.map(currency => {
            if (walletMap[currency]) {
              return walletMap[currency]
            } else {
              // Create a placeholder wallet with 0 balance for tokens not in DB
              return {
                currency: currency,
                balance: 0,
                locked_balance: 0
              }
            }
          })
        } else {
          error.value = 'Failed to load wallet data'
        }
      } catch (err) {
        console.error('Error fetching wallets:', err)
        error.value = err.message || 'Failed to load wallet data'
      } finally {
        isLoading.value = false
      }
    }

    // Calculate total balance in USD
    const totalBalanceUSD = computed(() => {
      return wallets.value.reduce((total, wallet) => {
        const price = cryptoPrices.value[wallet.currency] || 0
        const balance = wallet.balance + wallet.locked_balance
        return total + (balance * price)
      }, 0)
    })

    // Calculate available balance in USD
    const availableBalanceUSD = computed(() => {
      return wallets.value.reduce((total, wallet) => {
        const price = cryptoPrices.value[wallet.currency] || 0
        return total + (wallet.balance * price)
      }, 0)
    })

    // Calculate locked balance in USD
    const lockedBalanceUSD = computed(() => {
      return wallets.value.reduce((total, wallet) => {
        const price = cryptoPrices.value[wallet.currency] || 0
        return total + (wallet.locked_balance * price)
      }, 0)
    })

    // Get USD value for a specific wallet
    const getUSDValue = (wallet) => {
      const price = cryptoPrices.value[wallet.currency] || 0
      const balance = wallet.balance + wallet.locked_balance
      return balance * price
    }

    // Format numbers
    const formatNumber = (num) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num)
    }

    // Format crypto amounts
    const formatCrypto = (amount) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
      }).format(amount)
    }

    // Get currency full name
    const getCurrencyName = (currency) => {
      return currencyNames[currency] || currency
    }

    // Refresh all data
    const refreshData = async () => {
      await Promise.all([
        fetchWallets(),
        fetchCryptoPrices()
      ])
    }

    onMounted(async () => {
      await refreshData()

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchCryptoPrices()
      }, 30000)

      // Cleanup on unmount
      return () => clearInterval(interval)
    })

    return {
      wallets,
      isLoading,
      error,
      totalBalanceUSD,
      availableBalanceUSD,
      lockedBalanceUSD,
      getUSDValue,
      formatNumber,
      formatCrypto,
      getCurrencyName,
      canDepositWithdraw,
      refreshData
    }
  }
}
</script>