import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'

// Layout components
const AuthLayout = () => import('@/components/layout/AuthLayout.vue')
const AppLayout = () => import('@/components/layout/AppLayout.vue')

// Auth pages
const Login = () => import('@/views/auth/Login.vue')
const Register = () => import('@/views/auth/Register.vue')
const VerifyRegistration = () => import('@/views/auth/VerifyRegistration.vue')
const ResetPassword = () => import('@/views/auth/ResetPassword.vue')
const ConfirmPasswordReset = () => import('@/views/auth/ConfirmPasswordReset.vue')
const VerifyEmail = () => import('@/views/auth/VerifyEmail.vue')
const VerifyPhone = () => import('@/views/auth/VerifyPhone.vue')
const Setup2FA = () => import('@/views/auth/Setup2FA.vue')
const OAuthCallback = () => import('@/views/auth/OAuthCallback.vue')

// Public pages
const LandingPage = () => import('@/views/LandingPage.vue')

// App pages
const Dashboard = () => import('@/views/Dashboard.vue')
const Trading = () => import('@/views/Trading.vue')
const Wallet = () => import('@/views/Wallet.vue')
const WalletDeposit = () => import('@/views/wallet/Deposit.vue')
const WalletWithdraw = () => import('@/views/wallet/Withdraw.vue')
const WalletHistory = () => import('@/views/wallet/History.vue')
const Orders = () => import('@/views/Orders.vue')
const TradeHistory = () => import('@/views/TradeHistory.vue')
const Account = () => import('@/views/Account.vue')
const Security = () => import('@/views/Security.vue')
const Settings = () => import('@/views/Settings.vue')
const Admin = () => import('@/views/Admin.vue')

// Error pages
const NotFound = () => import('@/views/errors/NotFound.vue')
const Forbidden = () => import('@/views/errors/Forbidden.vue')
const ServerError = () => import('@/views/errors/ServerError.vue')

const routes = [
  // Public landing page
  {
    path: '/',
    name: 'Home',
    component: LandingPage,
    meta: {
      title: 'Win Exchange - Professional Cryptocurrency Trading'
    }
  },

  // Auth routes (public)
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: { 
          requiresGuest: true,
          title: 'Sign In - Win Exchange'
        }
      },
      {
        path: '/register',
        name: 'Register',
        component: Register,
        meta: { 
          requiresGuest: true,
          title: 'Sign Up - Win Exchange'
        }
      },
      {
        path: '/verify-registration',
        name: 'VerifyRegistration',
        component: VerifyRegistration,
        meta: { 
          requiresGuest: true,
          title: 'Verify Registration - Win Exchange'
        }
      },
      {
        path: '/reset-password',
        name: 'ResetPassword',
        component: ResetPassword,
        meta: {
          requiresGuest: true,
          title: 'Reset Password - Win Exchange'
        }
      },
      {
        path: '/reset-password/confirm',
        name: 'ConfirmPasswordReset',
        component: ConfirmPasswordReset,
        meta: {
          requiresGuest: true,
          title: 'Confirm Password Reset - Win Exchange'
        }
      }
    ]
  },

  // OAuth callback routes (public)
  {
    path: '/auth/callback/:provider',
    name: 'OAuthCallback',
    component: OAuthCallback,
    meta: { 
      requiresGuest: true,
      title: 'Authenticating... - Win Exchange'
    }
  },

  // Verification routes (authenticated but not fully verified)
  {
    path: '/verify',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '/verify/email',
        name: 'VerifyEmail',
        component: VerifyEmail,
        meta: { 
          title: 'Verify Email - Win Exchange',
          requiresUnverifiedEmail: true
        }
      },
      {
        path: '/verify/phone',
        name: 'VerifyPhone',
        component: VerifyPhone,
        meta: { 
          title: 'Verify Phone - Win Exchange',
          requiresUnverifiedPhone: true
        }
      },
      {
        path: '/setup/2fa',
        name: 'Setup2FA',
        component: Setup2FA,
        meta: { 
          title: 'Setup 2FA - Win Exchange',
          requiresEmailVerification: true
        }
      }
    ]
  },

  // Main app routes (authenticated)
  {
    path: '/app',
    component: AppLayout,
    meta: {
      requiresAuth: true
      // Email verification is handled during registration/OAuth, no need to check again
    },
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { 
          title: 'Dashboard - Win Exchange'
        }
      },
      {
        path: '/trading/:pair?',
        name: 'Trading',
        component: Trading,
        props: true,
        meta: {
          title: 'Trading - Win Exchange'
        }
      },
      {
        path: '/wallet',
        name: 'Wallet',
        component: Wallet,
        redirect: { name: 'WalletDeposit' },
        meta: {
          title: 'Wallet - Win Exchange'
        },
        children: [
          {
            path: 'deposit/:currency?',
            name: 'WalletDeposit',
            component: WalletDeposit,
            props: true,
            meta: {
              title: 'Deposit - Win Exchange'
            }
          },
          {
            path: 'withdraw/:currency?',
            name: 'WalletWithdraw',
            component: WalletWithdraw,
            props: true,
            meta: {
              title: 'Withdraw - Win Exchange'
            }
          },
          {
            path: 'history',
            name: 'WalletHistory',
            component: WalletHistory,
            meta: {
              title: 'Transaction History - Win Exchange'
            }
          }
        ]
      },
      {
        path: '/orders',
        name: 'Orders',
        component: Orders,
        meta: {
          title: 'Orders - Win Exchange'
        }
      },
      {
        path: '/trades',
        name: 'TradeHistory',
        component: TradeHistory,
        meta: {
          title: 'Trade History - Win Exchange'
        }
      },
      {
        path: '/account',
        name: 'Account',
        component: Account,
        meta: { 
          title: 'Account - Win Exchange'
        }
      },
      {
        path: '/security',
        name: 'Security',
        component: Security,
        meta: { 
          title: 'Security - Win Exchange'
        }
      },
      {
        path: '/settings',
        name: 'Settings',
        component: Settings,
        meta: {
          title: 'Settings - Win Exchange'
        }
      },
      {
        path: '/admin',
        name: 'Admin',
        component: Admin,
        meta: {
          title: 'Admin Dashboard - Win Exchange',
          requiresAdmin: true
        }
      }
    ]
  },

  // Error routes
  {
    path: '/403',
    name: 'Forbidden',
    component: Forbidden,
    meta: { 
      title: 'Access Denied - Win Exchange'
    }
  },
  {
    path: '/500',
    name: 'ServerError',
    component: ServerError,
    meta: { 
      title: 'Server Error - Win Exchange'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
    meta: { 
      title: 'Page Not Found - Win Exchange'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  try {
    const authStore = useAuthStore()
    const notificationStore = useNotificationStore()

    // Set page title
    if (to.meta.title) {
      document.title = to.meta.title
    }

    // If we have a token but no user data, fetch the profile
    if (authStore.token && !authStore.user) {
      try {
        await authStore.getProfile()
      } catch (error) {
        // Token is invalid, clear it
        authStore.clearAuth()
      }
    }

    // Check authentication
    if (to.meta.requiresAuth) {
      if (!authStore?.isAuthenticated) {
        notificationStore?.warning('Authentication Required', 'Please log in to continue')
        return next('/login')
      }
    }

    // Redirect authenticated users away from guest pages
    if (to.meta.requiresGuest && authStore?.isAuthenticated) {
      return next('/dashboard')
    }

    // Check email verification
    if (to.meta.requiresEmailVerification && authStore && !authStore.isEmailVerified) {
      notificationStore?.warning('Email Verification Required', 'Please verify your email to continue')
      return next('/verify/email')
    }

    // Check phone verification
    if (to.meta.requiresPhoneVerification && authStore && !authStore.isPhoneVerified) {
      notificationStore?.warning('Phone Verification Required', 'Please verify your phone to continue')
      return next('/verify/phone')
    }

    // Check unverified email (for verification page)
    if (to.meta.requiresUnverifiedEmail && authStore?.isEmailVerified) {
      return next('/dashboard')
    }

    // Check unverified phone (for verification page)
    if (to.meta.requiresUnverifiedPhone && authStore?.isPhoneVerified) {
      return next('/dashboard')
    }

    // Check 2FA requirement for sensitive routes
    if (to.meta.requires2FA && authStore && !authStore.is2FAEnabled) {
      notificationStore?.warning('Two-Factor Authentication Required', 'Please enable 2FA to access this feature')
      return next('/security')
    }

    // Check admin requirement
    if (to.meta.requiresAdmin && authStore && !authStore.user?.is_admin) {
      notificationStore?.error('Access Denied', 'Admin privileges required')
      return next('/403')
    }

    next()
  } catch (error) {
    console.error('Navigation guard error:', error)
    // On error, allow navigation to continue
    next()
  }
})

// Navigation error handler
router.onError((error) => {
  console.error('Router error:', error)
  const notificationStore = useNotificationStore()
  notificationStore.error('Navigation Error', 'An error occurred while navigating')
})

// Route change analytics (you can integrate with analytics services)
router.afterEach((_to, _from) => {
  // Track page view
  if (import.meta.env.PROD) {
    // Example: gtag('config', 'GA_MEASUREMENT_ID', { page_path: to.fullPath })
  }
})

export default router