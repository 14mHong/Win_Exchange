<template>
  <div
    id="app"
    class="min-h-screen bg-gray-50 dark:bg-dark-900"
  >
    <!-- Navigation -->
    <PublicHeader v-if="isPublicPage" />
    <AppHeader v-else-if="!isAuthPage" />
    
    <!-- Main Content -->
    <main :class="{ 'pt-16': !isAuthPage || isPublicPage }">
      <router-view />
    </main>
    
    <!-- Global Notifications -->
    <NotificationContainer />
    
    <!-- Loading Overlay -->
    <LoadingOverlay v-if="isGlobalLoading" />
    
    <!-- Modals -->
    <ModalContainer />
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useWebSocketStore } from '@/stores/websocket'
import AppHeader from '@/components/layout/AppHeader.vue'
import PublicHeader from '@/components/layout/PublicHeader.vue'
import NotificationContainer from '@/components/common/NotificationContainer.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import ModalContainer from '@/components/common/ModalContainer.vue'

export default {
  name: 'App',
  components: {
    AppHeader,
    PublicHeader,
    NotificationContainer,
    LoadingOverlay,
    ModalContainer
  },
  setup() {
    const route = useRoute()
    const authStore = useAuthStore()
    const themeStore = useThemeStore()
    const wsStore = useWebSocketStore()

    // Computed properties
    const isPublicPage = computed(() => {
      return route.path === '/'
    })

    const isAuthPage = computed(() => {
      return ['/login', '/register', '/reset-password', '/reset-password/confirm', '/verify-registration'].includes(route.path) ||
             route.path.startsWith('/auth/callback/')
    })

    const isGlobalLoading = computed(() => {
      return authStore?.isLoading || false
    })

    // Initialize app
    const initializeApp = async () => {
      // Initialize theme
      themeStore?.initializeTheme()

      // Check for existing session
      if (authStore?.token) {
        try {
          await authStore.getProfile()
          // Connect WebSocket if authenticated
          wsStore?.connect()
        } catch (error) {
          console.error('Failed to restore session:', error)
          authStore?.logout()
        }
      }
    }

    // Handle before unload
    const handleBeforeUnload = () => {
      // Disconnect WebSocket
      wsStore?.disconnect()
    }

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden
        wsStore?.disconnect()
      } else {
        // Page is visible again
        if (authStore?.isAuthenticated) {
          wsStore?.connect()
        }
      }
    }

    // Lifecycle hooks
    onMounted(() => {
      initializeApp()
      
      // Add event listeners
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onUnmounted(() => {
      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Disconnect WebSocket
      wsStore.disconnect()
    })

    return {
      isPublicPage,
      isAuthPage,
      isGlobalLoading
    }
  }
}
</script>

<style>
/* Global app styles */
#app {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus styles for accessibility */
*:focus {
  outline: 2px solid theme('colors.primary.500');
  outline-offset: 2px;
}

/* Skip to main content link for accessibility */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: theme('colors.primary.600');
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 6px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>