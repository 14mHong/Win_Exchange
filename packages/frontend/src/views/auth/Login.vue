<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Sign in to your account
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Or
          <router-link
            to="/register"
            class="font-medium text-primary-600 hover:text-primary-500"
          >
            create a new account
          </router-link>
        </p>
      </div>

      <!-- Login Form -->
      <form class="mt-8 space-y-6" @submit="onSubmit">
        <div class="space-y-4">
          <!-- Email -->
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

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div class="relative mt-1">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                class="input pr-10"
                placeholder="Enter your password"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
            <p v-if="passwordError" class="mt-1 text-sm text-danger-600">
              {{ passwordError }}
            </p>
          </div>

          <!-- 2FA Token (shown when required) -->
          <div v-if="requires2FA">
            <label for="twoFAToken" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Two-Factor Authentication Code
            </label>
            <input
              id="twoFAToken"
              v-model="twoFAToken"
              type="text"
              maxlength="6"
              inputmode="numeric"
              class="input mt-1"
              placeholder="Enter 6-digit code"
            />
            <p v-if="tokenError" class="mt-1 text-sm text-danger-600">
              {{ tokenError }}
            </p>
          </div>
        </div>

        <!-- Remember me & Forgot password -->
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <input
              id="remember"
              v-model="rememberMe"
              type="checkbox"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label for="remember" class="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              Remember me
            </label>
          </div>

          <router-link
            to="/reset-password"
            class="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            Forgot your password?
          </router-link>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="rounded-md bg-danger-50 dark:bg-danger-900/20 p-4">
          <p class="text-sm text-danger-600 dark:text-danger-400">
            {{ errorMessage }}
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
              Signing in...
            </span>
            <span v-else>Sign in</span>
          </button>
        </div>

        <!-- OAuth Login -->
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-gray-50 dark:bg-dark-900 text-gray-500">Or continue with</span>
            </div>
          </div>

          <div class="mt-6">
            <button
              type="button"
              class="btn btn-outline w-full"
              @click="handleOAuthLogin('google')"
            >
              <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import authService from '@/services/authService'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const twoFAToken = ref('')
const rememberMe = ref(false)

const emailError = ref('')
const passwordError = ref('')
const tokenError = ref('')
const errorMessage = ref('')

const loading = ref(false)
const showPassword = ref(false)
const requires2FA = ref(false)

const validateEmail = (emailValue) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(emailValue)
}

const onSubmit = async (event) => {
  event.preventDefault()

  // Clear previous errors
  emailError.value = ''
  passwordError.value = ''
  tokenError.value = ''
  errorMessage.value = ''

  // Validate email
  if (!email.value) {
    emailError.value = 'Email is required'
    return
  }

  if (!validateEmail(email.value)) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  // Validate password
  if (!password.value) {
    passwordError.value = 'Password is required'
    return
  }

  // Validate 2FA token if required
  if (requires2FA.value && !twoFAToken.value) {
    tokenError.value = 'Two-factor authentication code is required'
    return
  }

  if (requires2FA.value && twoFAToken.value.length !== 6) {
    tokenError.value = 'Please enter a 6-digit code'
    return
  }

  try {
    loading.value = true

    const credentials = {
      email: email.value,
      password: password.value
    }

    if (requires2FA.value) {
      credentials.twoFAToken = twoFAToken.value
    }

    const result = await authStore.login(credentials)

    if (result?.requiresTwoFA) {
      requires2FA.value = true
      return
    }

    // Login successful, redirect to dashboard
    router.push('/dashboard')

  } catch (error) {
    console.error('Login error:', error)

    if (error.message?.includes('Two-factor authentication required')) {
      requires2FA.value = true
    } else {
      errorMessage.value = error.message || 'Failed to sign in. Please check your credentials and try again.'
    }
  } finally {
    loading.value = false
  }
}

const handleOAuthLogin = async (provider) => {
  try {
    loading.value = true
    const response = await authService.getOAuthURL(provider)

    if (response.success && response.authUrl) {
      // Store the state for later verification
      localStorage.setItem(`oauth_state_${provider}`, response.state)
      window.location.href = response.authUrl
    } else {
      errorMessage.value = response.error || 'Failed to get OAuth URL'
      loading.value = false
    }
  } catch (error) {
    errorMessage.value = error.message || 'Failed to initiate OAuth'
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

.btn-outline {
  @apply text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-800
         border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700
         focus:ring-primary-500;
}
</style>
