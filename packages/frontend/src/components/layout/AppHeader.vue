<template>
  <header class="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center">
          <router-link 
            :to="authStore.isAuthenticated ? '/dashboard' : '/'" 
            class="flex items-center space-x-2"
          >
            <div class="w-8 h-8 bg-primary-600 rounded flex items-center justify-center">
              <span class="text-white font-bold text-sm">WIN</span>
            </div>
            <span class="font-bold text-xl text-gray-900 dark:text-gray-100">
              Exchange
            </span>
          </router-link>
        </div>

        <!-- Navigation -->
        <nav class="hidden md:flex items-center space-x-8">
          <router-link
            to="/dashboard"
            class="nav-link"
            active-class="nav-link-active"
          >
            Dashboard
          </router-link>
          <router-link
            to="/trading"
            class="nav-link"
            active-class="nav-link-active"
          >
            Trading
          </router-link>
          <router-link
            to="/wallet"
            class="nav-link"
            active-class="nav-link-active"
          >
            Wallet
          </router-link>
          <router-link
            to="/orders"
            class="nav-link"
            active-class="nav-link-active"
          >
            Orders
          </router-link>
        </nav>

        <!-- Right side -->
        <div class="flex items-center space-x-4">
          <!-- Theme toggle -->
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            @click="toggleTheme"
          >
            <SunIcon
              v-if="isDark"
              class="h-5 w-5"
            />
            <MoonIcon
              v-else
              class="h-5 w-5"
            />
          </button>

          <!-- User menu -->
          <div
            v-if="user"
            class="relative"
            ref="userMenuRef"
          >
            <button
              class="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
              @click.stop="toggleUserMenu"
            >
              <div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ user.email?.charAt(0).toUpperCase() }}
                </span>
              </div>
              <span class="hidden sm:block text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ user.email }}
              </span>
              <ChevronDownIcon class="h-4 w-4 text-gray-400" />
            </button>

            <!-- User dropdown -->
            <Transition name="dropdown">
              <div
                v-if="showUserMenu"
                class="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 py-1 z-50"
              >
                <router-link
                  to="/account"
                  class="dropdown-item"
                  @click="showUserMenu = false"
                >
                  <UserIcon class="h-4 w-4" />
                  Account
                </router-link>
                <router-link
                  to="/security"
                  class="dropdown-item"
                  @click="showUserMenu = false"
                >
                  <ShieldCheckIcon class="h-4 w-4" />
                  Security
                </router-link>
                <router-link
                  to="/settings"
                  class="dropdown-item"
                  @click="showUserMenu = false"
                >
                  <CogIcon class="h-4 w-4" />
                  Settings
                </router-link>
                <hr class="my-1 border-gray-200 dark:border-dark-700">
                <button
                  class="dropdown-item w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  @click="handleLogout"
                >
                  <ArrowRightOnRectangleIcon class="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </Transition>
          </div>

          <!-- Mobile menu button -->
          <button
            class="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            @click="showMobileMenu = !showMobileMenu"
          >
            <Bars3Icon
              v-if="!showMobileMenu"
              class="h-6 w-6"
            />
            <XMarkIcon
              v-else
              class="h-6 w-6"
            />
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <Transition name="mobile-menu">
        <div
          v-if="showMobileMenu"
          class="md:hidden border-t border-gray-200 dark:border-dark-700 py-4"
        >
          <nav class="space-y-2">
            <router-link
              to="/dashboard"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              Dashboard
            </router-link>
            <router-link
              to="/trading"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              Trading
            </router-link>
            <router-link
              to="/wallet"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              Wallet
            </router-link>
            <router-link
              to="/orders"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              Orders
            </router-link>
          </nav>
        </div>
      </Transition>
    </div>
  </header>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import {
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  CogIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline'

export default {
  name: 'AppHeader',
  components: {
    Bars3Icon,
    XMarkIcon,
    SunIcon,
    MoonIcon,
    UserIcon,
    CogIcon,
    ShieldCheckIcon,
    ArrowRightOnRectangleIcon,
    ChevronDownIcon
  },
  setup() {
    const authStore = useAuthStore()
    const themeStore = useThemeStore()

    const showMobileMenu = ref(false)
    const showUserMenu = ref(false)
    const userMenuRef = ref(null)

    const user = computed(() => authStore.user)
    const isDark = computed(() => themeStore.isDark)

    const toggleTheme = () => {
      themeStore.toggleDark()
    }

    const toggleUserMenu = () => {
      showUserMenu.value = !showUserMenu.value
    }

    const handleLogout = async () => {
      showUserMenu.value = false
      await authStore.logout()
    }

    // Handle click outside to close dropdown
    const handleClickOutside = (event) => {
      if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
        showUserMenu.value = false
      }
    }

    // Add/remove event listener
    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      authStore,
      showMobileMenu,
      showUserMenu,
      userMenuRef,
      user,
      isDark,
      toggleTheme,
      toggleUserMenu,
      handleLogout
    }
  }
}
</script>

<style scoped>
.nav-link {
  @apply text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors;
}

.nav-link-active {
  @apply text-primary-600 dark:text-primary-400;
}

.mobile-nav-link {
  @apply block px-3 py-2 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-md transition-colors;
}

.dropdown-item {
  @apply flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: all 0.3s ease;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  max-height: 0;
}

.mobile-menu-enter-to,
.mobile-menu-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>