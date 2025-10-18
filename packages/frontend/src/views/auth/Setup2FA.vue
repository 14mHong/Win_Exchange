<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Setup Two-Factor Authentication
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Secure your account with 2FA for enhanced protection
        </p>
      </div>

      <div class="mt-8 space-y-6">
        <div class="bg-white shadow rounded-lg p-6">
          <div v-if="step === 1">
            <h3 class="text-lg font-medium mb-4">
              Step 1: Install Authenticator App
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              Download and install an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
            </p>
            <button
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              @click="step = 2"
            >
              I have an authenticator app
            </button>
          </div>

          <div v-if="step === 2">
            <h3 class="text-lg font-medium mb-4">
              Step 2: Scan QR Code
            </h3>
            <div class="text-center mb-4">
              <div class="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
                <div class="w-48 h-48 bg-gray-200 flex items-center justify-center">
                  <!-- QR Code placeholder -->
                  <span class="text-gray-500">QR Code</span>
                </div>
              </div>
              <p class="mt-2 text-sm text-gray-600">
                Or manually enter this code: <code class="bg-gray-100 px-2 py-1 rounded">{{ secretKey }}</code>
              </p>
            </div>
            <button
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              @click="step = 3"
            >
              I've scanned the code
            </button>
          </div>

          <div v-if="step === 3">
            <h3 class="text-lg font-medium mb-4">
              Step 3: Verify Setup
            </h3>
            <form @submit.prevent="verify2FA">
              <div class="mb-4">
                <label
                  for="code"
                  class="block text-sm font-medium text-gray-700 mb-2"
                >
                  Enter the 6-digit code from your authenticator app:
                </label>
                <input
                  id="code"
                  v-model="verificationCode"
                  type="text"
                  maxlength="6"
                  class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="123456"
                  required
                >
              </div>
              <button
                type="submit"
                :disabled="loading || verificationCode.length !== 6"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
              >
                {{ loading ? 'Verifying...' : 'Complete Setup' }}
              </button>
            </form>
          </div>

          <div v-if="step === 4">
            <div class="text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  class="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                2FA Setup Complete!
              </h3>
              <p class="text-sm text-gray-600 mb-4">
                Your account is now secured with two-factor authentication.
              </p>
              <button
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                @click="$router.push('/dashboard')"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Setup2FA',
  data() {
    return {
      step: 1,
      secretKey: 'JBSWY3DPEHPK3PXP',
      verificationCode: '',
      loading: false
    }
  },
  methods: {
    async verify2FA() {
      this.loading = true
      try {
        // Mock API call for verification
        await new Promise(resolve => setTimeout(resolve, 1000))
        this.step = 4
      } catch (error) {
        console.error('2FA verification failed:', error)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>