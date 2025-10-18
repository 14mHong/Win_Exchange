<template>
  <header class="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center">
          <router-link 
            to="/" 
            class="flex items-center space-x-2"
          >
            <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span class="text-white font-bold text-sm">WIN</span>
            </div>
            <span class="font-bold text-xl text-gray-900 dark:text-white">
              Exchange
            </span>
          </router-link>
        </div>

        <!-- Navigation -->
        <nav class="hidden md:flex items-center space-x-8">
          <a 
            href="#markets" 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            Markets
          </a>
          <a 
            href="#features" 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            Features
          </a>
          <button 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="openTradingWithAuth"
          >
            Trading
          </button>
          <button 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="openWalletWithAuth"
          >
            Wallet
          </button>
        </nav>

        <!-- Auth Buttons -->
        <div class="flex items-center space-x-4">
          <!-- Theme Toggle -->
          <button
            class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <svg
              v-if="themeStore.isDark"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>

          <router-link
            to="/login"
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            Sign In
          </router-link>
          <router-link
            to="/register"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Get Started
          </router-link>

          <!-- Mobile menu button -->
          <button
            class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden py-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div class="flex flex-col space-y-4">
          <a 
            href="#markets" 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="mobileMenuOpen = false"
          >
            Markets
          </a>
          <a 
            href="#features" 
            class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="mobileMenuOpen = false"
          >
            Features
          </a>
          <button 
            class="text-left text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="openTradingWithAuth"
          >
            Trading
          </button>
          <button 
            class="text-left text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            @click="openWalletWithAuth"
          >
            Wallet
          </button>
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <router-link
              to="/login"
              class="block text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors mb-2"
              @click="mobileMenuOpen = false"
            >
              Sign In
            </router-link>
            <router-link
              to="/register"
              class="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-center"
              @click="mobileMenuOpen = false"
            >
              Get Started
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'

export default {
  name: 'PublicHeader',
  setup() {
    const router = useRouter()
    const themeStore = useThemeStore()
    const notificationStore = useNotificationStore()
    const mobileMenuOpen = ref(false)

    const toggleTheme = () => {
      themeStore.toggleDark()
    }

    const openTradingWithAuth = () => {
      notificationStore.info(
        'Authentication Required',
        'Please sign in to access trading features'
      )
      router.push('/login?redirect=/trading')
    }

    const openWalletWithAuth = () => {
      notificationStore.info(
        'Authentication Required', 
        'Please sign in to access your wallet'
      )
      router.push('/login?redirect=/wallet')
    }

    return {
      themeStore,
      mobileMenuOpen,
      toggleTheme,
      openTradingWithAuth,
      openWalletWithAuth
    }
  }
}
</script>