<template>
  <div class="container mx-auto px-4 py-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          View and filter your deposits and withdrawals
        </p>
      </div>

      <!-- Filters -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Type Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              v-model="filters.type"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
          </div>

          <!-- Currency Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currency
            </label>
            <select
              v-model="filters.currency"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Currencies</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="USDT">Tether (USDT)</option>
              <option value="USDC">USD Coin (USDC)</option>
              <option value="LTC">Litecoin (LTC)</option>
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
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          <!-- Reset Filters -->
          <div class="flex items-end">
            <button
              @click="resetFilters"
              class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="p-12 text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading transactions...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && transactions.length === 0" class="p-12 text-center">
        <svg
          class="mx-auto h-16 w-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No transactions found</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ hasActiveFilters ? 'Try adjusting your filters or' : 'Start by making a deposit or withdrawal' }}
        </p>
        <div class="mt-6 flex gap-3 justify-center">
          <router-link
            to="/wallet/deposit"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Make a Deposit
          </router-link>
          <router-link
            to="/wallet/withdraw"
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Make a Withdrawal
          </router-link>
        </div>
      </div>

      <!-- Transactions List -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="transaction in transactions"
          :key="transaction.id"
          class="p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
          @click="showTransactionDetails(transaction)"
        >
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <!-- Left: Type, Currency, and Details -->
            <div class="flex items-center space-x-3 sm:space-x-4 flex-1">
              <!-- Icon -->
              <div
                :class="[
                  'flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center',
                  transaction.type === 'deposit' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                ]"
              >
                <svg
                  v-if="transaction.type === 'deposit'"
                  class="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </div>

              <!-- Transaction Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-2">
                  <h3 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white capitalize">
                    {{ transaction.type }}
                  </h3>
                  <span
                    :class="[
                      'px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap',
                      getStatusClass(transaction.status)
                    ]"
                  >
                    {{ transaction.status }}
                  </span>
                </div>
                <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ formatDate(transaction.created_at) }}
                </p>
                <p v-if="transaction.tx_hash" class="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono truncate max-w-[200px] sm:max-w-md">
                  TX: {{ transaction.tx_hash }}
                </p>
              </div>
            </div>

            <!-- Right: Amount and Currency -->
            <div class="text-right sm:ml-4 pl-13 sm:pl-0">
              <div
                :class="[
                  'text-base sm:text-lg font-bold',
                  transaction.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                ]"
              >
                {{ transaction.type === 'deposit' ? '+' : '-' }}{{ formatAmount(Math.abs(transaction.amount)) }}
                <span class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{{ transaction.currency }}</span>
              </div>
              <p v-if="transaction.fee > 0" class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Fee: {{ formatAmount(transaction.fee) }} {{ transaction.currency }}
              </p>
              <p v-if="transaction.confirmations !== undefined && transaction.requires_confirmations" class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ transaction.confirmations }}/{{ transaction.required_confirmations }} confirmations
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && transactions.length > 0" class="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Showing {{ transactions.length }} of {{ totalTransactions }} transactions
          </div>
          <div class="flex space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
              ]"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="transactions.length < pageSize"
              :class="[
                'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                transactions.length < pageSize
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
              ]"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction Details Modal -->
    <div
      v-if="selectedTransaction"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
      @click.self="selectedTransaction = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Transaction Details</h2>
            <button
              @click="selectedTransaction = null"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-4 sm:p-6 space-y-4">
          <!-- Status Badge -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
            <span
              :class="[
                'px-3 py-1 text-sm font-medium rounded-full',
                getStatusClass(selectedTransaction.status)
              ]"
            >
              {{ selectedTransaction.status }}
            </span>
          </div>

          <!-- Type -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Type</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white capitalize">
              {{ selectedTransaction.type }}
            </span>
          </div>

          <!-- Amount -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Amount</span>
            <span
              :class="[
                'text-lg font-bold',
                selectedTransaction.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              ]"
            >
              {{ selectedTransaction.type === 'deposit' ? '+' : '-' }}{{ formatAmount(Math.abs(selectedTransaction.amount)) }}
              {{ selectedTransaction.currency }}
            </span>
          </div>

          <!-- Fee -->
          <div v-if="selectedTransaction.fee > 0" class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Fee</span>
            <span class="text-sm text-gray-900 dark:text-white">
              {{ formatAmount(selectedTransaction.fee) }} {{ selectedTransaction.currency }}
            </span>
          </div>

          <!-- Net Amount -->
          <div v-if="selectedTransaction.fee > 0" class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Net Amount</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatAmount(selectedTransaction.net_amount) }} {{ selectedTransaction.currency }}
            </span>
          </div>

          <!-- Currency -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Currency</span>
            <span class="text-sm text-gray-900 dark:text-white">{{ selectedTransaction.currency }}</span>
          </div>

          <!-- Transaction Hash -->
          <div v-if="selectedTransaction.tx_hash" class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Transaction Hash</span>
            <div class="text-left sm:text-right max-w-full sm:max-w-xs">
              <span class="text-xs font-mono text-gray-900 dark:text-white break-all">
                {{ selectedTransaction.tx_hash }}
              </span>
            </div>
          </div>

          <!-- Confirmations -->
          <div v-if="selectedTransaction.confirmations !== undefined" class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Confirmations</span>
            <span class="text-sm text-gray-900 dark:text-white">
              {{ selectedTransaction.confirmations }}
              <span v-if="selectedTransaction.required_confirmations">
                / {{ selectedTransaction.required_confirmations }}
              </span>
            </span>
          </div>

          <!-- Block Height -->
          <div v-if="selectedTransaction.block_height" class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Block Height</span>
            <span class="text-sm text-gray-900 dark:text-white">{{ selectedTransaction.block_height }}</span>
          </div>

          <!-- Created At -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Created</span>
            <span class="text-sm text-gray-900 dark:text-white">
              {{ formatDate(selectedTransaction.created_at) }}
            </span>
          </div>

          <!-- Completed At -->
          <div v-if="selectedTransaction.completed_at" class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</span>
            <span class="text-sm text-gray-900 dark:text-white">
              {{ formatDate(selectedTransaction.completed_at) }}
            </span>
          </div>

          <!-- Notes -->
          <div v-if="selectedTransaction.notes" class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</span>
            <p class="mt-2 text-sm text-gray-900 dark:text-white break-words">{{ selectedTransaction.notes }}</p>
          </div>
        </div>

        <div class="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            @click="selectedTransaction = null"
            class="w-full px-4 py-2 text-sm sm:text-base bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import walletService from '@/services/walletService'

export default {
  name: 'WalletHistory',
  setup() {
    const loading = ref(false)
    const transactions = ref([])
    const totalTransactions = ref(0)
    const selectedTransaction = ref(null)

    const currentPage = ref(1)
    const pageSize = ref(20)

    const filters = ref({
      type: '',
      currency: '',
      status: ''
    })

    const hasActiveFilters = computed(() => {
      return filters.value.type || filters.value.currency || filters.value.status
    })

    const fetchTransactions = async () => {
      try {
        loading.value = true

        const options = {
          limit: pageSize.value,
          offset: (currentPage.value - 1) * pageSize.value
        }

        if (filters.value.type) options.type = filters.value.type
        if (filters.value.currency) options.currency = filters.value.currency
        if (filters.value.status) options.status = filters.value.status

        const response = await walletService.getTransactionHistory(options)

        if (response.success) {
          transactions.value = response.transactions || []
          totalTransactions.value = response.total || transactions.value.length
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error)
        transactions.value = []
      } finally {
        loading.value = false
      }
    }

    const applyFilters = () => {
      currentPage.value = 1
      fetchTransactions()
    }

    const resetFilters = () => {
      filters.value = {
        type: '',
        currency: '',
        status: ''
      }
      currentPage.value = 1
      fetchTransactions()
    }

    const nextPage = () => {
      if (transactions.value.length >= pageSize.value) {
        currentPage.value++
        fetchTransactions()
      }
    }

    const previousPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--
        fetchTransactions()
      }
    }

    const showTransactionDetails = (transaction) => {
      selectedTransaction.value = transaction
    }

    const getStatusClass = (status) => {
      const classes = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        processing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      }
      return classes[status] || classes.pending
    }

    const formatAmount = (amount) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
      }).format(amount)
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date)
    }

    onMounted(() => {
      fetchTransactions()
    })

    return {
      loading,
      transactions,
      totalTransactions,
      selectedTransaction,
      currentPage,
      pageSize,
      filters,
      hasActiveFilters,
      applyFilters,
      resetFilters,
      nextPage,
      previousPage,
      showTransactionDetails,
      getStatusClass,
      formatAmount,
      formatDate
    }
  }
}
</script>

<style scoped>
/* Custom scrollbar for modal */
.max-h-\[90vh\]::-webkit-scrollbar {
  width: 8px;
}

.max-h-\[90vh\]::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Dark mode scrollbar */
.dark .max-h-\[90vh\]::-webkit-scrollbar-track {
  background: #374151;
}

.dark .max-h-\[90vh\]::-webkit-scrollbar-thumb {
  background: #6b7280;
}

.dark .max-h-\[90vh\]::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .history-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .filters-section {
    padding: 1rem;
  }

  .filters-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .transactions-table {
    font-size: 0.875rem;
  }

  .transactions-table th,
  .transactions-table td {
    padding: 0.75rem 0.5rem;
  }

  /* Make table scrollable horizontally on mobile */
  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .transactions-table {
    min-width: 600px;
  }
}

@media (max-width: 480px) {
  .history-page {
    padding: 0.75rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }

  .filters-section {
    padding: 0.75rem;
  }

  .transactions-table {
    font-size: 0.75rem;
    min-width: 550px;
  }

  .transactions-table th,
  .transactions-table td {
    padding: 0.5rem 0.375rem;
  }

  .status-badge,
  .type-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
  }
}
</style>
