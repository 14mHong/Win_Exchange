<template>
  <div class="deposit-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">Deposit Crypto</h1>
      <p class="text-gray-400">Choose a cryptocurrency to deposit</p>
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

    <!-- Deposit Address Display -->
    <div v-if="depositAddress" class="deposit-address-card">
      <div class="card-header">
        <h3 class="text-xl font-bold text-white">
          {{ selectedCurrency }} Deposit Address
        </h3>
        <span class="badge">{{ depositNetwork }}</span>
      </div>

      <!-- QR Code -->
      <div class="qr-code-container">
        <div class="qr-code-wrapper">
          <canvas ref="qrCanvas" class="qr-canvas"></canvas>
        </div>
        <p class="text-sm text-gray-400 mt-2">Scan QR code to deposit</p>
      </div>

      <!-- Address Display -->
      <div class="address-display">
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Deposit Address
        </label>
        <div class="address-box">
          <input
            type="text"
            :value="depositAddress"
            readonly
            class="address-input"
          />
          <button @click="copyAddress" class="copy-btn" :class="{ copied: copied }">
            <svg v-if="!copied" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>
      </div>

      <!-- Important Notes -->
      <div class="warning-box">
        <div class="warning-icon">⚠️</div>
        <div>
          <h4 class="font-semibold text-white mb-2">Important Notes:</h4>
          <ul class="text-sm text-gray-300 space-y-1">
            <li>• Only send <strong>{{ selectedCurrency }}</strong> to this address</li>
            <li>• Minimum deposit: <strong>{{ selectedCurrencyInfo?.min_deposit }} {{ selectedCurrency }}</strong></li>
            <li>• Confirmations required: <strong>{{ selectedCurrencyInfo?.confirmation_required }}</strong></li>
            <li>• Your deposit will be credited automatically after confirmations</li>
            <li v-if="selectedCurrency === 'USDT' || selectedCurrency === 'USDC'">
              • This is an <strong>ERC-20</strong> address (Ethereum network)
            </li>
          </ul>
        </div>
      </div>

      <!-- Network Info -->
      <div class="network-info">
        <div class="info-item">
          <span class="label">Network:</span>
          <span class="value">{{ depositNetwork }}</span>
        </div>
        <div class="info-item">
          <span class="label">Min. Deposit:</span>
          <span class="value">{{ selectedCurrencyInfo?.min_deposit }} {{ selectedCurrency }}</span>
        </div>
        <div class="info-item">
          <span class="label">Confirmations:</span>
          <span class="value">{{ selectedCurrencyInfo?.confirmation_required }}</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p class="text-gray-400 mt-3">Generating deposit address...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-box">
      <div class="error-icon">❌</div>
      <p class="text-white">{{ error }}</p>
      <button @click="generateAddress" class="retry-btn">
        Try Again
      </button>
    </div>

    <!-- Initial State -->
    <div v-else class="empty-state">
      <div class="empty-icon">💰</div>
      <h3 class="text-xl font-semibold text-white mb-2">Select a Currency</h3>
      <p class="text-gray-400">Choose a cryptocurrency above to generate your deposit address</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import QRCode from 'qrcode';

const authStore = useAuthStore();

const selectedCurrency = ref('');
const depositAddress = ref('');
const depositNetwork = ref('');
const loading = ref(false);
const error = ref('');
const copied = ref(false);
const qrCanvas = ref(null);
const supportedCurrencies = ref([]);

// Fetch supported currencies
const fetchSupportedCurrencies = async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/wallet/currencies`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      supportedCurrencies.value = data.currencies;
    }
  } catch (err) {
    console.error('Failed to fetch currencies:', err);
  }
};

// Get selected currency info
const selectedCurrencyInfo = computed(() => {
  return supportedCurrencies.value.find(c => c.symbol === selectedCurrency.value);
});

// Select currency and generate address
const selectCurrency = async (currency) => {
  selectedCurrency.value = currency;
  await generateAddress();
};

// Generate deposit address
const generateAddress = async () => {
  if (!selectedCurrency.value) return;

  loading.value = true;
  error.value = '';
  depositAddress.value = '';

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${apiUrl}/api/wallet/deposit/${selectedCurrency.value}/address`,
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    );

    const data = await response.json();

    if (data.success) {
      depositAddress.value = data.address;
      depositNetwork.value = data.network || 'mainnet';

      // Generate QR code
      await generateQRCode(data.qrCode || data.address);
    } else {
      error.value = data.error || 'Failed to generate deposit address';
    }
  } catch (err) {
    error.value = 'Network error. Please try again.';
    console.error('Deposit address error:', err);
  } finally {
    loading.value = false;
  }
};

// Generate QR Code
const generateQRCode = async (data) => {
  if (!qrCanvas.value) {
    // Wait for next tick and try again
    setTimeout(() => generateQRCode(data), 100);
    return;
  }

  try {
    await QRCode.toCanvas(qrCanvas.value, data, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('QR Code generation error:', err);
  }
};

// Copy address to clipboard
const copyAddress = async () => {
  try {
    await navigator.clipboard.writeText(depositAddress.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

// Watch for QR canvas ref
watch(qrCanvas, (canvas) => {
  if (canvas && depositAddress.value) {
    generateQRCode(depositAddress.value);
  }
});

// Fetch currencies on mount
fetchSupportedCurrencies();
</script>

<style scoped>
.deposit-page {
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

.deposit-address-card {
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
}

.badge {
  background: #2d3748;
  color: #4299e1;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.qr-code-container {
  text-align: center;
  margin-bottom: 2rem;
}

.qr-code-wrapper {
  background: white;
  padding: 1rem;
  border-radius: 12px;
  display: inline-block;
}

.qr-canvas {
  display: block;
}

.address-display {
  margin-bottom: 2rem;
}

.address-box {
  display: flex;
  gap: 0.5rem;
}

.address-input {
  flex: 1;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: white;
  font-family: monospace;
  font-size: 0.875rem;
}

.copy-btn {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #3182ce;
}

.copy-btn.copied {
  background: #48bb78;
}

.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.warning-icon {
  font-size: 1.5rem;
}

.network-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
}

.info-item .label {
  display: block;
  color: #a0aec0;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.info-item .value {
  display: block;
  color: white;
  font-weight: 600;
  font-size: 1.125rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #2d3748;
  border-top-color: #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-box {
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.retry-btn {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  margin-top: 1rem;
  cursor: pointer;
  font-weight: 600;
}

.retry-btn:hover {
  background: #3182ce;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .deposit-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .currency-selector {
    padding: 1rem;
  }

  .currency-btn {
    padding: 0.75rem;
  }

  .currency-icon {
    width: 32px;
    height: 32px;
    font-size: 0.625rem;
  }

  .deposit-address-card {
    padding: 1rem;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .card-header h3 {
    font-size: 1.125rem;
  }

  .qr-code-wrapper {
    padding: 0.75rem;
  }

  .qr-canvas {
    max-width: 200px;
    height: auto;
  }

  .address-box {
    flex-direction: column;
  }

  .address-input {
    font-size: 0.75rem;
    padding: 0.625rem;
    word-break: break-all;
  }

  .copy-btn {
    padding: 0.625rem 1rem;
    justify-content: center;
  }

  .warning-box {
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
  }

  .warning-box ul {
    font-size: 0.813rem;
  }

  .network-info {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .info-item {
    padding: 0.75rem;
  }

  .info-item .value {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .deposit-page {
    padding: 0.75rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }

  .currency-selector {
    padding: 0.75rem;
  }

  .currency-btn {
    padding: 0.5rem;
  }

  .currency-btn .text-left div {
    font-size: 0.75rem;
  }

  .currency-btn .text-xs {
    font-size: 0.625rem;
  }

  .deposit-address-card {
    padding: 0.875rem;
  }

  .qr-code-wrapper {
    padding: 0.5rem;
  }

  .qr-canvas {
    max-width: 180px;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
  }
}
</style>
