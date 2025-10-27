<template>
  <div class="security-page">
    <BackButton class="mb-4" />
    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">Security Settings</h1>
      <p class="text-gray-400">Manage your account security and authentication</p>
    </div>

    <!-- Security Overview -->
    <div class="security-overview">
      <h2 class="section-title">Security Status</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="status-card">
          <div class="status-icon" :class="user?.two_fa_enabled ? 'enabled' : 'disabled'">
            🔐
          </div>
          <div class="status-info">
            <h3 class="status-label">Two-Factor Authentication</h3>
            <p class="status-value" :class="user?.two_fa_enabled ? 'text-green-400' : 'text-red-400'">
              {{ user?.two_fa_enabled ? 'Enabled' : 'Disabled' }}
            </p>
          </div>
        </div>

        <div class="status-card">
          <div class="status-icon" :class="user?.email_verified ? 'enabled' : 'disabled'">
            ✉️
          </div>
          <div class="status-info">
            <h3 class="status-label">Email Verification</h3>
            <p class="status-value" :class="user?.email_verified ? 'text-green-400' : 'text-yellow-400'">
              {{ user?.email_verified ? 'Verified' : 'Pending' }}
            </p>
          </div>
        </div>

        <div class="status-card">
          <div class="status-icon" :class="user?.phone_verified ? 'enabled' : 'disabled'">
            📱
          </div>
          <div class="status-info">
            <h3 class="status-label">Phone Verification</h3>
            <p class="status-value" :class="user?.phone_verified ? 'text-green-400' : 'text-gray-400'">
              {{ user?.phone_verified ? 'Verified' : 'Not Set' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Two-Factor Authentication Section -->
    <div class="security-section">
      <h2 class="section-title">Two-Factor Authentication (2FA)</h2>

      <!-- 2FA Status -->
      <div class="twofa-status">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-white font-semibold mb-1">
              {{ user?.two_fa_enabled ? 'Two-Factor Authentication is Enabled' : 'Two-Factor Authentication is Disabled' }}
            </h3>
            <p class="text-gray-400 text-sm">
              {{ user?.two_fa_enabled
                ? 'Your account is protected with 2FA. You\'ll need your authenticator app to log in and make withdrawals.'
                : 'Enable 2FA to add an extra layer of security to your account. Required for withdrawals.'
              }}
            </p>
          </div>
          <div class="twofa-badge" :class="user?.two_fa_enabled ? 'enabled' : 'disabled'">
            {{ user?.two_fa_enabled ? 'Enabled' : 'Disabled' }}
          </div>
        </div>
      </div>

      <!-- Enable 2FA -->
      <div v-if="!user?.two_fa_enabled" class="twofa-setup">
        <button
          @click="initiate2FASetup"
          :disabled="isSettingUp2FA"
          class="primary-btn"
        >
          <span v-if="!isSettingUp2FA">Enable 2FA</span>
          <span v-else class="flex items-center gap-2">
            <div class="spinner-small"></div>
            Setting up...
          </span>
        </button>
      </div>

      <!-- Disable 2FA -->
      <div v-else class="twofa-disable">
        <button
          @click="showDisable2FAModal = true"
          class="danger-btn"
        >
          Disable 2FA
        </button>
      </div>
    </div>

    <!-- 2FA Setup Modal -->
    <div v-if="show2FASetupModal" class="modal-overlay" @click="cancel2FASetup">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h3 class="text-2xl font-bold text-white">Set Up Two-Factor Authentication</h3>
          <button @click="cancel2FASetup" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <!-- Step 1: Scan QR Code -->
          <div class="setup-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4 class="step-title">Scan QR Code</h4>
              <p class="step-description">
                Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code
              </p>
              <div v-if="qrCode" class="qr-container">
                <img :src="qrCode" alt="2FA QR Code" class="qr-image" />
              </div>
            </div>
          </div>

          <!-- Step 2: Manual Entry -->
          <div class="setup-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4 class="step-title">Or Enter Manually</h4>
              <p class="step-description">
                If you can't scan the QR code, enter this key manually in your authenticator app
              </p>
              <div class="manual-key">
                <code class="secret-key">{{ manualKey }}</code>
                <button @click="copySecret" class="copy-icon-btn" title="Copy">
                  📋
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Verify -->
          <div class="setup-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4 class="step-title">Verify Code</h4>
              <p class="step-description">
                Enter the 6-digit code from your authenticator app to complete setup
              </p>
              <form @submit.prevent="verify2FASetup">
                <input
                  v-model="verificationCode"
                  type="text"
                  maxlength="6"
                  pattern="\d{6}"
                  class="code-input"
                  placeholder="000000"
                  required
                />
                <button
                  type="submit"
                  :disabled="isVerifying2FA"
                  class="submit-btn mt-4"
                >
                  <span v-if="!isVerifying2FA">Verify and Enable 2FA</span>
                  <span v-else class="flex items-center justify-center gap-2">
                    <div class="spinner-small"></div>
                    Verifying...
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2FA Disable Modal -->
    <div v-if="showDisable2FAModal" class="modal-overlay" @click="showDisable2FAModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="text-2xl font-bold text-white">Disable Two-Factor Authentication</h3>
          <button @click="showDisable2FAModal = false" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="warning-box">
            <div class="warning-icon">⚠️</div>
            <div>
              <p class="text-white font-semibold mb-2">Warning: Disabling 2FA will make your account less secure</p>
              <p class="text-gray-400 text-sm">
                You will no longer be able to make withdrawals without re-enabling 2FA. Are you sure you want to continue?
              </p>
            </div>
          </div>

          <form @submit.prevent="handleDisable2FA" class="mt-6">
            <div class="form-group">
              <label class="form-label">Enter your 2FA code to confirm</label>
              <input
                v-model="disable2FACode"
                type="text"
                maxlength="6"
                pattern="\d{6}"
                class="code-input"
                placeholder="000000"
                required
              />
            </div>

            <div class="flex gap-3 mt-6">
              <button
                type="button"
                @click="showDisable2FAModal = false"
                class="secondary-btn flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isDisabling2FA"
                class="danger-btn flex-1"
              >
                <span v-if="!isDisabling2FA">Disable 2FA</span>
                <span v-else class="flex items-center justify-center gap-2">
                  <div class="spinner-small"></div>
                  Disabling...
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Account Info Section -->
    <div class="security-section">
      <h2 class="section-title">Account Information</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Email:</span>
          <span class="info-value">{{ user?.email || 'Not set' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Phone:</span>
          <span class="info-value">{{ user?.phone || 'Not set' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Account Status:</span>
          <span class="info-value" :class="user?.is_active ? 'text-green-400' : 'text-red-400'">
            {{ user?.is_active ? 'Active' : 'Inactive' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Member Since:</span>
          <span class="info-value">{{ formatDate(user?.created_at) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Provider:</span>
          <span class="info-value capitalize">{{ user?.provider || 'Local' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { apiHelpers } from '@/services/api';
import BackButton from '@/components/BackButton.vue';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// State
const user = ref(null);
const isSettingUp2FA = ref(false);
const isVerifying2FA = ref(false);
const isDisabling2FA = ref(false);
const show2FASetupModal = ref(false);
const showDisable2FAModal = ref(false);
const qrCode = ref('');
const manualKey = ref('');
const verificationCode = ref('');
const disable2FACode = ref('');

// Fetch user profile
const fetchProfile = async () => {
  try {
    const response = await apiHelpers.get('/api/auth/profile');
    if (response.success) {
      user.value = response.user;
    }
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    notificationStore.error('Error', 'Failed to load profile');
  }
};

// Initiate 2FA setup
const initiate2FASetup = async () => {
  isSettingUp2FA.value = true;

  try {
    const response = await apiHelpers.post('/api/auth/2fa/setup');

    if (response.success) {
      qrCode.value = response.qrCode;
      manualKey.value = response.manualEntryKey;
      show2FASetupModal.value = true;
    } else {
      throw new Error(response.error || 'Failed to setup 2FA');
    }
  } catch (err) {
    console.error('2FA setup error:', err);
    notificationStore.error('Error', err.message || 'Failed to setup 2FA');
  } finally {
    isSettingUp2FA.value = false;
  }
};

// Verify 2FA setup
const verify2FASetup = async () => {
  if (verificationCode.value.length !== 6) {
    notificationStore.error('Error', 'Please enter a 6-digit code');
    return;
  }

  isVerifying2FA.value = true;

  try {
    const response = await apiHelpers.post('/api/auth/2fa/verify-setup', {
      token: verificationCode.value
    });

    if (response.success) {
      notificationStore.success('Success', 'Two-factor authentication enabled successfully');
      show2FASetupModal.value = false;
      verificationCode.value = '';
      qrCode.value = '';
      manualKey.value = '';
      await fetchProfile();
    } else {
      throw new Error(response.error || 'Invalid verification code');
    }
  } catch (err) {
    console.error('2FA verification error:', err);
    notificationStore.error('Error', err.message || 'Failed to verify code');
  } finally {
    isVerifying2FA.value = false;
  }
};

// Cancel 2FA setup
const cancel2FASetup = () => {
  show2FASetupModal.value = false;
  verificationCode.value = '';
  qrCode.value = '';
  manualKey.value = '';
};

// Disable 2FA
const handleDisable2FA = async () => {
  if (disable2FACode.value.length !== 6) {
    notificationStore.error('Error', 'Please enter a 6-digit code');
    return;
  }

  isDisabling2FA.value = true;

  try {
    const response = await apiHelpers.post('/api/auth/2fa/disable', {
      token: disable2FACode.value
    });

    if (response.success) {
      notificationStore.success('Success', 'Two-factor authentication disabled');
      showDisable2FAModal.value = false;
      disable2FACode.value = '';
      await fetchProfile();
    } else {
      throw new Error(response.error || 'Invalid verification code');
    }
  } catch (err) {
    console.error('2FA disable error:', err);
    notificationStore.error('Error', err.message || 'Failed to disable 2FA');
  } finally {
    isDisabling2FA.value = false;
  }
};

// Copy secret key
const copySecret = async () => {
  try {
    await navigator.clipboard.writeText(manualKey.value);
    notificationStore.success('Copied', 'Secret key copied to clipboard');
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

// Format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Load profile on mount
onMounted(() => {
  fetchProfile();
});
</script>

<style scoped>
.security-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.security-overview {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin-bottom: 1.5rem;
}

.status-card {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-icon {
  font-size: 2.5rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.status-icon.enabled {
  background: rgba(72, 187, 120, 0.2);
}

.status-icon.disabled {
  background: rgba(245, 101, 101, 0.2);
}

.status-info {
  flex: 1;
}

.status-label {
  font-size: 0.875rem;
  color: #a0aec0;
  margin-bottom: 0.25rem;
}

.status-value {
  font-size: 1.125rem;
  font-weight: 600;
}

.security-section {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.security-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  color: #e2e8f0;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: white;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #4299e1;
}

.form-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #718096;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #4299e1 0%, #48bb78 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.twofa-status {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.twofa-badge {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.twofa-badge.enabled {
  background: rgba(72, 187, 120, 0.2);
  color: #48bb78;
}

.twofa-badge.disabled {
  background: rgba(245, 101, 101, 0.2);
  color: #f56565;
}

.primary-btn {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-btn:hover:not(:disabled) {
  background: #3182ce;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger-btn {
  background: #f56565;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.danger-btn:hover:not(:disabled) {
  background: #e53e3e;
}

.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  background: transparent;
  color: #4299e1;
  border: 1px solid #4299e1;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: rgba(66, 153, 225, 0.1);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #2d3748;
}

.close-btn {
  background: none;
  border: none;
  color: #a0aec0;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

.modal-body {
  padding: 2rem;
}

.setup-step {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #2d3748;
}

.setup-step:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.step-number {
  width: 32px;
  height: 32px;
  background: #4299e1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.5rem;
}

.step-description {
  color: #a0aec0;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.qr-container {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  display: inline-block;
}

.qr-image {
  display: block;
  width: 200px;
  height: 200px;
}

.manual-key {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
}

.secret-key {
  flex: 1;
  color: #4299e1;
  font-family: monospace;
  font-size: 1rem;
  word-break: break-all;
}

.copy-icon-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  transition: transform 0.2s;
}

.copy-icon-btn:hover {
  transform: scale(1.1);
}

.code-input {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem;
  color: white;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.5rem;
  font-family: monospace;
}

.code-input:focus {
  outline: none;
  border-color: #4299e1;
}

.warning-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
}

.warning-icon {
  font-size: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.info-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  color: #a0aec0;
  font-size: 0.875rem;
}

.info-value {
  color: white;
  font-weight: 600;
}

@media (max-width: 768px) {
  .security-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .status-card {
    flex-direction: column;
    text-align: center;
    padding: 1.25rem;
  }

  .security-card {
    padding: 1.25rem;
  }

  .card-title {
    font-size: 1.125rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .btn {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }
}

@media (max-width: 640px) {
  .security-page {
    padding: 0.75rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }

  .status-card {
    padding: 1rem;
    gap: 0.75rem;
  }

  .status-icon {
    width: 48px;
    height: 48px;
    font-size: 1.5rem;
  }

  .status-title {
    font-size: 1rem;
  }

  .status-description {
    font-size: 0.813rem;
  }

  .security-card {
    padding: 1rem;
  }

  .card-title {
    font-size: 1rem;
  }

  .card-description {
    font-size: 0.813rem;
  }

  .info-grid {
    gap: 0.75rem;
  }

  .info-label {
    font-size: 0.75rem;
  }

  .info-value {
    font-size: 0.875rem;
  }

  .btn {
    padding: 0.5rem 0.875rem;
    font-size: 0.813rem;
  }
}

@media (max-width: 480px) {
  .security-page {
    padding: 0.5rem;
  }

  .page-header h1 {
    font-size: 1.125rem;
  }

  .status-card {
    padding: 0.875rem;
  }

  .status-icon {
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
  }

  .security-card {
    padding: 0.875rem;
  }

  .card-title {
    font-size: 0.938rem;
  }

  .btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
