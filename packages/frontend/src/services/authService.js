import { apiHelpers } from './api'

const authService = {
  // User registration
  register: async (registrationData) => {
    return await apiHelpers.post('/api/auth/register', registrationData)
  },

  // User login
  login: async (credentials) => {
    return await apiHelpers.post('/api/auth/login', credentials)
  },

  // User logout
  logout: async () => {
    return await apiHelpers.post('/api/auth/logout')
  },

  // Get user profile
  getProfile: async () => {
    return await apiHelpers.get('/api/auth/profile')
  },

  // Update user profile
  updateProfile: async (profileData) => {
    return await apiHelpers.put('/api/auth/profile', profileData)
  },

  // Email verification
  verifyEmail: async (code) => {
    return await apiHelpers.post('/api/auth/verify/email', { code })
  },

  // Phone verification
  verifyPhone: async (code) => {
    return await apiHelpers.post('/api/auth/verify/phone', { code })
  },

  // Resend verification code
  resendVerification: async (type) => {
    return await apiHelpers.post('/api/auth/verify/resend', { type })
  },

  // Setup 2FA
  setup2FA: async () => {
    return await apiHelpers.post('/api/auth/2fa/setup')
  },

  // Verify 2FA setup
  verify2FASetup: async (token) => {
    return await apiHelpers.post('/api/auth/2fa/verify-setup', { token })
  },

  // Disable 2FA
  disable2FA: async (token) => {
    apiHelpers.set2FAToken(token)
    try {
      const result = await apiHelpers.post('/api/auth/2fa/disable', { token })
      return result
    } finally {
      apiHelpers.set2FAToken(null)
    }
  },

  // Password reset request
  resetPassword: async (email) => {
    return await apiHelpers.post('/api/auth/reset-password', { email })
  },

  // Confirm password reset
  confirmPasswordReset: async (resetData) => {
    return await apiHelpers.post('/api/auth/reset-password/confirm', resetData)
  },

  // Change password
  changePassword: async (passwordData) => {
    // Set 2FA token if provided
    if (passwordData.two_fa_token) {
      apiHelpers.set2FAToken(passwordData.two_fa_token)
    }

    try {
      const result = await apiHelpers.post('/api/auth/change-password', passwordData)
      return result
    } finally {
      apiHelpers.set2FAToken(null)
    }
  },

  // Refresh token
  refreshToken: async () => {
    return await apiHelpers.post('/api/auth/refresh-token')
  },

  // Validate current session
  validateSession: async () => {
    try {
      const response = await apiHelpers.get('/api/auth/profile')
      return response.success
    } catch (error) {
      return false
    }
  },

  // Get user sessions
  getSessions: async () => {
    return await apiHelpers.get('/api/auth/sessions')
  },

  // Revoke session
  revokeSession: async (sessionId) => {
    return await apiHelpers.delete(`/api/auth/sessions/${sessionId}`)
  },

  // Revoke all sessions
  revokeAllSessions: async () => {
    return await apiHelpers.delete('/api/auth/sessions')
  },

  // Get OAuth authorization URL
  getOAuthURL: async (provider, invite_code) => {
    const url = invite_code
      ? `/api/auth/oauth/${provider}?invite_code=${encodeURIComponent(invite_code)}`
      : `/api/auth/oauth/${provider}`;
    const response = await apiHelpers.get(url)
    return response
  },

  // OAuth callback
  handleOAuthCallback: async (provider, code, state) => {
    const payload = {
      code,
      state
    }

    return await apiHelpers.post(`/api/auth/oauth/${provider}/callback`, payload)
  },

  // Check if email exists
  checkEmail: async (email) => {
    return await apiHelpers.post('/api/auth/check-email', { email })
  },

  // Get password strength
  checkPasswordStrength: (password) => {
    const strength = {
      score: 0,
      feedback: []
    }

    // Length check
    if (password.length >= 8) {
      strength.score += 1
    } else {
      strength.feedback.push('Password must be at least 8 characters long')
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      strength.score += 1
    } else {
      strength.feedback.push('Password must contain at least one uppercase letter')
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      strength.score += 1
    } else {
      strength.feedback.push('Password must contain at least one lowercase letter')
    }

    // Number check
    if (/\d/.test(password)) {
      strength.score += 1
    } else {
      strength.feedback.push('Password must contain at least one number')
    }

    // Special character check
    if (/[@$!%*?&]/.test(password)) {
      strength.score += 1
    } else {
      strength.feedback.push('Password must contain at least one special character (@$!%*?&)')
    }

    // Common patterns check
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i
    ]

    if (commonPatterns.some(pattern => pattern.test(password))) {
      strength.score -= 1
      strength.feedback.push('Avoid common password patterns')
    }

    return {
      score: Math.max(0, Math.min(5, strength.score)),
      feedback: strength.feedback,
      isStrong: strength.score >= 4
    }
  },

  // Generate secure password
  generateSecurePassword: (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&'
    let password = ''
    
    // Ensure at least one character from each required set
    const required = [
      'abcdefghijklmnopqrstuvwxyz', // lowercase
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // uppercase
      '0123456789', // numbers
      '@$!%*?&' // special characters
    ]

    // Add one character from each required set
    required.forEach(set => {
      password += set.charAt(Math.floor(Math.random() * set.length))
    })

    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }

    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('')
  },

  // Format phone number
  formatPhoneNumber: (phoneNumber) => {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '')
    
    // Add country code if not present (assuming US +1 for this example)
    if (cleaned.length === 10) {
      return '+1' + cleaned
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return '+' + cleaned
    } else {
      return '+' + cleaned
    }
  },

  // Validate email format
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // Validate phone number format
  validatePhoneNumber: (phoneNumber) => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber)
  },

  // Validate password format
  validatePassword: (password) => {
    // Check password strength using existing method
    const strength = authService.checkPasswordStrength(password)
    return strength.isStrong
  },

  // Get user agent info
  getUserAgent: () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  },

  // Get device fingerprint (basic)
  getDeviceFingerprint: () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Device fingerprint', 2, 2)
    
    return {
      screen: `${screen.width}x${screen.height}`,
      timezone: new Date().getTimezoneOffset(),
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      canvas: canvas.toDataURL()
    }
  }
}

export default authService