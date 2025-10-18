<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Verify your email
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          We've sent a verification link to your email address. Please check your inbox and click the link to activate your account.
        </p>
      </div>

      <!-- Verification Status -->
      <div class="mt-8 space-y-6">
        <div
          v-if="isVerifying"
          class="text-center"
        >
          <div class="spinner h-8 w-8 mx-auto mb-4" />
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Verifying your email...
          </p>
        </div>

        <div
          v-else-if="verificationStatus === 'success'"
          class="rounded-md bg-success-50 p-4"
        >
          <div class="text-center">
            <svg
              class="mx-auto h-12 w-12 text-success-600"
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
            <p class="mt-2 text-sm font-medium text-success-600">
              Email verified successfully!
            </p>
            <p class="mt-1 text-sm text-success-600">
              You can now access your account.
            </p>
          </div>
        </div>

        <div
          v-else-if="verificationStatus === 'error'"
          class="rounded-md bg-danger-50 p-4"
        >
          <div class="text-center">
            <svg
              class="mx-auto h-12 w-12 text-danger-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <p class="mt-2 text-sm font-medium text-danger-600">
              Verification failed
            </p>
            <p class="mt-1 text-sm text-danger-600">
              {{ errorMessage }}
            </p>
          </div>
        </div>

        <!-- Resend verification -->
        <div
          v-if="!isVerifying && verificationStatus !== 'success'"
          class="text-center space-y-4"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Didn't receive the email?
          </p>
          
          <button
            :disabled="isResending || canResend === false"
            :class="[
              'btn btn-outline',
              (isResending || canResend === false) ? 'opacity-50 cursor-not-allowed' : ''
            ]"
            @click="resendVerification"
          >
            <div
              v-if="isResending"
              class="flex items-center justify-center"
            >
              <div class="spinner h-4 w-4 mr-2" />
              Sending...
            </div>
            <span v-else-if="canResend === false">
              Resend in {{ resendCountdown }}s
            </span>
            <span v-else>Resend verification email</span>
          </button>

          <div
            v-if="resendMessage"
            class="rounded-md bg-info-50 p-4"
          >
            <p class="text-sm text-info-600">
              {{ resendMessage }}
            </p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="space-y-3">
          <router-link
            v-if="verificationStatus === 'success'"
            to="/dashboard"
            class="btn btn-primary w-full"
          >
            Continue to Dashboard
          </router-link>

          <router-link
            to="/login"
            class="btn btn-outline w-full"
          >
            Back to Sign In
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'VerifyEmail',
  setup() {
    const route = useRoute()
    // const router = useRouter() // Commented out since not used
    const authStore = useAuthStore()

    const isVerifying = ref(false)
    const verificationStatus = ref(null) // null, 'success', 'error'
    const errorMessage = ref('')
    const isResending = ref(false)
    const resendMessage = ref('')
    const canResend = ref(true)
    const resendCountdown = ref(0)
    let countdownInterval = null

    const verifyEmail = async (token) => {
      try {
        isVerifying.value = true
        await authStore.verifyEmail(token)
        verificationStatus.value = 'success'
      } catch (error) {
        verificationStatus.value = 'error'
        errorMessage.value = error.message
      } finally {
        isVerifying.value = false
      }
    }

    const resendVerification = async () => {
      try {
        isResending.value = true
        resendMessage.value = ''
        
        await authStore.resendVerification()
        
        resendMessage.value = 'Verification email sent! Please check your inbox.'
        
        // Start countdown
        canResend.value = false
        resendCountdown.value = 60
        countdownInterval = setInterval(() => {
          resendCountdown.value--
          if (resendCountdown.value <= 0) {
            canResend.value = true
            clearInterval(countdownInterval)
          }
        }, 1000)

      } catch (error) {
        resendMessage.value = error.message
      } finally {
        isResending.value = false
      }
    }

    onMounted(() => {
      const token = route.query.token
      if (token) {
        verifyEmail(token)
      }
    })

    onUnmounted(() => {
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }
    })

    return {
      isVerifying,
      verificationStatus,
      errorMessage,
      isResending,
      resendMessage,
      canResend,
      resendCountdown,
      resendVerification
    }
  }
}
</script>