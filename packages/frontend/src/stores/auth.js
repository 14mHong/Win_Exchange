import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/services/authService'
import { useNotificationStore } from './notification'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const loginAttempts = ref(0)
  const maxLoginAttempts = 5
  const lockoutTime = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isEmailVerified = computed(() => user.value?.email_verified || false)
  const isPhoneVerified = computed(() => user.value?.phone_verified || false)
  const is2FAEnabled = computed(() => user.value?.two_fa_enabled || false)
  const isLocked = computed(() => {
    if (!lockoutTime.value) {return false}
    return new Date() < new Date(lockoutTime.value)
  })

  // Actions
  const setToken = (newToken) => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('auth_token', newToken)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  const setUser = (userData) => {
    user.value = userData
  }

  const clearAuth = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
  }

  const register = async (registrationData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.register(registrationData)
      
      if (response.success) {
        notificationStore.addNotification({
          type: 'success',
          title: 'Registration Successful',
          message: response.message
        })
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Registration Failed',
        message: error.message || 'An unexpected error occurred'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const login = async (credentials) => {
    const notificationStore = useNotificationStore()
    
    // Check if locked out
    if (isLocked.value) {
      const remainingTime = Math.ceil((new Date(lockoutTime.value) - new Date()) / 1000 / 60)
      throw new Error(`Account locked. Try again in ${remainingTime} minutes.`)
    }

    try {
      isLoading.value = true
      const response = await authService.login(credentials)
      
      if (response.success && response.token) {
        // Reset login attempts on successful login
        loginAttempts.value = 0
        lockoutTime.value = null
        
        setToken(response.token)
        setUser(response.user)
        
        notificationStore.addNotification({
          type: 'success',
          title: 'Login Successful',
          message: 'Welcome back!'
        })
        
        return response
      } else if (response.requiresTwoFA) {
        return response
      }
    } catch (error) {
      // Increment login attempts
      loginAttempts.value++
      
      // Lock account after max attempts
      if (loginAttempts.value >= maxLoginAttempts) {
        lockoutTime.value = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        notificationStore.addNotification({
          type: 'error',
          title: 'Account Locked',
          message: 'Too many failed login attempts. Account locked for 15 minutes.'
        })
      } else {
        const attemptsLeft = maxLoginAttempts - loginAttempts.value
        notificationStore.addNotification({
          type: 'error',
          title: 'Login Failed',
          message: `${error.message}. ${attemptsLeft} attempts remaining.`
        })
      }
      
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    const notificationStore = useNotificationStore()

    try {
      if (token.value) {
        await authService.logout()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
      notificationStore.addNotification({
        type: 'info',
        title: 'Logged Out',
        message: 'You have been logged out successfully'
      })
      // Redirect to landing page
      window.location.href = '/'
    }
  }

  const getProfile = async () => {
    try {
      isLoading.value = true
      const response = await authService.getProfile()
      
      if (response.success) {
        setUser(response.user)
        return response.user
      }
    } catch (error) {
      // Token might be invalid
      clearAuth()
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const updateProfile = async (profileData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.updateProfile(profileData)
      
      if (response.success) {
        // Update user data
        await getProfile()
        
        notificationStore.addNotification({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile has been updated successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update profile'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const verifyEmail = async (code) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.verifyEmail(code)
      
      if (response.success) {
        // Update user data
        await getProfile()
        
        notificationStore.addNotification({
          type: 'success',
          title: 'Email Verified',
          message: 'Your email has been verified successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Verification Failed',
        message: error.message || 'Failed to verify email'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const verifyPhone = async (code) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.verifyPhone(code)
      
      if (response.success) {
        // Update user data
        await getProfile()
        
        notificationStore.addNotification({
          type: 'success',
          title: 'Phone Verified',
          message: 'Your phone number has been verified successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Verification Failed',
        message: error.message || 'Failed to verify phone number'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const resendVerification = async (type) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.resendVerification(type)
      
      if (response.success) {
        notificationStore.addNotification({
          type: 'success',
          title: 'Verification Sent',
          message: response.message
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Send Failed',
        message: error.message || 'Failed to send verification code'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const setup2FA = async () => {
    try {
      isLoading.value = true
      const response = await authService.setup2FA()
      return response
    } catch (error) {
      console.error('2FA setup error:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const verify2FASetup = async (token) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.verify2FASetup(token)
      
      if (response.success) {
        // Update user data
        await getProfile()
        
        notificationStore.addNotification({
          type: 'success',
          title: '2FA Enabled',
          message: 'Two-factor authentication has been enabled successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: '2FA Setup Failed',
        message: error.message || 'Failed to enable two-factor authentication'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const disable2FA = async (token) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.disable2FA(token)
      
      if (response.success) {
        // Update user data
        await getProfile()
        
        notificationStore.addNotification({
          type: 'success',
          title: '2FA Disabled',
          message: 'Two-factor authentication has been disabled'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: '2FA Disable Failed',
        message: error.message || 'Failed to disable two-factor authentication'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const resetPassword = async (email) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.resetPassword(email)
      
      if (response.success) {
        notificationStore.addNotification({
          type: 'success',
          title: 'Reset Email Sent',
          message: response.message
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Reset Failed',
        message: error.message || 'Failed to send reset email'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const confirmPasswordReset = async (resetData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.confirmPasswordReset(resetData)
      
      if (response.success) {
        notificationStore.addNotification({
          type: 'success',
          title: 'Password Reset',
          message: 'Your password has been reset successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Reset Failed',
        message: error.message || 'Failed to reset password'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (passwordData) => {
    const notificationStore = useNotificationStore()
    
    try {
      isLoading.value = true
      const response = await authService.changePassword(passwordData)
      
      if (response.success) {
        notificationStore.addNotification({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully'
        })
        
        return response
      }
    } catch (error) {
      notificationStore.addNotification({
        type: 'error',
        title: 'Change Failed',
        message: error.message || 'Failed to change password'
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken()
      
      if (response.success && response.token) {
        setToken(response.token)
        return response
      }
    } catch (error) {
      // Token refresh failed, logout user
      clearAuth()
      throw error
    }
  }

  return {
    // State
    user,
    token,
    isLoading,
    loginAttempts,
    lockoutTime,
    
    // Getters
    isAuthenticated,
    isEmailVerified,
    isPhoneVerified,
    is2FAEnabled,
    isLocked,

    // Actions
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    verifyEmail,
    verifyPhone,
    resendVerification,
    setup2FA,
    verify2FASetup,
    disable2FA,
    resetPassword,
    confirmPasswordReset,
    changePassword,
    refreshToken,
    setToken,
    setUser,
    clearAuth
  }
})