import { apiHelpers } from './api'

const walletService = {
  // Get all user wallets
  getWallets: async () => {
    return await apiHelpers.get('/api/wallet/wallets')
  },

  // Get specific wallet by currency
  getWallet: async (currency) => {
    return await apiHelpers.get(`/api/wallet/wallets/${currency}`)
  },

  // Get supported currencies
  getSupportedCurrencies: async () => {
    return await apiHelpers.get('/api/wallet/currencies')
  },

  // Get wallet statistics
  getWalletStats: async () => {
    return await apiHelpers.get('/api/wallet/stats')
  },

  // Generate deposit address
  generateDepositAddress: async (currency) => {
    return await apiHelpers.get(`/api/wallet/deposit/${currency}/address`)
  },

  // Simulate deposit (for MVP testing)
  simulateDeposit: async (currency, amount) => {
    return await apiHelpers.post('/api/wallet/deposit/simulate', {
      currency,
      amount
    })
  },

  // Process withdrawal
  processWithdrawal: async (withdrawalData) => {
    // Set 2FA token if provided
    if (withdrawalData.two_fa_token) {
      apiHelpers.set2FAToken(withdrawalData.two_fa_token)
    }

    try {
      const result = await apiHelpers.post('/api/wallet/withdraw', withdrawalData)
      return result
    } finally {
      apiHelpers.set2FAToken(null)
    }
  },

  // Internal transfer between users
  internalTransfer: async (transferData) => {
    // Set 2FA token if provided
    if (transferData.two_fa_token) {
      apiHelpers.set2FAToken(transferData.two_fa_token)
    }

    try {
      const result = await apiHelpers.post('/api/wallet/transfer', transferData)
      return result
    } finally {
      apiHelpers.set2FAToken(null)
    }
  },

  // Get transaction history
  getTransactionHistory: async (options = {}) => {
    return await apiHelpers.get('/api/wallet/transactions', options)
  },

  // Get specific transaction
  getTransaction: async (transactionId) => {
    return await apiHelpers.get(`/api/wallet/transactions/${transactionId}`)
  },

  // Export transaction history
  exportTransactionHistory: async (format = 'csv', options = {}) => {
    const filename = `transactions_${new Date().toISOString().split('T')[0]}.${format}`
    return await apiHelpers.downloadFile('/api/wallet/transactions/export', filename, {
      format,
      ...options
    })
  },

  // Validate withdrawal address
  validateWithdrawalAddress: async (currency, address) => {
    return await apiHelpers.post('/api/wallet/validate-address', {
      currency,
      address
    })
  },

  // Get withdrawal fees
  getWithdrawalFees: async (currency) => {
    const currencies = await walletService.getSupportedCurrencies()
    const currencyInfo = currencies.currencies?.find(c => c.symbol === currency)
    return currencyInfo?.withdrawal_fee || 0
  },

  // Get minimum withdrawal amount
  getMinWithdrawal: async (currency) => {
    const currencies = await walletService.getSupportedCurrencies()
    const currencyInfo = currencies.currencies?.find(c => c.symbol === currency)
    return currencyInfo?.min_withdrawal || 0
  },

  // Get minimum deposit amount
  getMinDeposit: async (currency) => {
    const currencies = await walletService.getSupportedCurrencies()
    const currencyInfo = currencies.currencies?.find(c => c.symbol === currency)
    return currencyInfo?.min_deposit || 0
  },

  // Calculate total withdrawal amount (including fees)
  calculateWithdrawalTotal: async (currency, amount) => {
    const fee = await walletService.getWithdrawalFees(currency)
    return parseFloat(amount) + parseFloat(fee)
  },

  // Format currency amount
  formatCurrencyAmount: (amount, currency, options = {}) => {
    const { 
      minimumFractionDigits = 2, 
      maximumFractionDigits = 8,
      notation = 'standard'
    } = options

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits,
      maximumFractionDigits,
      notation
    }).format(amount)
  },

  // Get currency icon/logo URL
  getCurrencyIcon: (currency) => {
    const iconMap = {
      'BTC': '/icons/btc.svg',
      'ETH': '/icons/eth.svg',
      'USDT': '/icons/usdt.svg',
      'LTC': '/icons/ltc.svg',
      'ADA': '/icons/ada.svg'
    }
    
    return iconMap[currency] || '/icons/default-coin.svg'
  },

  // Generate QR code for deposit address
  generateDepositQR: (currency, address) => {
    const qrData = currency === 'BTC' ? 
      `bitcoin:${address}` : 
      `${currency.toLowerCase()}:${address}`
    
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
  },

  // Check transaction status
  checkTransactionStatus: async (transactionId) => {
    const transaction = await walletService.getTransaction(transactionId)
    return transaction.transaction?.status || 'unknown'
  },

  // Get pending transactions count
  getPendingTransactionsCount: async () => {
    const transactions = await walletService.getTransactionHistory({ 
      status: 'pending', 
      limit: 1 
    })
    return transactions.total || 0
  },

  // Calculate portfolio value (simplified - would need price data in production)
  calculatePortfolioValue: async (wallets, prices = {}) => {
    let totalValue = 0
    
    wallets.forEach(wallet => {
      const price = prices[wallet.currency] || 0
      totalValue += wallet.total_balance * price
    })
    
    return totalValue
  },

  // Get currency conversion rate
  getCurrencyConversion: async (fromCurrency, toCurrency, amount) => {
    // This would integrate with a price API in production
    // For MVP, return mock data
    const mockRates = {
      'BTC-USDT': 45000,
      'ETH-USDT': 3000,
      'LTC-USDT': 100,
      'ADA-USDT': 0.5
    }
    
    const rate = mockRates[`${fromCurrency}-${toCurrency}`] || 1
    return {
      fromCurrency,
      toCurrency,
      amount,
      rate,
      convertedAmount: amount * rate
    }
  },

  // Validate transaction amount
  validateTransactionAmount: async (currency, amount, type = 'withdrawal') => {
    const currencies = await walletService.getSupportedCurrencies()
    const currencyInfo = currencies.currencies?.find(c => c.symbol === currency)
    
    if (!currencyInfo) {
      return { valid: false, error: 'Unsupported currency' }
    }
    
    const minAmount = type === 'withdrawal' ? 
      currencyInfo.min_withdrawal : 
      currencyInfo.min_deposit
    
    if (amount < minAmount) {
      return { 
        valid: false, 
        error: `Minimum ${type} amount is ${minAmount} ${currency}` 
      }
    }
    
    if (amount > currencyInfo.max_order_size) {
      return { 
        valid: false, 
        error: `Maximum ${type} amount is ${currencyInfo.max_order_size} ${currency}` 
      }
    }
    
    return { valid: true }
  },

  // Get transaction confirmation requirements
  getConfirmationRequirements: (currency) => {
    const requirements = {
      'BTC': 6,
      'ETH': 12,
      'LTC': 6,
      'ADA': 15,
      'USDT': 12
    }
    
    return requirements[currency] || 6
  },

  // Estimate transaction time
  estimateTransactionTime: (currency, type = 'deposit') => {
    const times = {
      'BTC': { deposit: '10-60 minutes', withdrawal: '10-60 minutes' },
      'ETH': { deposit: '5-15 minutes', withdrawal: '5-15 minutes' },
      'LTC': { deposit: '5-30 minutes', withdrawal: '5-30 minutes' },
      'ADA': { deposit: '5-20 minutes', withdrawal: '5-20 minutes' },
      'USDT': { deposit: '5-15 minutes', withdrawal: '5-15 minutes' }
    }
    
    return times[currency]?.[type] || '5-30 minutes'
  },

  // Backup wallet data
  backupWalletData: async () => {
    const wallets = await walletService.getWallets()
    const transactions = await walletService.getTransactionHistory({ limit: 1000 })
    
    const backupData = {
      timestamp: new Date().toISOString(),
      wallets: wallets.wallets,
      transactions: transactions.transactions
    }
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
      type: 'application/json' 
    })
    
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = `wallet_backup_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    window.URL.revokeObjectURL(link.href)
  }
}

export default walletService