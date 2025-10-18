<template>
  <div class="withdraw-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">Withdraw Crypto</h1>
      <p class="text-gray-400">Send cryptocurrency to external wallets</p>
    </div>

    <!-- Currency Selection -->
    <div class="currency-selector">
      <label class="block text-sm font-medium text-gray-300 mb-3">
        Select Currency
      </label>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          v-for="currency in supportedCurrencies"
          :key="currency.symbol"
          @click="selectCurrency(currency.symbol)"
          :class="[
            'currency-btn',
            selectedCurrency === currency.symbol ? 'active' : ''
          ]"
        >
          <div class="flex items-center gap-2">
            <div class="currency-icon">{{ currency.symbol }}</div>
            <div class="text-left">
              <div class="font-semibold text-white">{{ currency.symbol }}</div>
              <div class="text-xs text-gray-400">{{ currency.name }}</div>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Withdrawal Form -->
    <div v-if="selectedCurrency" class="withdrawal-form-card">
      <div class="card-header">
        <h3 class="text-xl font-bold text-white">
          Withdraw {{ selectedCurrency }}
        </h3>
        <div class="balance-display">
          <span class="text-gray-400 text-sm">Available:</span>
          <span class="text-white font-bold ml-2">
            {{ formatAmount(availableBalance) }} {{ selectedCurrency }}
          </span>
        </div>
      </div>

      <form @submit.prevent="handleWithdraw" class="space-y-6">
        <!-- Withdrawal Address -->
        <div class="form-group">
          <label class="form-label">
            Withdrawal Address
            <span class="text-red-400">*</span>
          </label>
          <input
            v-model="withdrawalAddress"
            type="text"
            class="form-input"
            :placeholder="getAddressPlaceholder(selectedCurrency)"
            required
          />
          <p class="form-hint">
            Enter the {{ selectedCurrency }} address where you want to receive funds
          </p>
        </div>

        <!-- Amount -->
        <div class="form-group">
          <label class="form-label">
            Amount
            <span class="text-red-400">*</span>
          </label>
          <div class="amount-input-wrapper">
            <input
              v-model="withdrawalAmount"
              type="number"
              step="any"
              class="form-input"
              :placeholder="`Min: ${selectedCurrencyInfo?.min_withdrawal || 0}`"
              required
              @input="calculateTotal"
            />
            <div class="input-suffix">
              <span class="currency-label">{{ selectedCurrency }}</span>
              <button
                type="button"
                @click="setMaxAmount"
                class="max-btn"
              >
                MAX
              </button>
            </div>
          </div>
          <p class="form-hint">
            Minimum withdrawal: {{ selectedCurrencyInfo?.min_withdrawal }} {{ selectedCurrency }}
          </p>
        </div>

        <!-- Fee Display -->
        <div class="fee-breakdown">
          <div class="fee-row">
            <span class="text-gray-400">Withdrawal Amount:</span>
            <span class="text-white font-semibold">
              {{ formatAmount(withdrawalAmount || 0) }} {{ selectedCurrency }}
            </span>
          </div>
          <div class="fee-row">
            <span class="text-gray-400">Network Fee:</span>
            <span class="text-yellow-400 font-semibold">
              {{ formatAmount(networkFee) }} {{ selectedCurrency }}
            </span>
          </div>
          <div class="fee-row total-row">
            <span class="text-white font-bold">Total Deducted:</span>
            <span class="text-white font-bold text-lg">
              {{ formatAmount(totalAmount) }} {{ selectedCurrency }}
            </span>
          </div>
        </div>

        <!-- 2FA Token -->
        <div class="form-group">
          <label class="form-label">
            Two-Factor Authentication Code
            <span class="text-red-400">*</span>
          </label>
          <input
            v-model="twoFAToken"
            type="text"
            maxlength="6"
            pattern="\d{6}"
            class="form-input text-center text-2xl tracking-widest"
            placeholder="000000"
            required
          />
          <p class="form-hint">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <!-- Security Warning -->
        <div class="warning-box">
          <div class="warning-icon">🔒</div>
          <div>
            <h4 class="font-semibold text-white mb-2">Security Notice:</h4>
            <ul class="text-sm text-gray-300 space-y-1">
              <li>• Double-check the withdrawal address before confirming</li>
              <li>• Withdrawals are irreversible once confirmed on the blockchain</li>
              <li>• Network fees are non-refundable</li>
              <li>• Processing time may vary based on network congestion</li>
            </ul>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="!canSubmit || isProcessing"
          class="submit-btn"
          :class="{ 'processing': isProcessing }"
        >
          <span v-if="!isProcessing">
            Withdraw {{ formatAmount(totalAmount) }} {{ selectedCurrency }}
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            <div class="spinner-small"></div>
            Processing...
          </span>
        </button>

        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </form>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="modal-overlay" @click="closeSuccessModal">
      <div class="modal-content" @click.stop>
        <div class="success-icon">✅</div>
        <h3 class="text-2xl font-bold text-white mb-2">Withdrawal Initiated</h3>
        <p class="text-gray-400 mb-4">Your withdrawal has been submitted for processing</p>

        <div class="transaction-details">
          <div class="detail-row">
            <span class="text-gray-400">Amount:</span>
            <span class="text-white font-semibold">
              {{ formatAmount(successData.amount) }} {{ successData.currency }}
            </span>
          </div>
          <div class="detail-row">
            <span class="text-gray-400">Network Fee:</span>
            <span class="text-yellow-400 font-semibold">
              {{ formatAmount(successData.fee) }} {{ successData.currency }}
            </span>
          </div>
          <div class="detail-row">
            <span class="text-gray-400">Total:</span>
            <span class="text-white font-bold">
              {{ formatAmount(successData.total) }} {{ successData.currency }}
            </span>
          </div>
          <div class="detail-row">
            <span class="text-gray-400">Status:</span>
            <span class="status-badge pending">Pending</span>
          </div>
        </div>

        <p class="text-sm text-gray-400 mt-4 mb-6">
          Your withdrawal will be processed within 10-30 minutes. You can track the status in your transaction history.
        </p>

        <div class="flex gap-3">
          <button @click="viewTransactions" class="secondary-btn flex-1">
            View Transactions
          </button>
          <button @click="closeSuccessModal" class="primary-btn flex-1">
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Initial State -->
    <div v-if="!selectedCurrency" class="empty-state">
      <div class="empty-icon">💸</div>
      <h3 class="text-xl font-semibold text-white mb-2">Select a Currency</h3>
      <p class="text-gray-400">Choose a cryptocurrency above to start your withdrawal</p>
    </div>

    <!-- Loading State -->
    <div v-if="loadingBalance" class="loading-overlay">
      <div class="spinner"></div>
      <p class="text-gray-400 mt-3">Loading balance...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import walletService from '@/services/walletService';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// State
const selectedCurrency = ref('');
const withdrawalAddress = ref('');
const withdrawalAmount = ref('');
const twoFAToken = ref('');
const availableBalance = ref(0);
const networkFee = ref(0);
const totalAmount = ref(0);
const isProcessing = ref(false);
const loadingBalance = ref(false);
const errorMessage = ref('');
const showSuccessModal = ref(false);
const successData = ref({});
const supportedCurrencies = ref([]);

// Fetch supported currencies
const fetchSupportedCurrencies = async () => {
  try {
    const response = await walletService.getSupportedCurrencies();
    if (response.success) {
      supportedCurrencies.value = response.currencies;
    }
  } catch (err) {
    console.error('Failed to fetch currencies:', err);
  }
};

// Get selected currency info
const selectedCurrencyInfo = computed(() => {
  return supportedCurrencies.value.find(c => c.symbol === selectedCurrency.value);
});

// Select currency
const selectCurrency = async (currency) => {
  selectedCurrency.value = currency;
  withdrawalAddress.value = '';
  withdrawalAmount.value = '';
  twoFAToken.value = '';
  errorMessage.value = '';

  await fetchBalance();
  await calculateFee();
};

// Fetch balance for selected currency
const fetchBalance = async () => {
  if (!selectedCurrency.value) return;

  loadingBalance.value = true;
  try {
    const response = await walletService.getWallet(selectedCurrency.value);
    if (response.success && response.wallet) {
      availableBalance.value = parseFloat(response.wallet.balance) || 0;
    }
  } catch (err) {
    console.error('Failed to fetch balance:', err);
    errorMessage.value = 'Failed to load balance';
  } finally {
    loadingBalance.value = false;
  }
};

// Calculate network fee
const calculateFee = async () => {
  if (!selectedCurrency.value) return;

  try {
    const fee = await walletService.getWithdrawalFees(selectedCurrency.value);
    networkFee.value = parseFloat(fee) || 0;
    calculateTotal();
  } catch (err) {
    console.error('Failed to calculate fee:', err);
  }
};

// Calculate total amount
const calculateTotal = () => {
  const amount = parseFloat(withdrawalAmount.value) || 0;
  totalAmount.value = amount + networkFee.value;
};

// Set max amount
const setMaxAmount = () => {
  const maxWithdrawable = Math.max(0, availableBalance.value - networkFee.value);
  withdrawalAmount.value = maxWithdrawable.toString();
  calculateTotal();
};

// Format amount
const formatAmount = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toFixed(8).replace(/\.?0+$/, '');
};

// Get address placeholder
const getAddressPlaceholder = (currency) => {
  const placeholders = {
    'BTC': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'ETH': '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    'USDT': '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    'USDC': '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    'LTC': 'LhK2kQwiaAvhjWY799cZvMyYwnQAcXTJm1'
  };
  return placeholders[currency] || 'Enter wallet address';
};

// Validate form
const canSubmit = computed(() => {
  if (!selectedCurrency.value || !withdrawalAddress.value || !withdrawalAmount.value || !twoFAToken.value) {
    return false;
  }

  const amount = parseFloat(withdrawalAmount.value);
  const minWithdrawal = selectedCurrencyInfo.value?.min_withdrawal || 0;

  if (amount < minWithdrawal) {
    return false;
  }

  if (totalAmount.value > availableBalance.value) {
    return false;
  }

  if (twoFAToken.value.length !== 6) {
    return false;
  }

  return true;
});

// Handle withdrawal
const handleWithdraw = async () => {
  if (!canSubmit.value || isProcessing.value) return;

  errorMessage.value = '';
  isProcessing.value = true;

  try {
    // Validate amount
    const amount = parseFloat(withdrawalAmount.value);
    const minWithdrawal = selectedCurrencyInfo.value?.min_withdrawal || 0;

    if (amount < minWithdrawal) {
      throw new Error(`Minimum withdrawal amount is ${minWithdrawal} ${selectedCurrency.value}`);
    }

    if (totalAmount.value > availableBalance.value) {
      throw new Error('Insufficient balance for withdrawal including fees');
    }

    // Submit withdrawal
    const response = await walletService.processWithdrawal({
      currency: selectedCurrency.value,
      amount: amount,
      address: withdrawalAddress.value.trim(),
      two_fa_token: twoFAToken.value
    });

    if (response.success) {
      // Show success modal
      successData.value = {
        amount: amount,
        fee: networkFee.value,
        total: totalAmount.value,
        currency: selectedCurrency.value
      };

      showSuccessModal.value = true;

      // Reset form
      withdrawalAddress.value = '';
      withdrawalAmount.value = '';
      twoFAToken.value = '';
      totalAmount.value = 0;

      // Refresh balance
      await fetchBalance();

      notificationStore.success(
        'Withdrawal Initiated',
        `Your withdrawal of ${formatAmount(amount)} ${selectedCurrency.value} has been submitted`
      );
    } else {
      throw new Error(response.error || 'Withdrawal failed');
    }
  } catch (err) {
    console.error('Withdrawal error:', err);
    errorMessage.value = err.message || 'Failed to process withdrawal';
    notificationStore.error('Withdrawal Failed', errorMessage.value);
  } finally {
    isProcessing.value = false;
  }
};

// Close success modal
const closeSuccessModal = () => {
  showSuccessModal.value = false;
  successData.value = {};
};

// View transactions
const viewTransactions = () => {
  closeSuccessModal();
  router.push('/wallet/history');
};

// Watch for currency changes to recalculate fee
watch(selectedCurrency, () => {
  calculateFee();
});

// Fetch currencies on mount
fetchSupportedCurrencies();
</script>

<style scoped>
.withdraw-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.currency-selector {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.currency-btn {
  background: #0f1117;
  border: 2px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.currency-btn:hover {
  border-color: #4299e1;
  transform: translateY(-2px);
}

.currency-btn.active {
  border-color: #4299e1;
  background: linear-gradient(135deg, rgba(66, 153, 225, 0.1), rgba(72, 187, 120, 0.1));
}

.currency-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
  color: white;
}

.withdrawal-form-card {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.balance-display {
  padding: 0.5rem 1rem;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  color: #e2e8f0;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: white;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #4299e1;
}

.form-input::placeholder {
  color: #4a5568;
}

.form-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #718096;
}

.amount-input-wrapper {
  position: relative;
}

.input-suffix {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.currency-label {
  color: #a0aec0;
  font-weight: 600;
}

.max-btn {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.max-btn:hover {
  background: #3182ce;
}

.fee-breakdown {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  margin: 1.5rem 0;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.fee-row.total-row {
  border-top: 2px solid #2d3748;
  margin-top: 0.5rem;
  padding-top: 1rem;
}

.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
}

.warning-icon {
  font-size: 1.5rem;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #4299e1 0%, #48bb78 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn.processing {
  background: #718096;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-message {
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 8px;
  padding: 1rem;
  color: #fc8181;
  text-align: center;
  margin-top: 1rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.transaction-details {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  margin: 1.5rem 0;
  text-align: left;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.pending {
  background: rgba(66, 153, 225, 0.2);
  color: #4299e1;
}

.primary-btn {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-btn:hover {
  background: #3182ce;
}

.secondary-btn {
  background: transparent;
  color: #4299e1;
  border: 1px solid #4299e1;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: rgba(66, 153, 225, 0.1);
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #2d3748;
  border-top-color: #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .withdraw-page {
    padding: 1rem;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .balance-display {
    width: 100%;
  }
}
</style>
