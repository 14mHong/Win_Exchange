<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
    <div class="max-w-md w-full text-center">
      <div class="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
        <span class="text-white font-bold text-2xl">WIN</span>
      </div>

      <div class="space-y-4">
        <div class="spinner h-8 w-8 mx-auto" />
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Completing authentication...
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Please wait while we log you in.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'OAuthSuccess',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()

    onMounted(async () => {
      try {
        const token = route.query.token
        const provider = route.query.provider

        if (!token) {
          throw new Error('No authentication token received')
        }

        // Store the token
        authStore.setToken(token)

        // Fetch user profile
        await authStore.getProfile()

        // Redirect to dashboard
        router.push('/dashboard')
      } catch (error) {
        console.error('OAuth success error:', error)
        router.push('/login')
      }
    })

    return {}
  }
}
</script>
