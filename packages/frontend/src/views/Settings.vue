<template>
  <div class="settings-page">
    <BackButton class="mb-4" />
    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">Settings</h1>
      <p class="text-gray-400">Manage your account settings and preferences</p>
    </div>

    <!-- Profile Settings -->
    <div class="settings-section">
      <div class="flex justify-between align-items-center mb-4">
        <h2 class="section-title mb-0">Profile Information</h2>
        <span v-if="userProvider && userProvider !== 'local'" class="provider-badge">
          {{ userProvider === 'google' ? '🔗 Google Account' : userProvider === 'facebook' ? '🔗 Facebook Account' : '🔗 OAuth Account' }}
        </span>
      </div>
      <form @submit.prevent="handleUpdateProfile" class="settings-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input
              v-model="profileForm.first_name"
              type="text"
              class="form-input"
              placeholder="Not set"
              disabled
            />
            <p class="form-hint">
              {{ userProvider !== 'local' ? `Managed by your ${userProvider} account` : 'Name was set during registration and cannot be changed' }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input
              v-model="profileForm.last_name"
              type="text"
              class="form-input"
              placeholder="Not set"
              disabled
            />
            <p class="form-hint">
              {{ userProvider !== 'local' ? `Managed by your ${userProvider} account` : 'Name was set during registration and cannot be changed' }}
            </p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input
            v-model="profileForm.email"
            type="email"
            class="form-input"
            disabled
          />
          <p class="form-hint">Email cannot be changed</p>
        </div>

        <div class="form-group">
          <label class="form-label">
            Phone Number
            <span v-if="userPhoneVerified" class="text-green-400 text-sm ml-2">✓ Verified</span>
            <span v-else-if="userPhone" class="text-orange-400 text-sm ml-2">⏳ Pending Verification</span>
          </label>
          <div class="phone-input-group">
            <input
              v-model="profileForm.phone"
              type="tel"
              class="form-input"
              placeholder="+1234567890"
              pattern="^\+[1-9]\d{1,14}$"
            />
            <button
              v-if="profileForm.phone && !userPhoneVerified"
              type="button"
              @click="openVerificationModal"
              class="verify-btn"
            >
              Verify
            </button>
          </div>
          <p class="form-hint">Must include country code (e.g., +1 for US)</p>
        </div>

        <button
          type="submit"
          :disabled="isUpdatingProfile"
          class="submit-btn"
        >
          <span v-if="!isUpdatingProfile">
            {{ hasPhoneChanged ? 'Add Phone & Send Verification' : 'Save Changes' }}
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            <div class="spinner-small"></div>
            Saving...
          </span>
        </button>
      </form>
    </div>

    <!-- Phone Verification Modal -->
    <div v-if="showVerificationModal" class="modal-overlay" @click="closeVerificationModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Verify Phone Number</h3>
          <button @click="closeVerificationModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">
            Enter the 6-digit verification code sent to {{ profileForm.phone }}
          </p>
          <input
            v-model="verificationCode"
            type="text"
            class="form-input text-center text-2xl tracking-widest"
            placeholder="000000"
            maxlength="6"
            pattern="\d{6}"
            @input="verificationCode = verificationCode.replace(/\D/g, '')"
          />
          <div class="modal-actions">
            <button
              @click="verifyPhone"
              :disabled="isVerifying || verificationCode.length !== 6"
              class="modal-btn primary"
            >
              <span v-if="!isVerifying">Verify</span>
              <span v-else class="flex items-center justify-center gap-2">
                <div class="spinner-small"></div>
                Verifying...
              </span>
            </button>
            <button
              @click="resendCode"
              :disabled="isResending"
              class="modal-btn secondary"
            >
              <span v-if="!isResending">Resend Code</span>
              <span v-else>Sending...</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Preferences -->
    <div class="settings-section">
      <h2 class="section-title">Notification Preferences</h2>
      <div class="preferences-grid">
        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Email Notifications</h3>
            <p class="preference-description">
              Receive email notifications for important account activities
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="notificationPrefs.email"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Trade Alerts</h3>
            <p class="preference-description">
              Get notified when your orders are filled or when limit orders are triggered
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="notificationPrefs.trades"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Deposit/Withdrawal Alerts</h3>
            <p class="preference-description">
              Receive notifications for all deposit and withdrawal activities
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="notificationPrefs.transactions"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Security Alerts</h3>
            <p class="preference-description">
              Get notified of security-related activities like password changes and 2FA updates
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="notificationPrefs.security"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Marketing Emails</h3>
            <p class="preference-description">
              Receive updates about new features, promotions, and platform news
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="notificationPrefs.marketing"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Display Preferences -->
    <div class="settings-section">
      <h2 class="section-title">Display Preferences</h2>
      <div class="settings-form">
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select v-model="displayPrefs.theme" @change="savePreferences" class="form-select">
            <option value="dark">Dark Mode</option>
            <option value="light">Light Mode</option>
            <option value="auto">Auto (System Default)</option>
          </select>
          <p class="form-hint">Choose your preferred color theme</p>
        </div>

        <div class="form-group">
          <label class="form-label">Language</label>
          <select v-model="displayPrefs.language" @change="savePreferences" class="form-select">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
          <p class="form-hint">Select your preferred language</p>
        </div>

        <div class="form-group">
          <label class="form-label">Timezone</label>
          <select v-model="displayPrefs.timezone" @change="savePreferences" class="form-select">
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Asia/Shanghai">Shanghai (CST)</option>
          </select>
          <p class="form-hint">Choose your timezone for displaying dates and times</p>
        </div>

        <div class="form-group">
          <label class="form-label">Currency Display</label>
          <select v-model="displayPrefs.currency" @change="savePreferences" class="form-select">
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="CNY">CNY (¥)</option>
          </select>
          <p class="form-hint">Choose your preferred fiat currency for display</p>
        </div>
      </div>
    </div>

    <!-- Privacy Settings -->
    <div class="settings-section">
      <h2 class="section-title">Privacy Settings</h2>
      <div class="preferences-grid">
        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Show Portfolio Balance</h3>
            <p class="preference-description">
              Display your total portfolio balance on the dashboard
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="privacyPrefs.showBalance"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Show Trade History</h3>
            <p class="preference-description">
              Make your trade history visible to other users (if enabled)
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="privacyPrefs.showTrades"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="preference-item">
          <div class="preference-info">
            <h3 class="preference-title">Analytics & Cookies</h3>
            <p class="preference-description">
              Allow us to collect anonymous usage data to improve the platform
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="privacyPrefs.analytics"
              type="checkbox"
              @change="savePreferences"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Session Management -->
    <div class="settings-section">
      <h2 class="section-title">Active Sessions</h2>
      <div class="session-list">
        <div class="session-item current">
          <div class="session-icon">💻</div>
          <div class="session-info">
            <h3 class="session-title">Current Session</h3>
            <p class="session-detail">{{ userAgent }}</p>
            <p class="session-detail text-gray-500 text-sm">{{ currentLocation }} • Active Now</p>
          </div>
          <span class="session-badge current">Current</span>
        </div>
      </div>
      <p class="text-sm text-gray-400 mt-4">
        You can sign out from all other devices by changing your password in the Security settings.
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { apiHelpers } from '@/services/api';
import BackButton from '@/components/BackButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// State
const isUpdatingProfile = ref(false);
const userProvider = ref('local');
const userPhone = ref('');
const userPhoneVerified = ref(false);
const originalPhone = ref('');
const showVerificationModal = ref(false);
const verificationCode = ref('');
const isVerifying = ref(false);
const isResending = ref(false);

const profileForm = ref({
  email: '',
  phone: '',
  first_name: '',
  last_name: ''
});

const hasPhoneChanged = computed(() => {
  return profileForm.value.phone !== originalPhone.value;
});

const notificationPrefs = ref({
  email: true,
  trades: true,
  transactions: true,
  security: true,
  marketing: false
});

const displayPrefs = ref({
  theme: 'dark',
  language: 'en',
  timezone: 'UTC',
  currency: 'USD'
});

const privacyPrefs = ref({
  showBalance: true,
  showTrades: false,
  analytics: true
});

// User agent and location
const userAgent = computed(() => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome on ' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : 'Linux');
  if (ua.includes('Firefox')) return 'Firefox on ' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : 'Linux');
  if (ua.includes('Safari')) return 'Safari on macOS';
  return 'Unknown Browser';
});

const currentLocation = computed(() => {
  return 'Unknown Location';
});

// Fetch user profile
const fetchProfile = async () => {
  try {
    const response = await apiHelpers.get('/api/auth/profile');
    if (response.success && response.user) {
      profileForm.value = {
        email: response.user.email || '',
        phone: response.user.phone || '',
        first_name: response.user.first_name || '',
        last_name: response.user.last_name || ''
      };
      userProvider.value = response.user.provider || 'local';
      userPhone.value = response.user.phone || '';
      userPhoneVerified.value = response.user.phone_verified || false;
      originalPhone.value = response.user.phone || '';
    }
  } catch (err) {
    console.error('Failed to fetch profile:', err);
  }
};

// Load preferences from localStorage
const loadPreferences = () => {
  const savedPrefs = localStorage.getItem('userPreferences');
  if (savedPrefs) {
    try {
      const prefs = JSON.parse(savedPrefs);
      if (prefs.notifications) notificationPrefs.value = { ...notificationPrefs.value, ...prefs.notifications };
      if (prefs.display) displayPrefs.value = { ...displayPrefs.value, ...prefs.display };
      if (prefs.privacy) privacyPrefs.value = { ...privacyPrefs.value, ...prefs.privacy };
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }
};

// Save preferences to localStorage
const savePreferences = () => {
  try {
    const prefs = {
      notifications: notificationPrefs.value,
      display: displayPrefs.value,
      privacy: privacyPrefs.value
    };
    localStorage.setItem('userPreferences', JSON.stringify(prefs));
    notificationStore.success('Saved', 'Your preferences have been updated');
  } catch (err) {
    console.error('Failed to save preferences:', err);
    notificationStore.error('Error', 'Failed to save preferences');
  }
};

// Update profile
const handleUpdateProfile = async () => {
  isUpdatingProfile.value = true;

  try {
    // Check if phone number has changed
    if (hasPhoneChanged.value && profileForm.value.phone) {
      // Use the add phone endpoint which will send verification SMS
      const response = await apiHelpers.post('/api/auth/phone/add', {
        phone: profileForm.value.phone
      });

      if (response.success) {
        notificationStore.success('Success', 'Verification code sent to your phone. Please verify it.');
        userPhone.value = profileForm.value.phone;
        userPhoneVerified.value = false;
        originalPhone.value = profileForm.value.phone;
        // Open verification modal
        showVerificationModal.value = true;
      } else {
        throw new Error(response.error || 'Failed to add phone number');
      }
    } else {
      notificationStore.info('Info', 'No changes to save');
    }
  } catch (err) {
    console.error('Update profile error:', err);
    notificationStore.error('Error', err.message || 'Failed to update profile');
  } finally {
    isUpdatingProfile.value = false;
  }
};

// Phone verification modal functions
const openVerificationModal = () => {
  verificationCode.value = '';
  showVerificationModal.value = true;
};

const closeVerificationModal = () => {
  showVerificationModal.value = false;
  verificationCode.value = '';
};

const verifyPhone = async () => {
  if (verificationCode.value.length !== 6) {
    notificationStore.error('Error', 'Please enter a 6-digit code');
    return;
  }

  isVerifying.value = true;

  try {
    const response = await apiHelpers.post('/api/auth/verify/phone', {
      code: verificationCode.value
    });

    if (response.success) {
      notificationStore.success('Success', 'Phone number verified successfully');
      userPhoneVerified.value = true;
      closeVerificationModal();
      // Refresh profile
      await fetchProfile();
    } else {
      throw new Error(response.error || 'Failed to verify phone');
    }
  } catch (err) {
    console.error('Verify phone error:', err);
    notificationStore.error('Error', err.message || 'Failed to verify phone');
  } finally {
    isVerifying.value = false;
  }
};

const resendCode = async () => {
  isResending.value = true;

  try {
    const response = await apiHelpers.post('/api/auth/verify/resend', {
      type: 'phone_verification'
    });

    if (response.success) {
      notificationStore.success('Success', 'Verification code resent');
      verificationCode.value = '';
    } else {
      throw new Error(response.error || 'Failed to resend code');
    }
  } catch (err) {
    console.error('Resend code error:', err);
    notificationStore.error('Error', err.message || 'Failed to resend code');
  } finally {
    isResending.value = false;
  }
};

// Load data on mount
onMounted(() => {
  fetchProfile();
  loadPreferences();
});
</script>

<style scoped>
.settings-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.settings-section {
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

.settings-form {
  max-width: 600px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

.form-input,
.form-select {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: white;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.preferences-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preference-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.preference-info {
  flex: 1;
}

.preference-title {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.preference-description {
  font-size: 0.875rem;
  color: #a0aec0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #2d3748;
  border-radius: 28px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: #48bb78;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.session-item.current {
  border-color: #4299e1;
}

.session-icon {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(66, 153, 225, 0.1);
  border-radius: 8px;
}

.session-info {
  flex: 1;
}

.session-title {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.session-detail {
  font-size: 0.875rem;
  color: #a0aec0;
}

.session-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.session-badge.current {
  background: rgba(66, 153, 225, 0.2);
  color: #4299e1;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(72, 187, 120, 0.1);
  border: 1px solid rgba(72, 187, 120, 0.3);
  border-radius: 9999px;
  color: #48bb78;
  font-size: 0.875rem;
  font-weight: 600;
}

.phone-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.phone-input-group .form-input {
  flex: 1;
}

.verify-btn {
  padding: 0.75rem 1.5rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.verify-btn:hover {
  background: #3182ce;
  transform: translateY(-1px);
}

/* Modal styles */
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

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #2d3748;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
}

.modal-close {
  background: none;
  border: none;
  color: #a0aec0;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.modal-close:hover {
  color: white;
}

.modal-body {
  padding: 1.5rem;
}

.modal-description {
  color: #a0aec0;
  margin-bottom: 1.5rem;
  text-align: center;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.modal-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn.primary {
  background: linear-gradient(135deg, #4299e1 0%, #48bb78 100%);
  color: white;
}

.modal-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.modal-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-btn.secondary {
  background: #2d3748;
  color: #e2e8f0;
}

.modal-btn.secondary:hover:not(:disabled) {
  background: #4a5568;
}

.modal-btn.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .settings-page {
    padding: 1rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .preference-item {
    flex-direction: column;
    text-align: center;
  }

  .session-item {
    flex-direction: column;
    text-align: center;
  }

  .provider-badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
  }
}
</style>
