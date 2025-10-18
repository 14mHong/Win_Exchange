<template>
  <div class="account-page">
    <BackButton class="mb-4" />
    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">Account Overview</h1>
      <p class="text-gray-400">Manage your account and view your profile summary</p>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions-grid">
      <router-link to="/security" class="action-card security">
        <div class="action-icon">🔒</div>
        <div class="action-content">
          <h3 class="action-title">Security Settings</h3>
          <p class="action-description">
            Manage passwords, 2FA, and security preferences
          </p>
        </div>
        <div class="action-arrow">→</div>
      </router-link>

      <router-link to="/settings" class="action-card settings">
        <div class="action-icon">⚙️</div>
        <div class="action-content">
          <h3 class="action-title">Account Settings</h3>
          <p class="action-description">
            Update profile, preferences, and notifications
          </p>
        </div>
        <div class="action-arrow">→</div>
      </router-link>
    </div>

    <!-- Account Summary -->
    <div class="account-summary">
      <h2 class="section-title">Account Information</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-icon">👤</div>
          <div class="summary-content">
            <p class="summary-label">Full Name</p>
            <p class="summary-value">
              {{ user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : 'Not set'
              }}
            </p>
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-icon">📧</div>
          <div class="summary-content">
            <p class="summary-label">Email Address</p>
            <p class="summary-value">{{ user?.email || 'Not set' }}</p>
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-icon">📱</div>
          <div class="summary-content">
            <p class="summary-label">Phone Number</p>
            <p class="summary-value">{{ user?.phone || 'Not set' }}</p>
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-icon">🔐</div>
          <div class="summary-content">
            <p class="summary-label">Two-Factor Authentication</p>
            <p class="summary-value" :class="user?.two_fa_enabled ? 'text-green-400' : 'text-red-400'">
              {{ user?.two_fa_enabled ? 'Enabled' : 'Disabled' }}
            </p>
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-icon">📅</div>
          <div class="summary-content">
            <p class="summary-label">Member Since</p>
            <p class="summary-value">{{ formatDate(user?.created_at) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Verification Status -->
    <div class="verification-section">
      <h2 class="section-title">Verification Status</h2>
      <div class="verification-grid">
        <div class="verification-item" :class="user?.email_verified ? 'verified' : 'pending'">
          <div class="verification-icon">
            {{ user?.email_verified ? '✓' : '⏳' }}
          </div>
          <div class="verification-content">
            <h3 class="verification-title">Email Verification</h3>
            <p class="verification-status">
              {{ user?.email_verified ? 'Verified' : 'Pending Verification' }}
            </p>
          </div>
        </div>

        <div class="verification-item" :class="getPhoneVerificationClass()">
          <div class="verification-icon">
            {{ getPhoneVerificationIcon() }}
          </div>
          <div class="verification-content">
            <h3 class="verification-title">Phone Verification</h3>
            <p class="verification-status">
              {{ getPhoneVerificationStatus() }}
            </p>
          </div>
        </div>

        <div class="verification-item" :class="user?.two_fa_enabled ? 'verified' : 'pending'">
          <div class="verification-icon">
            {{ user?.two_fa_enabled ? '✓' : '○' }}
          </div>
          <div class="verification-content">
            <h3 class="verification-title">Two-Factor Authentication</h3>
            <p class="verification-status">
              {{ user?.two_fa_enabled ? 'Enabled' : 'Not Enabled' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNotificationStore } from '@/stores/notification';
import { apiHelpers } from '@/services/api';
import BackButton from '@/components/BackButton.vue';

const notificationStore = useNotificationStore();

// State
const user = ref(null);

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

// Format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Phone verification helpers
const getPhoneVerificationClass = () => {
  if (!user.value?.phone) return 'not-set';
  return user.value.phone_verified ? 'verified' : 'pending';
};

const getPhoneVerificationIcon = () => {
  if (!user.value?.phone) return '○';
  return user.value.phone_verified ? '✓' : '⏳';
};

const getPhoneVerificationStatus = () => {
  if (!user.value?.phone) return 'Not Set';
  return user.value.phone_verified ? 'Verified' : 'Pending Verification';
};

// Load profile on mount
onMounted(() => {
  fetchProfile();
});
</script>

<style scoped>
.account-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.action-card {
  background: #1a1d29;
  border: 2px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  text-decoration: none;
  transition: all 0.3s;
}

.action-card:hover {
  border-color: #4299e1;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(66, 153, 225, 0.2);
}

.action-card.security:hover {
  border-color: #48bb78;
  box-shadow: 0 8px 24px rgba(72, 187, 120, 0.2);
}

.action-icon {
  font-size: 3rem;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(66, 153, 225, 0.1);
  border-radius: 12px;
  flex-shrink: 0;
}

.action-card.security .action-icon {
  background: rgba(72, 187, 120, 0.1);
}

.action-content {
  flex: 1;
}

.action-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.action-description {
  font-size: 0.875rem;
  color: #a0aec0;
}

.action-arrow {
  font-size: 2rem;
  color: #4299e1;
  font-weight: 300;
}

.action-card.security .action-arrow {
  color: #48bb78;
}

.account-summary {
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.summary-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-icon {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(66, 153, 225, 0.1);
  border-radius: 8px;
  flex-shrink: 0;
}

.summary-content {
  flex: 1;
}

.summary-label {
  font-size: 0.75rem;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1rem;
  font-weight: 600;
  color: white;
}

.verification-section {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
}

.verification-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.verification-item {
  background: #0f1117;
  border: 2px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s;
}

.verification-item.verified {
  border-color: #48bb78;
  background: rgba(72, 187, 120, 0.05);
}

.verification-item.pending {
  border-color: #f6ad55;
  background: rgba(246, 173, 85, 0.05);
}

.verification-item.not-set {
  border-color: #718096;
  background: rgba(113, 128, 150, 0.05);
}

.verification-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
}

.verification-item.verified .verification-icon {
  background: rgba(72, 187, 120, 0.2);
  color: #48bb78;
}

.verification-item.pending .verification-icon {
  background: rgba(246, 173, 85, 0.2);
  color: #f6ad55;
}

.verification-item.not-set .verification-icon {
  background: rgba(113, 128, 150, 0.2);
  color: #718096;
}

.verification-content {
  flex: 1;
}

.verification-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.verification-status {
  font-size: 0.75rem;
  color: #a0aec0;
}

.verification-item.verified .verification-status {
  color: #48bb78;
}

.verification-item.pending .verification-status {
  color: #f6ad55;
}

@media (max-width: 768px) {
  .account-page {
    padding: 1rem;
  }

  .quick-actions-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .verification-grid {
    grid-template-columns: 1fr;
  }
}
</style>
