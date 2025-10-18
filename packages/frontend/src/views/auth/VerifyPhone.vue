<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Verify Phone Number
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          We've sent a verification code to your phone number
        </p>
      </div>

      <div class="mt-8 space-y-6">
        <div class="bg-white shadow rounded-lg p-6">
          <form @submit.prevent="verifyPhone">
            <div class="mb-4">
              <label
                for="phone"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number
              </label>
              <input
                id="phone"
                v-model="phoneNumber"
                type="tel"
                class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="+1 (555) 123-4567"
                disabled
              >
            </div>

            <div class="mb-4">
              <label
                for="code"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                Verification Code
              </label>
              <input
                id="code"
                v-model="verificationCode"
                type="text"
                maxlength="6"
                class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter 6-digit code"
                required
              >
            </div>

            <div class="flex items-center justify-between mb-6">
              <button
                type="button"
                :disabled="loading || countdown > 0"
                class="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
                @click="resendCode"
              >
                {{ countdown > 0 ? `Resend in ${countdown}s` : 'Resend code' }}
              </button>
              <span class="text-sm text-gray-500">
                Code expires in {{ timeLeft }}
              </span>
            </div>

            <div class="space-y-3">
              <button
                type="submit"
                :disabled="loading || verificationCode.length !== 6"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
              >
                {{ loading ? 'Verifying...' : 'Verify Phone Number' }}
              </button>

              <button
                type="button"
                class="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                @click="$router.push('/dashboard')"
              >
                Skip for now
              </button>
            </div>
          </form>

          <div
            v-if="error"
            class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-800">
                  {{ error }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VerifyPhone',
  data() {
    return {
      phoneNumber: '+1 (555) 123-4567',
      verificationCode: '',
      loading: false,
      error: '',
      countdown: 0,
      timeLeft: '5:00'
    }
  },
  mounted() {
    this.startCountdown()
    this.startTimeLeft()
  },
  methods: {
    async verifyPhone() {
      this.loading = true
      this.error = ''
      
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        if (this.verificationCode === '123456') {
          this.$router.push('/auth/setup-2fa')
        } else {
          this.error = 'Invalid verification code. Please try again.'
        }
      } catch (error) {
        this.error = 'Verification failed. Please try again.'
      } finally {
        this.loading = false
      }
    },
    
    async resendCode() {
      this.loading = true
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500))
        this.countdown = 60
        this.startCountdown()
        this.timeLeft = '5:00'
        this.startTimeLeft()
      } catch (error) {
        this.error = 'Failed to resend code. Please try again.'
      } finally {
        this.loading = false
      }
    },
    
    startCountdown() {
      const timer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--
        } else {
          clearInterval(timer)
        }
      }, 1000)
    },
    
    startTimeLeft() {
      let seconds = 300 // 5 minutes
      const timer = setInterval(() => {
        if (seconds > 0) {
          const mins = Math.floor(seconds / 60)
          const secs = seconds % 60
          this.timeLeft = `${mins}:${secs.toString().padStart(2, '0')}`
          seconds--
        } else {
          this.timeLeft = '0:00'
          clearInterval(timer)
        }
      }, 1000)
    }
  }
}
</script>