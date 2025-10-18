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
          Enter the verification code sent to your email and your new password
        </p>
      </div>

      <!-- Confirm Reset Form -->
      <form
        class="mt-8 space-y-6"
        @submit.prevent="handleSubmit"
      >
        <!-- Email Field -->
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

        <!-- Verification Code Field -->
        <div>
          <label
            for="code"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Verification code
          </label>
          <input
            id="code"
            v-model="form.code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            pattern="\d{6}"
            required
            :class="[
              'input mt-1',
              errors.code ? 'input-error' : ''
            ]"
            placeholder="Enter 6-digit code"
          >
          <p
            v-if="errors.code"
            class="mt-1 text-sm text-danger-600"
          >
            {{ errors.code }}
          </p>
        </div>

        <!-- New Password Field -->
        <div>
          <label
            for="newPassword"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            New password
          </label>
          <input
            id="newPassword"
            v-model="form.newPassword"
            type="password"
            required
            :class="[
              'input mt-1',
              errors.newPassword ? 'input-error' : ''
            ]"
            placeholder="Enter new password"
          >
          <p
            v-if="errors.newPassword"
            class="mt-1 text-sm text-danger-600"
          >
            {{ errors.newPassword }}
          </p>
          <p class="mt-1 text-xs text-gray-500">
            Must be at least 8 characters with uppercase, lowercase, number, and special character
          </p>
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label
            for="confirmPassword"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            required
            :class="[
              'input mt-1',
              errors.confirmPassword ? 'input-error' : ''
            ]"
            placeholder="Confirm new password"
          >
          <p
            v-if="errors.confirmPassword"
            class="mt-1 text-sm text-danger-600"
          >
            {{ errors.confirmPassword }}
          </p>
        </div>

        <div
          v-if="errors.general"
          class="rounded-md bg-danger-50 p-4"
        >
          <p class="text-sm text-danger-600">
            {{ errors.general }}
          </p>
        </div>

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
            Resetting password...
          </div>
          <span v-else>Reset password</span>
        </button>

        <div class="text-center space-y-2">
          <router-link
            to="/reset-password"
            class="text-sm font-medium text-primary-600 hover:text-primary-500 block"
          >
            Didn't receive code? Request new one
          </router-link>
          <router-link
            to="/login"
            class="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-500 block"
          >
            Back to sign in
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import authService from '@/services/authService'

export default {
  name: 'ConfirmPasswordReset',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()

    const form = reactive({
      email: route.query.email || '',
      code: '',
      newPassword: '',
      confirmPassword: ''
    })

    const errors = reactive({})
    const isLoading = ref(false)

    const validateForm = () => {
      const newErrors = {}

      if (!form.email) {
        newErrors.email = 'Email is required'
      } else if (!authService.validateEmail(form.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (!form.code) {
        newErrors.code = 'Verification code is required'
      } else if (!/^\d{6}$/.test(form.code)) {
        newErrors.code = 'Code must be 6 digits'
      }

      if (!form.newPassword) {
        newErrors.newPassword = 'New password is required'
      } else {
        const passwordStrength = authService.checkPasswordStrength(form.newPassword)
        if (!passwordStrength.isStrong) {
          newErrors.newPassword = passwordStrength.feedback.join(', ')
        }
      }

      if (!form.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (form.newPassword !== form.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
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

        await authStore.confirmPasswordReset({
          email: form.email,
          code: form.code,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword
        })

        // Redirect to login after successful reset
        router.push('/login')

      } catch (error) {
        errors.general = error.message || 'Failed to reset password. Please check your code and try again.'
      } finally {
        isLoading.value = false
      }
    }

    return {
      form,
      errors,
      isLoading,
      handleSubmit
    }
  }
}
</script>
