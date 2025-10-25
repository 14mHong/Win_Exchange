<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Get Your Invite Code
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Purchase an invite code to join WIN Exchange
        </p>
      </div>

      <!-- Payment Info Card -->
      <div
        v-if="!purchasedCode"
        class="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-6"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Payment Details
        </h2>

        <div
          v-if="isLoadingConfig"
          class="flex justify-center py-8"
        >
          <div class="spinner h-8 w-8" />
        </div>

        <div
          v-else-if="paymentConfig"
          class="space-y-4"
        >
          <!-- Price -->
          <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <span class="text-gray-700 dark:text-gray-300">Price:</span>
              <div class="text-right">
                <div class="text-2xl font-bold text-primary-600">
                  {{ paymentConfig.priceETH }} ETH
                </div>
                <div class="text-sm text-gray-500">
                  ≈ ${{ paymentConfig.priceUSD }} USD
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Address -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Send Payment To:
            </label>
            <div class="flex items-center space-x-2">
              <input
                :value="paymentConfig.address"
                readonly
                class="input flex-1 font-mono text-sm"
              >
              <button
                @click="copyAddress"
                class="btn btn-outline px-4"
                :class="{ 'btn-success': addressCopied }"
              >
                {{ addressCopied ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>

          <!-- Network Info -->
          <div class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Network: <strong>{{ paymentConfig.network || 'Ethereum Mainnet' }}</strong>
              • Min Confirmations: <strong>{{ paymentConfig.minConfirmations }}</strong>
            </span>
          </div>

          <!-- Instructions -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Payment Instructions:
            </h3>
            <ol class="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Send exactly <strong>{{ paymentConfig.priceETH }} ETH</strong> to the address above</li>
              <li>Wait for at least {{ paymentConfig.minConfirmations }} confirmations</li>
              <li>Copy your transaction hash from your wallet</li>
              <li>Paste it below and submit to receive your invite code</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Submit Transaction Form -->
      <div
        v-if="!purchasedCode"
        class="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Submit Your Payment
        </h2>

        <form
          @submit.prevent="handleSubmit"
          class="space-y-4"
        >
          <!-- Email -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Your Email
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              class="input"
              :class="{ 'input-error': errors.email }"
              placeholder="your@email.com"
            >
            <p
              v-if="errors.email"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.email }}
            </p>
          </div>

          <!-- Transaction Hash -->
          <div>
            <label
              for="txHash"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Transaction Hash
            </label>
            <input
              id="txHash"
              v-model="form.txHash"
              type="text"
              required
              class="input font-mono text-sm"
              :class="{ 'input-error': errors.txHash }"
              placeholder="0x..."
            >
            <p
              v-if="errors.txHash"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.txHash }}
            </p>
            <p class="mt-1 text-xs text-gray-500">
              Find this in your wallet after sending the payment
            </p>
          </div>

          <!-- General Error -->
          <div
            v-if="errors.general"
            class="bg-danger-50 border border-danger-200 rounded-md p-4"
          >
            <p class="text-sm text-danger-800">
              {{ errors.general }}
            </p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="btn btn-primary w-full"
            :class="{ 'opacity-50 cursor-not-allowed': isSubmitting }"
          >
            <div
              v-if="isSubmitting"
              class="flex items-center justify-center"
            >
              <div class="spinner h-4 w-4 mr-2" />
              Verifying Payment...
            </div>
            <span v-else>Get My Invite Code</span>
          </button>
        </form>
      </div>

      <!-- Success Card -->
      <div
        v-if="purchasedCode"
        class="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6"
      >
        <div class="text-center">
          <div class="mx-auto w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
            <svg
              class="w-8 h-8 text-success-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Payment Verified!
          </h2>

          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Your invite code has been generated
          </p>

          <!-- Invite Code Display -->
          <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-6 mb-6">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Your Invite Code:
            </p>
            <div class="flex items-center justify-center space-x-2">
              <div class="text-3xl font-bold text-primary-600 font-mono tracking-wider">
                {{ purchasedCode }}
              </div>
              <button
                @click="copyCode"
                class="btn btn-outline"
                :class="{ 'btn-success': codeCopied }"
              >
                {{ codeCopied ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-3">
            <router-link
              to="/register"
              class="btn btn-primary w-full"
            >
              Register Now
            </router-link>
            <router-link
              to="/"
              class="btn btn-outline w-full"
            >
              Back to Home
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import inviteCodeService from '@/services/inviteCodeService'

export default {
  name: 'GetInviteCode',
  setup() {
    const router = useRouter()

    const paymentConfig = ref(null)
    const isLoadingConfig = ref(true)
    const isSubmitting = ref(false)
    const purchasedCode = ref(null)
    const addressCopied = ref(false)
    const codeCopied = ref(false)

    const form = reactive({
      email: '',
      txHash: ''
    })

    const errors = reactive({})

    // Load payment configuration
    const loadPaymentConfig = async () => {
      try {
        isLoadingConfig.value = true
        const response = await inviteCodeService.getPaymentConfig()

        if (response.success) {
          paymentConfig.value = response.config
        } else {
          errors.general = 'Failed to load payment configuration'
        }
      } catch (error) {
        console.error('Error loading payment config:', error)
        errors.general = 'Failed to load payment configuration'
      } finally {
        isLoadingConfig.value = false
      }
    }

    // Copy payment address
    const copyAddress = async () => {
      try {
        await navigator.clipboard.writeText(paymentConfig.value.address)
        addressCopied.value = true
        setTimeout(() => {
          addressCopied.value = false
        }, 2000)
      } catch (error) {
        console.error('Failed to copy address:', error)
      }
    }

    // Copy invite code
    const copyCode = async () => {
      try {
        await navigator.clipboard.writeText(purchasedCode.value)
        codeCopied.value = true
        setTimeout(() => {
          codeCopied.value = false
        }, 2000)
      } catch (error) {
        console.error('Failed to copy code:', error)
      }
    }

    // Validate form
    const validateForm = () => {
      const newErrors = {}

      if (!form.email) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (!form.txHash) {
        newErrors.txHash = 'Transaction hash is required'
      } else if (!/^0x[a-fA-F0-9]{64}$/.test(form.txHash)) {
        newErrors.txHash = 'Invalid transaction hash format'
      }

      Object.assign(errors, newErrors)
      return Object.keys(newErrors).length === 0
    }

    // Clear errors
    const clearErrors = () => {
      Object.keys(errors).forEach(key => {
        delete errors[key]
      })
    }

    // Submit transaction
    const handleSubmit = async () => {
      clearErrors()

      if (!validateForm()) {
        return
      }

      try {
        isSubmitting.value = true

        const response = await inviteCodeService.purchaseInviteCode(
          form.txHash,
          form.email
        )

        if (response.success) {
          purchasedCode.value = response.inviteCode
        } else {
          errors.general = response.error || 'Failed to verify payment'
        }
      } catch (error) {
        console.error('Error purchasing invite code:', error)
        errors.general = error.message || 'Failed to process your request'
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(() => {
      loadPaymentConfig()
    })

    return {
      paymentConfig,
      isLoadingConfig,
      isSubmitting,
      purchasedCode,
      addressCopied,
      codeCopied,
      form,
      errors,
      copyAddress,
      copyCode,
      handleSubmit
    }
  }
}
</script>
