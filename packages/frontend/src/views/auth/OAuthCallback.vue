<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
    <div class="max-w-md w-full text-center">
      <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
        <span class="text-white font-bold text-2xl">WIN</span>
      </div>
      
      <div v-if="isLoading" class="space-y-4">
        <div class="spinner h-8 w-8 mx-auto" />
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Completing authentication...
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Please wait while we process your {{ provider }} login.
        </p>
      </div>

      <div v-else-if="error" class="space-y-4">
        <div class="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Authentication Failed
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          {{ error }}
        </p>
        <router-link
          to="/login"
          class="btn btn-primary inline-block"
        >
          Try Again
        </router-link>
      </div>

      <div v-else class="space-y-4">
        <div class="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Authentication Successful
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          You have successfully logged in with {{ provider }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import authService from '@/services/authService'

export default {
  name: 'OAuthCallback',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    
    const isLoading = ref(true)
    const error = ref('')
    const provider = ref('')

    const handleCallback = async () => {
      try {
        provider.value = route.params.provider
        const code = route.query.code
        const state = route.query.state
        const error_param = route.query.error

        if (error_param) {
          throw new Error(`OAuth error: ${error_param}`)
        }

        if (!code) {
          throw new Error('Authorization code not received')
        }

        if (!state) {
          throw new Error('State parameter not received')
        }

        // Note: State verification is now handled by backend (nonce in Redis)
        // The invite_code is encoded in the state parameter and will be validated by backend

        // Exchange code for token
        // No need to pass invite_code separately - it's encoded in state parameter
        const response = await authService.handleOAuthCallback(provider.value, code, state)

        if (response.success) {
          // Store auth data
          authStore.setToken(response.token)
          authStore.setUser(response.user)

          // Redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard')
          }, 1500)
        } else {
          throw new Error(response.error || 'Authentication failed')
        }

      } catch (err) {
        console.error('OAuth callback error:', err)
        error.value = err.message
      } finally {
        isLoading.value = false
      }
    }

    onMounted(() => {
      handleCallback()
    })

    return {
      isLoading,
      error,
      provider
    }
  }
}
</script>