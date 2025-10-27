<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-2">View and manage your trading orders</p>
          </div>
          <button
            @click="refreshOrders"
            :disabled="isLoading"
            class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Order Type Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order Type
            </label>
            <select
              v-model="filters.orderType"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Orders</option>
              <option value="limit">Limit Orders</option>
              <option value="market">Market Orders</option>
            </select>
          </div>

          <!-- Status Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              v-model="filters.status"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="filled">Filled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <!-- Token Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token
            </label>
            <select
              v-model="filters.token"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Tokens</option>
              <option v-for="token in tokens" :key="token" :value="token">{{ token }}</option>
            </select>
          </div>

          <!-- Clear Filters -->
          <div class="flex items-end">
            <button
              @click="clearFilters"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p class="mt-4 text-gray-500 dark:text-gray-400">Loading orders...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <button @click="refreshOrders" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Try Again
          </button>
        </div>

        <!-- Orders List -->
        <div v-else-if="filteredOrders.length > 0">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pair
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price/Rate
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Filled
                  </th>
                  <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {{ formatDate(order.created_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'px-2 py-1 text-xs font-semibold rounded',
                        order.order_type === 'limit'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      ]"
                    >
                      {{ order.order_type === 'limit' ? 'Limit' : 'Market' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ order.from_token }} → {{ order.to_token }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                    {{ formatAmount(order.from_amount) }} {{ order.from_token }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                    <span v-if="order.order_type === 'limit'">
                      {{ formatAmount(order.target_price) }}
                    </span>
                    <span v-else>
                      {{ formatAmount(order.rate) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                    <span v-if="order.order_type === 'limit' && order.filled_amount">
                      {{ formatAmount(order.filled_amount) }} {{ order.to_token }}
                    </span>
                    <span v-else-if="order.order_type === 'market'">
                      {{ formatAmount(order.to_amount) }} {{ order.to_token }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      :class="[
                        'px-2 py-1 text-xs font-semibold rounded',
                        getStatusClass(order.status)
                      ]"
                    >
                      {{ order.status.toUpperCase() }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      v-if="order.status === 'open'"
                      @click="cancelOrder(order.id)"
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Cancel
                    </button>
                    <span v-else class="text-gray-400">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600 sm:px-6">
            <div class="flex-1 flex justify-between sm:hidden">
              <button
                @click="previousPage"
                :disabled="currentPage === 1"
                class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                @click="nextPage"
                :disabled="currentPage >= totalPages"
                class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing
                  <span class="font-medium">{{ (currentPage - 1) * pageSize + 1 }}</span>
                  to
                  <span class="font-medium">{{ Math.min(currentPage * pageSize, filteredOrders.length) }}</span>
                  of
                  <span class="font-medium">{{ filteredOrders.length }}</span>
                  orders
                </p>
              </div>
              <div>
                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    @click="previousPage"
                    :disabled="currentPage === 1"
                    class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span class="sr-only">Previous</span>
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <button
                    @click="nextPage"
                    :disabled="currentPage >= totalPages"
                    class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span class="sr-only">Next</span>
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400 mb-4">No orders found</p>
          <router-link to="/trading" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Start Trading
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { apiHelpers } from '@/services/api'

export default {
  name: 'Orders',
  setup() {
    const notificationStore = useNotificationStore()

    const limitOrders = ref([])
    const swapHistory = ref([])
    const isLoading = ref(true)
    const error = ref(null)

    const tokens = ref([
      'BTC', 'ETH', 'USDT', 'USDC', 'ADA', 'LTC', 'XRP', 'DOGE', 'DOT',
      'SOL', 'MATIC', 'LINK', 'ATOM', 'UNI', 'AVAX', 'BNB', 'XLM'
    ])

    // Filters
    const filters = ref({
      orderType: 'all',
      status: 'all',
      token: 'all'
    })

    // Pagination
    const currentPage = ref(1)
    const pageSize = ref(20)

    // Combine and format all orders
    const allOrders = computed(() => {
      const orders = []

      // Add limit orders
      limitOrders.value.forEach(order => {
        orders.push({
          ...order,
          order_type: 'limit'
        })
      })

      // Add market orders (swaps)
      swapHistory.value.forEach(swap => {
        orders.push({
          ...swap,
          order_type: 'market'
        })
      })

      // Sort by date (newest first)
      orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      return orders
    })

    // Filtered orders
    const filteredOrders = computed(() => {
      let orders = allOrders.value

      // Filter by order type
      if (filters.value.orderType !== 'all') {
        orders = orders.filter(order => order.order_type === filters.value.orderType)
      }

      // Filter by status
      if (filters.value.status !== 'all') {
        orders = orders.filter(order => order.status === filters.value.status)
      }

      // Filter by token
      if (filters.value.token !== 'all') {
        orders = orders.filter(order =>
          order.from_token === filters.value.token || order.to_token === filters.value.token
        )
      }

      return orders
    })

    // Paginated orders
    const paginatedOrders = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return filteredOrders.value.slice(start, end)
    })

    const totalPages = computed(() => {
      return Math.ceil(filteredOrders.value.length / pageSize.value)
    })

    // Fetch limit orders
    const fetchLimitOrders = async () => {
      try {
        const response = await apiHelpers.get('/api/swap/limit')
        if (response.success) {
          limitOrders.value = response.orders
        }
      } catch (err) {
        console.error('Failed to fetch limit orders:', err)
      }
    }

    // Fetch swap history
    const fetchSwapHistory = async () => {
      try {
        const response = await apiHelpers.get('/api/swap/history', { limit: 100 })
        if (response.success) {
          swapHistory.value = response.swaps
        }
      } catch (err) {
        console.error('Failed to fetch swap history:', err)
      }
    }

    // Refresh orders
    const refreshOrders = async () => {
      try {
        isLoading.value = true
        error.value = null
        await Promise.all([fetchLimitOrders(), fetchSwapHistory()])
      } catch (err) {
        error.value = err.message || 'Failed to load orders'
      } finally {
        isLoading.value = false
      }
    }

    // Cancel order
    const cancelOrder = async (orderId) => {
      try {
        const response = await apiHelpers.delete(`/api/swap/limit/${orderId}`)
        if (response.success) {
          notificationStore.success('Order Cancelled', 'Limit order cancelled successfully')
          await refreshOrders()
        }
      } catch (err) {
        notificationStore.error('Cancel Failed', err.message || 'Failed to cancel order')
      }
    }

    // Apply filters
    const applyFilters = () => {
      currentPage.value = 1 // Reset to first page when filtering
    }

    // Clear filters
    const clearFilters = () => {
      filters.value = {
        orderType: 'all',
        status: 'all',
        token: 'all'
      }
      currentPage.value = 1
    }

    // Pagination
    const nextPage = () => {
      if (currentPage.value < totalPages.value) {
        currentPage.value++
      }
    }

    const previousPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--
      }
    }

    // Format helpers
    const formatDate = (date) => {
      return new Date(date).toLocaleString()
    }

    const formatAmount = (amount) => {
      return parseFloat(amount || 0).toFixed(4)
    }

    const getStatusClass = (status) => {
      const classes = {
        open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        filled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }
      return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }

    onMounted(() => {
      refreshOrders()
    })

    return {
      limitOrders,
      swapHistory,
      isLoading,
      error,
      tokens,
      filters,
      allOrders,
      filteredOrders: paginatedOrders,
      currentPage,
      pageSize,
      totalPages,
      refreshOrders,
      cancelOrder,
      applyFilters,
      clearFilters,
      nextPage,
      previousPage,
      formatDate,
      formatAmount,
      getStatusClass
    }
  }
}
</script>
