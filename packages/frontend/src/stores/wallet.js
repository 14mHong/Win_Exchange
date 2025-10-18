import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import walletService from '@/services/walletService'
import { useNotificationStore } from './notification'

export const useWalletStore = defineStore('wallet', () => {
  // State
  const wallets = ref([])
  const transactions = ref([])
  const supportedCurrencies = ref([])
  const isLoading = ref(false)
  const depositAddresses = ref({})
  const walletStats = ref({})

  // Getters
  const totalPortfolioValue = computed(() => {
    // This would require market prices to calculate USD value
    // For MVP, we'll just return the number of currencies with balance
    return wallets.value.filter(wallet => wallet.total_balance > 0).length
  })

  const getWalletByCurrency = computed(() => (currency) => {
    return wallets.value.find(wallet => wallet.currency === currency)
  })

  const getDepositAddress = computed(() => (currency) => {
    return depositAddresses.value[currency]
  })

  const pendingTransactions = computed(() => {
    return transactions.value.filter(tx => tx.status === 'pending' || tx.status === 'processing')
  })

  const recentTransactions = computed(() => {
    return transactions.value.slice(0, 10) // Last 10 transactions
  })

  const transactionsByType = computed(() => (type) => {
    return transactions.value.filter(tx => tx.type === type)
  })

  const balancesByCurrency = computed(() => {
    const balances = {}
    wallets.value.forEach(wallet => {
      balances[wallet.currency] = {
        available: wallet.balance,
        locked: wallet.locked_balance,
        total: wallet.total_balance
      }
    })
    return balances
  })

  // Actions
  const fetchWallets = async () => {
    try {
      isLoading.value = true
      const response = await walletService.getWallets()
      
      if (response.success) {
        wallets.value = response.wallets || []
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetchWallet = async (currency) => {
    try {
      const response = await walletService.getWallet(currency)
      
      if (response.success) {
        // Update the specific wallet in the array
        const index = wallets.value.findIndex(w => w.currency === currency)
        if (index > -1) {
          wallets.value[index] = response.wallet
        } else {
          wallets.value.push(response.wallet)
        }
        
        return response.wallet
      }
    } catch (error) {
      console.error(`Failed to fetch ${currency} wallet:`, error)
      throw error
    }
  }

  const fetchSupportedCurrencies = async () => {
    try {
      const response = await walletService.getSupportedCurrencies()
      
      if (response.success) {
        supportedCurrencies.value = response.currencies || []
      }
    } catch (error) {
      console.error('Failed to fetch supported currencies:', error)
    }
  }

  const generateDepositAddress = async (currency) => {
    const notificationStore = useNotificationStore()
    
    try {
      const response = await walletService.generateDepositAddress(currency)
      
      if (response.success) {
        depositAddresses.value[currency] = response.address
        
        notificationStore.success(
          'Deposit Address Generated',
          `Your ${currency} deposit address has been generated`
        )
        
        return response
      }
    } catch (error) {
      notificationStore.error(
        'Address Generation Failed',
        error.message || `Failed to generate ${currency} deposit address`
      )
      throw error
    }
  }

  const simulateDeposit = async (currency, amount) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await walletService.simulateDeposit(currency, amount) // eslint-disable-line no-unused-vars
      
      if (response.success) {
        notificationStore.success(
          'Deposit Simulated',
          `${amount} ${currency} deposit has been initiated`
        )
        
        // Add transaction to local state
        if (response.transaction) {
          transactions.value.unshift(response.transaction)
        }
        
        return response
      }
    } catch (error) {
      notificationStore.error(
        'Deposit Failed',
        error.message || 'Failed to process deposit'
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const processWithdrawal = async (withdrawalData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await walletService.processWithdrawal(withdrawalData)
      
      if (response.success) {
        notificationStore.success(
          'Withdrawal Initiated',
          `Your ${withdrawalData.currency} withdrawal has been initiated`
        )
        
        // Add transaction to local state
        if (response.transaction) {
          transactions.value.unshift(response.transaction)
        }
        
        // Update wallet balance
        await fetchWallet(withdrawalData.currency)
        
        return response
      }
    } catch (error) {
      notificationStore.error(
        'Withdrawal Failed',
        error.message || 'Failed to process withdrawal'
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const internalTransfer = async (transferData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await walletService.internalTransfer(transferData)
      
      if (response.success) {
        notificationStore.success(
          'Transfer Completed',
          `Successfully transferred ${transferData.amount} ${transferData.currency}`
        )
        
        // Refresh wallets
        await fetchWallets()
        
        return response
      }
    } catch (error) {
      notificationStore.error(
        'Transfer Failed',
        error.message || 'Failed to process transfer'
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetchTransactionHistory = async (options = {}) => {
    try {
      isLoading.value = true
      const response = await walletService.getTransactionHistory(options)
      
      if (response.success) {
        if (options.append) {
          transactions.value.push(...response.transactions)
        } else {
          transactions.value = response.transactions || []
        }
        
        return {
          transactions: response.transactions,
          total: response.total
        }
      }
    } catch (error) {
      console.error('Failed to fetch transaction history:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetchTransaction = async (transactionId) => {
    try {
      const response = await walletService.getTransaction(transactionId)
      
      if (response.success) {
        return response.transaction
      }
    } catch (error) {
      console.error('Failed to fetch transaction:', error)
      throw error
    }
  }

  const fetchWalletStats = async () => {
    try {
      const response = await walletService.getWalletStats()
      
      if (response.success) {
        walletStats.value = response
      }
    } catch (error) {
      console.error('Failed to fetch wallet stats:', error)
    }
  }

  const refreshWalletData = async () => {
    await Promise.all([
      fetchWallets(),
      fetchTransactionHistory({ limit: 20 }),
      fetchWalletStats()
    ])
  }

  const getTransactionIcon = (transaction) => {
    switch (transaction.type) {
    case 'deposit':
      return 'arrow-down-circle'
    case 'withdrawal':
      return 'arrow-up-circle'
    case 'trade_buy':
      return 'shopping-cart'
    case 'trade_sell':
      return 'trending-up'
    case 'fee':
      return 'minus-circle'
    default:
      return 'help-circle'
    }
  }

  const getTransactionColor = (transaction) => {
    switch (transaction.type) {
    case 'deposit':
      return 'text-success-600'
    case 'withdrawal':
      return 'text-danger-600'
    case 'trade_buy':
      return 'text-primary-600'
    case 'trade_sell':
      return 'text-warning-600'
    case 'fee':
      return 'text-gray-600'
    default:
      return 'text-gray-600'
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
    case 'completed':
      return 'badge-success'
    case 'pending':
    case 'processing':
      return 'badge-warning'
    case 'failed':
    case 'canceled':
      return 'badge-danger'
    default:
      return 'badge-primary'
    }
  }

  const formatCurrency = (amount, currency) => {
    const currencyInfo = supportedCurrencies.value.find(c => c.symbol === currency)
    const decimals = currencyInfo?.decimals || 8
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: Math.min(2, decimals),
      maximumFractionDigits: decimals
    }).format(amount)
  }

  const canWithdraw = (currency, amount) => {
    const wallet = getWalletByCurrency.value(currency)
    const currencyInfo = supportedCurrencies.value.find(c => c.symbol === currency)
    
    if (!wallet || !currencyInfo) {return false}
    
    return wallet.balance >= amount && amount >= currencyInfo.min_withdrawal
  }

  const getWithdrawalFee = (currency, _amount) => {
    const currencyInfo = supportedCurrencies.value.find(c => c.symbol === currency)
    return currencyInfo?.withdrawal_fee || 0
  }

  const getMinWithdrawal = (currency) => {
    const currencyInfo = supportedCurrencies.value.find(c => c.symbol === currency)
    return currencyInfo?.min_withdrawal || 0
  }

  const getMinDeposit = (currency) => {
    const currencyInfo = supportedCurrencies.value.find(c => c.symbol === currency)
    return currencyInfo?.min_deposit || 0
  }

  return {
    // State
    wallets,
    transactions,
    supportedCurrencies,
    isLoading,
    depositAddresses,
    walletStats,

    // Getters
    totalPortfolioValue,
    getWalletByCurrency,
    getDepositAddress,
    pendingTransactions,
    recentTransactions,
    transactionsByType,
    balancesByCurrency,

    // Actions
    fetchWallets,
    fetchWallet,
    fetchSupportedCurrencies,
    generateDepositAddress,
    simulateDeposit,
    processWithdrawal,
    internalTransfer,
    fetchTransactionHistory,
    fetchTransaction,
    fetchWalletStats,
    refreshWalletData,

    // Utility functions
    getTransactionIcon,
    getTransactionColor,
    getStatusBadgeColor,
    formatCurrency,
    canWithdraw,
    getWithdrawalFee,
    getMinWithdrawal,
    getMinDeposit
  }
})