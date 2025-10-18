import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Define public routes that don't need authentication
    const publicRoutes = [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/reset-password',
      '/api/auth/reset-password/confirm',
      '/api/auth/oauth'
    ]

    // Check if current request is to a public route
    const isPublicRoute = publicRoutes.some(route => config.url?.includes(route))

    // Add auth token only for non-public routes
    const authStore = useAuthStore()
    if (authStore.token && !isPublicRoute) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }

    // Add request timestamp for API key authentication
    config.headers['X-Timestamp'] = Date.now().toString()

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data
      })
    }

    return config
  },
  (error) => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      })
    }

    return response.data
  },
  async (error) => {
    const authStore = useAuthStore()
    const notificationStore = useNotificationStore()

    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      })
    }

    // Handle different error types
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
      case 401:
        // Unauthorized - token might be expired
        if (authStore.isAuthenticated) {
          try {
            // Try to refresh token
            await authStore.refreshToken()
            // Retry the original request
            return api.request(error.config)
          } catch (refreshError) {
            // Refresh failed, logout user
            authStore.logout()
            notificationStore.error(
              'Session Expired',
              'Please log in again to continue'
            )
          }
        }
        break

      case 403:
        // Forbidden
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          notificationStore.warning(
            'Email Verification Required',
            'Please verify your email address to continue'
          )
        } else if (data.code === 'PHONE_NOT_VERIFIED') {
          notificationStore.warning(
            'Phone Verification Required',
            'Please verify your phone number to continue'
          )
        } else if (data.code === '2FA_REQUIRED') {
          notificationStore.warning(
            'Two-Factor Authentication Required',
            'Please enable 2FA for this action'
          )
        }
        break

      case 404:
        // Not found
        notificationStore.error(
          'Not Found',
          'The requested resource was not found'
        )
        break

      case 429:
        // Rate limited
        notificationStore.warning(
          'Rate Limited',
          'Too many requests. Please wait a moment and try again.'
        )
        break

      case 500:
        // Server error
        notificationStore.error(
          'Server Error',
          'An internal server error occurred. Please try again later.'
        )
        break

      case 503:
        // Service unavailable
        notificationStore.error(
          'Service Unavailable',
          'The service is temporarily unavailable. Please try again later.'
        )
        break

      default:
        // Other errors
        notificationStore.error(
          'Request Failed',
          data.error || 'An unexpected error occurred'
        )
      }

      // Return the error data for handling in components
      return Promise.reject(new Error(data.error || 'Request failed'))
    } else if (error.request) {
      // Network error
      notificationStore.error(
        'Network Error',
        'Unable to connect to the server. Please check your internet connection.'
      )
      return Promise.reject(new Error('Network error'))
    } else {
      // Request setup error
      notificationStore.error(
        'Request Error',
        'An error occurred while setting up the request'
      )
      return Promise.reject(error)
    }
  }
)

// API helper functions
export const apiHelpers = {
  // GET request
  get: (url, params = {}, config = {}) => {
    return api.get(url, { params, ...config })
  },

  // POST request
  post: (url, data = {}, config = {}) => {
    return api.post(url, data, config)
  },

  // PUT request
  put: (url, data = {}, config = {}) => {
    return api.put(url, data, config)
  },

  // PATCH request
  patch: (url, data = {}, config = {}) => {
    return api.patch(url, data, config)
  },

  // DELETE request
  delete: (url, config = {}) => {
    return api.delete(url, config)
  },

  // Upload file
  upload: (url, formData, onUploadProgress = null) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    })
  },

  // Download file
  download: (url, params = {}) => {
    return api.get(url, {
      params,
      responseType: 'blob'
    })
  },

  // Set 2FA token header
  set2FAToken: (token) => {
    if (token) {
      api.defaults.headers['X-2FA-Token'] = token
    } else {
      delete api.defaults.headers['X-2FA-Token']
    }
  },

  // Set API key headers (for trading API)
  setAPIKeyHeaders: (apiKey, apiSecret, signature) => {
    api.defaults.headers['X-API-Key'] = apiKey
    api.defaults.headers['X-API-Secret'] = apiSecret
    api.defaults.headers['X-Signature'] = signature
  },

  // Clear API key headers
  clearAPIKeyHeaders: () => {
    delete api.defaults.headers['X-API-Key']
    delete api.defaults.headers['X-API-Secret']
    delete api.defaults.headers['X-Signature']
  },

  // Handle file download with proper filename
  downloadFile: async (url, filename, params = {}) => {
    try {
      const response = await api.get(url, {
        params,
        responseType: 'blob'
      })

      // Create blob link to download
      const blob = new Blob([response], { type: response.type || 'application/octet-stream' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = filename
      link.click()

      // Clean up
      window.URL.revokeObjectURL(link.href)
      
      return true
    } catch (error) {
      console.error('Download failed:', error)
      throw error
    }
  },

  // Retry request with exponential backoff
  retryRequest: async (requestFn, maxRetries = 3, baseDelay = 1000) => {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn()
      } catch (error) {
        lastError = error

        // Don't retry on client errors (4xx) except 429
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          throw error
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  },

  // Check if error is retryable
  isRetryableError: (error) => {
    if (!error.response) {return true} // Network errors are retryable
    
    const status = error.response.status
    return status >= 500 || status === 429 // Server errors and rate limits are retryable
  },

  // Format error message for display
  getErrorMessage: (error) => {
    if (error.response?.data?.error) {
      return error.response.data.error
    }
    if (error.message) {
      return error.message
    }
    return 'An unexpected error occurred'
  }
}

export default api