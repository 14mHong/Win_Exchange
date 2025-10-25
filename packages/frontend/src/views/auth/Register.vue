<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
          <span class="text-white font-bold text-2xl">WIN</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Create your account
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?
          <router-link
            to="/login"
            class="font-medium text-primary-600 hover:text-primary-500"
          >
            Sign in
          </router-link>
        </p>
      </div>

      <!-- Registration Form -->
      <form
        class="mt-8 space-y-6"
        @submit.prevent="handleSubmit"
      >
        <div class="space-y-4">
          <!-- Email -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email address
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              :class="[
                'input mt-1',
                errors.email ? 'input-error' : ''
              ]"
              placeholder="Enter your email"
            >
            <p
              v-if="errors.email"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.email }}
            </p>
          </div>

          <!-- First Name -->
          <div>
            <label
              for="first_name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              First Name
            </label>
            <input
              id="first_name"
              v-model="form.first_name"
              type="text"
              required
              :class="[
                'input mt-1',
                errors.first_name ? 'input-error' : ''
              ]"
              placeholder="Enter your first name"
            >
            <p
              v-if="errors.first_name"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.first_name }}
            </p>
          </div>

          <!-- Last Name -->
          <div>
            <label
              for="last_name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Last Name
            </label>
            <input
              id="last_name"
              v-model="form.last_name"
              type="text"
              required
              :class="[
                'input mt-1',
                errors.last_name ? 'input-error' : ''
              ]"
              placeholder="Enter your last name"
            >
            <p
              v-if="errors.last_name"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.last_name }}
            </p>
          </div>

          <!-- Password -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <div class="relative mt-1">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                :class="[
                  'input pr-10',
                  errors.password ? 'input-error' : ''
                ]"
                placeholder="Create a password"
              >
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                @click="showPassword = !showPassword"
              >
                <EyeIcon
                  v-if="!showPassword"
                  class="h-5 w-5 text-gray-400"
                />
                <EyeSlashIcon
                  v-else
                  class="h-5 w-5 text-gray-400"
                />
              </button>
            </div>
            <p
              v-if="errors.password"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.password }}
            </p>
          </div>

          <!-- Confirm Password -->
          <div>
            <label
              for="confirmPassword"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm Password
            </label>
            <div class="relative mt-1">
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                :class="[
                  'input pr-10',
                  errors.confirmPassword ? 'input-error' : ''
                ]"
                placeholder="Confirm your password"
              >
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <EyeIcon
                  v-if="!showConfirmPassword"
                  class="h-5 w-5 text-gray-400"
                />
                <EyeSlashIcon
                  v-else
                  class="h-5 w-5 text-gray-400"
                />
              </button>
            </div>
            <p
              v-if="errors.confirmPassword"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.confirmPassword }}
            </p>
          </div>

          <!-- Invite Code -->
          <div>
            <label
              for="invite_code"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Invite Code
            </label>
            <input
              id="invite_code"
              v-model="form.invite_code"
              type="text"
              required
              :class="[
                'input mt-1 uppercase',
                errors.invite_code ? 'input-error' : ''
              ]"
              placeholder="Enter your invite code (e.g., WIN-XXXX-YYYY)"
              maxlength="20"
            >
            <p
              v-if="errors.invite_code"
              class="mt-1 text-sm text-danger-600"
            >
              {{ errors.invite_code }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Registration is by invitation only. Enter the code you received.
            </p>
          </div>
        </div>

        <!-- Terms and Conditions -->
        <div class="flex items-center">
          <input
            id="terms"
            v-model="form.acceptTerms"
            type="checkbox"
            class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          >
          <label
            for="terms"
            class="ml-2 block text-sm text-gray-900 dark:text-gray-100"
          >
            I agree to the
            <a
              href="#"
              class="text-primary-600 hover:text-primary-500"
            >Terms of Service</a>
            and
            <a
              href="#"
              class="text-primary-600 hover:text-primary-500"
            >Privacy Policy</a>
          </label>
        </div>
        <p
          v-if="errors.acceptTerms"
          class="text-sm text-danger-600"
        >
          {{ errors.acceptTerms }}
        </p>

        <!-- General Error Message -->
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
          :disabled="isLoading"
          :class="[
            'btn btn-primary w-full',
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <div
            v-if="isLoading"
            class="flex items-center justify-center"
          >
            <div class="spinner h-4 w-4 mr-2" />
            Creating account...
          </div>
          <span v-else>Create account</span>
        </button>

        <!-- OAuth Registration -->
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
              @click="handleOAuthRegister('google')"
            >
              <svg
                class="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import authService from '@/services/authService'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'Register',
  components: {
    EyeIcon,
    EyeSlashIcon
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()

    const form = reactive({
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      confirmPassword: '',
      invite_code: '',
      acceptTerms: false
    })

    const errors = reactive({})
    const isLoading = ref(false)
    const showPassword = ref(false)
    const showConfirmPassword = ref(false)


    const validateForm = () => {
      const newErrors = {}

      if (!form.email) {
        newErrors.email = 'Email is required'
      } else if (!authService.validateEmail(form.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (!form.first_name) {
        newErrors.first_name = 'First name is required'
      } else if (form.first_name.length < 2) {
        newErrors.first_name = 'First name must be at least 2 characters'
      }

      if (!form.last_name) {
        newErrors.last_name = 'Last name is required'
      } else if (form.last_name.length < 2) {
        newErrors.last_name = 'Last name must be at least 2 characters'
      }

      if (!form.password) {
        newErrors.password = 'Password is required'
      } else if (form.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters'
      } else if (!authService.validatePassword(form.password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, number and special character'
      }

      if (!form.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }

      if (!form.invite_code) {
        newErrors.invite_code = 'Invite code is required'
      } else if (form.invite_code.length < 8) {
        newErrors.invite_code = 'Please enter a valid invite code'
      }

      if (!form.acceptTerms) {
        newErrors.acceptTerms = 'You must accept the terms and conditions'
      }

      Object.assign(errors, newErrors)
      return Object.keys(newErrors).length === 0
    }

    const clearErrors = () => {
      Object.keys(errors).forEach(key => {
        delete errors[key]
      })
    }

    const handleSubmit = async () => {
      clearErrors()
      
      if (!validateForm()) {
        return
      }

      try {
        isLoading.value = true

        const result = await authStore.register({
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          password: form.password,
          confirmPassword: form.confirmPassword
        })

        // Check if registration requires verification
        if (result && result.requiresVerification) {
          // Redirect to verification page for OTP
          router.push('/verify-registration')
        } else {
          // Old flow - redirect to email verification
          router.push('/verify-email')
        }

      } catch (error) {
        errors.general = error.message
      } finally {
        isLoading.value = false
      }
    }

    const handleOAuthRegister = async (provider) => {
      try {
        isLoading.value = true
        const response = await authService.getOAuthURL(provider)
        
        if (response.success && response.authUrl) {
          // Store the state for later verification
          localStorage.setItem(`oauth_state_${provider}`, response.state)
          window.location.href = response.authUrl
        } else {
          errors.general = response.error || 'Failed to get OAuth URL'
        }
      } catch (error) {
        errors.general = error.message || 'Failed to initiate OAuth'
      } finally {
        isLoading.value = false
      }
    }

    return {
      form,
      errors,
      isLoading,
      showPassword,
      showConfirmPassword,
      handleSubmit,
      handleOAuthRegister
    }
  }
}
</script>