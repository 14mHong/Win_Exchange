<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Verify Your Email
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          We've sent a 6-digit verification code to your email address
        </p>
      </div>

      <!-- Verification Form -->
      <form
        class="mt-8 space-y-6"
        @submit.prevent="handleSubmit"
      >
        <!-- General Error Message -->
        <div
          v-if="errors.general"
          class="bg-danger-50 border border-danger-200 rounded-md p-4"
        >
          <p class="text-sm text-danger-800">
            {{ errors.general }}
          </p>
        </div>

        <!-- Success Message -->
        <div
          v-if="successMessage"
          class="bg-success-50 border border-success-200 rounded-md p-4"
        >
          <p class="text-sm text-success-800">
            {{ successMessage }}
          </p>
        </div>

        <div class="space-y-4">
          <!-- Verification Code -->
          <div>
            <label
              for="verificationCode"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Verification Code
            </label>
            <input
              id="verificationCode"
              v-model="form.verificationCode"
              type="text"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              :class="[
                'input mt-1 text-center text-2xl tracking-widest',
                errors.verificationCode ? 'input-error' : ''
              ]"
              placeholder="000000"
              @input="formatCode"
            >
            <p
              v-if="errors.verificationCode"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.verificationCode }}
            </p>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading || form.verificationCode.length !== 6"
          :class="[
            'btn btn-primary w-full',
            (isLoading || form.verificationCode.length !== 6) ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <div
            v-if="isLoading"
            class="flex items-center justify-center"
          >
            <div class="spinner h-4 w-4 mr-2" />
            Verifying...
          </div>
          <span v-else>Verify Email</span>
        </button>

        <!-- Resend Code -->
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Didn't receive the code?
            <button
              type="button"
              :disabled="resendCooldown > 0"
              class="font-medium text-primary-600 hover:text-primary-500 disabled:opacity-50"
              @click="resendCode"
            >
              <span v-if="resendCooldown > 0">
                Resend in {{ resendCooldown }}s
              </span>
              <span v-else>
                Resend Code
              </span>
            </button>
          </p>
        </div>

        <!-- Back to Registration -->
        <div class="text-center">
          <router-link
            to="/register"
            class="text-sm font-medium text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Back to Registration
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification'
import { apiHelpers } from '@/services/api'

export default {
  name: 'VerifyRegistration',
  setup() {
    const router = useRouter()
    const notificationStore = useNotificationStore()

    const form = reactive({
      verificationCode: ''
    })

    const errors = reactive({})
    const isLoading = ref(false)
    const successMessage = ref('')
    const resendCooldown = ref(0)
    let cooldownInterval = null

    const formatCode = (event) => {
      // Only allow numbers
      form.verificationCode = event.target.value.replace(/\D/g, '').slice(0, 6)
    }

    const clearErrors = () => {
      Object.keys(errors).forEach(key => {
        delete errors[key]
      })
      successMessage.value = ''
    }

    const validateForm = () => {
      const newErrors = {}

      if (!form.verificationCode) {
        newErrors.verificationCode = 'Verification code is required'
      } else if (form.verificationCode.length !== 6) {
        newErrors.verificationCode = 'Verification code must be 6 digits'
      } else if (!/^\d{6}$/.test(form.verificationCode)) {
        newErrors.verificationCode = 'Verification code must contain only numbers'
      }

      Object.assign(errors, newErrors)
      return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
      clearErrors()
      
      if (!validateForm()) {
        return
      }

      try {
        isLoading.value = true

        const response = await apiHelpers.post('/api/auth/verify-registration', {
          verificationCode: form.verificationCode
        })

        if (response.success) {
          successMessage.value = response.message
          
          notificationStore.success(
            'Registration Complete',
            'Your account has been created successfully! You can now log in.'
          )

          // Redirect to login page after a short delay
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        } else {
          errors.general = response.error || 'Verification failed'
        }

      } catch (error) {
        errors.general = error.message || 'Verification failed'
      } finally {
        isLoading.value = false
      }
    }

    const resendCode = async () => {
      if (resendCooldown.value > 0) return

      try {
        // For now, tell user to go back and register again
        // In a production app, you might want a dedicated resend endpoint
        notificationStore.info(
          'Resend Code',
          'Please go back to the registration page and submit your details again to receive a new code.'
        )
        
        // Start cooldown
        resendCooldown.value = 60
        cooldownInterval = setInterval(() => {
          resendCooldown.value--
          if (resendCooldown.value <= 0) {
            clearInterval(cooldownInterval)
          }
        }, 1000)

      } catch (error) {
        errors.general = error.message || 'Failed to resend code'
      }
    }

    onMounted(() => {
      // Auto-focus the input
      document.getElementById('verificationCode')?.focus()
    })

    onUnmounted(() => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval)
      }
    })

    return {
      form,
      errors,
      isLoading,
      successMessage,
      resendCooldown,
      formatCode,
      handleSubmit,
      resendCode
    }
  }
}
</script>