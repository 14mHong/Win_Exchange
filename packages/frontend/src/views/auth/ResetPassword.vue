<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Reset your password
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter your email address and we'll send you a verification code to reset your password.
        </p>
      </div>

      <!-- Form -->
      <form class="mt-8 space-y-6" @submit="onSubmit">
        <!-- Email Input -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email address
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="input mt-1"
            placeholder="Enter your email"
            autocomplete="email"
          />
          <p v-if="emailError" class="mt-1 text-sm text-danger-600">
            {{ emailError }}
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="rounded-md bg-danger-50 dark:bg-danger-900/20 p-4">
          <p class="text-sm text-danger-600 dark:text-danger-400">
            {{ errorMessage }}
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="rounded-md bg-success-50 dark:bg-success-900/20 p-4">
          <p class="text-sm text-success-600 dark:text-success-400">
            {{ successMessage }}
          </p>
        </div>

        <!-- Submit Button -->
        <div>
          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="loading"
          >
            <span v-if="loading" class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
            <span v-else>Send reset code</span>
          </button>
        </div>

        <!-- Back to Login -->
        <div class="text-center">
          <router-link
            to="/login"
            class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Back to sign in
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const emailError = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

const validateEmail = (emailValue) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(emailValue)
}

const onSubmit = async (event) => {
  event.preventDefault()

  // Clear previous messages
  emailError.value = ''
  errorMessage.value = ''
  successMessage.value = ''

  // Validate email
  if (!email.value) {
    emailError.value = 'Email is required'
    return
  }

  if (!validateEmail(email.value)) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  try {
    loading.value = true

    // Call reset password API
    await authStore.resetPassword(email.value)

    // Show success message
    successMessage.value = 'If an account with that email exists, we\'ve sent you a reset code. Check your email!'

    // Redirect to confirmation page after 2 seconds
    setTimeout(() => {
      router.push({
        path: '/reset-password/confirm',
        query: { email: email.value }
      })
    }, 2000)

  } catch (error) {
    console.error('Password reset error:', error)
    errorMessage.value = error.message || 'Failed to send reset code. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Component-specific styles */
.input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
         placeholder-gray-400 dark:placeholder-gray-500
         focus:outline-none focus:ring-primary-500 focus:border-primary-500
         dark:bg-dark-800 dark:text-gray-100;
}

.btn {
  @apply inline-flex justify-center items-center px-4 py-2 border border-transparent
         text-sm font-medium rounded-md shadow-sm
         focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.btn-primary {
  @apply text-white bg-primary-600 hover:bg-primary-700
         focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
