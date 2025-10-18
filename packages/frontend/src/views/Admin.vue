<template>
  <div class="admin-page">
    <BackButton class="mb-4" />

    <div class="page-header">
      <h1 class="text-3xl font-bold text-white mb-2">🔐 Admin Dashboard</h1>
      <p class="text-gray-400">Platform management and user oversight</p>
    </div>

    <!-- Platform Statistics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <p class="stat-label">Total Users</p>
          <p class="stat-value">{{ stats.users?.total_users || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">✓</div>
        <div class="stat-content">
          <p class="stat-label">Verified Users</p>
          <p class="stat-value">{{ stats.users?.verified_users || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🆕</div>
        <div class="stat-content">
          <p class="stat-label">New Users (30d)</p>
          <p class="stat-value">{{ stats.users?.new_users_30d || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🔒</div>
        <div class="stat-content">
          <p class="stat-label">2FA Enabled</p>
          <p class="stat-value">{{ stats.users?.two_fa_enabled || 0 }}</p>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="content-section">
      <div class="section-header">
        <h2 class="section-title">All Users</h2>
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users..."
            class="search-input"
          />
        </div>
      </div>

      <div class="table-container">
        <table class="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Wallets</th>
              <th>Total Balance</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>
                <div class="user-cell">
                  <div class="user-avatar">{{ getInitials(user) }}</div>
                  <div>
                    <div class="user-name">
                      {{ user.first_name }} {{ user.last_name }}
                      <span v-if="user.is_admin" class="admin-badge">Admin</span>
                    </div>
                    <div class="user-id">{{ user.id.slice(0, 8) }}...</div>
                  </div>
                </div>
              </td>
              <td>{{ user.email }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(user)">
                  {{ getStatusText(user) }}
                </span>
              </td>
              <td>{{ user.wallets?.length || 0 }}</td>
              <td>
                <div class="balance-list">
                  <div v-for="wallet in user.wallets?.slice(0, 3)" :key="wallet.currency" class="balance-item">
                    {{ wallet.balance }} {{ wallet.currency }}
                  </div>
                  <div v-if="user.wallets?.length > 3" class="text-sm text-gray-500">
                    +{{ user.wallets.length - 3 }} more
                  </div>
                </div>
              </td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    @click="viewUserDetails(user)"
                    class="action-btn view"
                    title="View Details"
                  >
                    👁️
                  </button>
                  <button
                    @click="showPrivateKeyModal(user)"
                    class="action-btn danger"
                    title="Retrieve Private Keys"
                  >
                    🔑
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading users...</p>
        </div>

        <div v-if="!loading && filteredUsers.length === 0" class="empty-state">
          <p>No users found</p>
        </div>
      </div>
    </div>

    <!-- Private Key Confirmation Modal -->
    <div v-if="showKeyModal" class="modal-overlay" @click="closeKeyModal">
      <div class="modal-content danger-modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">⚠️ Retrieve Private Keys</h3>
          <button @click="closeKeyModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="warning-box">
            <p class="warning-title">CRITICAL SECURITY WARNING</p>
            <p class="warning-text">
              You are about to retrieve private keys for user:
              <strong>{{ selectedUser?.email }}</strong>
            </p>
            <p class="warning-text">
              This action is heavily logged and should only be performed in emergency situations
              where access to user funds is necessary for platform operations or recovery.
            </p>
          </div>

          <div v-if="privateKeys.length > 0" class="keys-container">
            <div v-for="key in privateKeys" :key="key.address" class="key-card">
              <div class="key-header">
                <span class="key-currency">{{ key.currency }}</span>
              </div>
              <div class="key-field">
                <label>Address:</label>
                <div class="key-value">{{ key.address }}</div>
              </div>
              <div class="key-field">
                <label>Derivation Path:</label>
                <div class="key-value">{{ key.derivation_path }}</div>
              </div>
              <div class="key-field">
                <label>Private Key:</label>
                <div class="key-value private-key">
                  {{ showPrivateKey ? key.private_key : '•'.repeat(64) }}
                  <button @click="copyToClipboard(key.private_key)" class="copy-btn">
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button
              v-if="privateKeys.length === 0"
              @click="retrievePrivateKeys"
              :disabled="loadingKeys"
              class="modal-btn danger"
            >
              <span v-if="!loadingKeys">I Understand - Retrieve Keys</span>
              <span v-else class="flex items-center justify-center gap-2">
                <div class="spinner-small"></div>
                Retrieving...
              </span>
            </button>
            <button
              v-if="privateKeys.length > 0"
              @click="showPrivateKey = !showPrivateKey"
              class="modal-btn secondary"
            >
              {{ showPrivateKey ? 'Hide' : 'Show' }} Private Keys
            </button>
            <button @click="closeKeyModal" class="modal-btn secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Details Modal -->
    <div v-if="showDetailsModal" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content large-modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">User Details</h3>
          <button @click="closeDetailsModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div v-if="userDetails" class="details-grid">
            <div class="detail-section">
              <h4 class="detail-section-title">Account Information</h4>
              <div class="detail-item">
                <span class="detail-label">Email:</span>
                <span class="detail-value">{{ userDetails.email }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">{{ userDetails.phone || 'Not set' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Provider:</span>
                <span class="detail-value">{{ userDetails.provider }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">2FA:</span>
                <span class="detail-value" :class="userDetails.two_fa_enabled ? 'text-green-400' : 'text-red-400'">
                  {{ userDetails.two_fa_enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
            </div>

            <div class="detail-section">
              <h4 class="detail-section-title">Wallets</h4>
              <div v-for="wallet in userDetails.wallets" :key="wallet.currency" class="wallet-detail">
                <span class="wallet-currency">{{ wallet.currency }}</span>
                <span class="wallet-balance">{{ wallet.balance }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h4 class="detail-section-title">Deposit Addresses</h4>
              <div v-for="addr in userDetails.deposit_addresses" :key="addr.address" class="address-detail">
                <span class="address-currency">{{ addr.currency }}</span>
                <span class="address-value">{{ addr.address }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { apiHelpers } from '@/services/api';
import BackButton from '@/components/BackButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// State
const loading = ref(false);
const loadingKeys = ref(false);
const users = ref([]);
const stats = ref({});
const searchQuery = ref('');
const showKeyModal = ref(false);
const showDetailsModal = ref(false);
const selectedUser = ref(null);
const userDetails = ref(null);
const privateKeys = ref([]);
const showPrivateKey = ref(false);

// Computed
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value;

  const query = searchQuery.value.toLowerCase();
  return users.value.filter(user =>
    user.email.toLowerCase().includes(query) ||
    user.first_name?.toLowerCase().includes(query) ||
    user.last_name?.toLowerCase().includes(query) ||
    user.id.toLowerCase().includes(query)
  );
});

// Methods
const fetchStats = async () => {
  try {
    const response = await apiHelpers.get('/api/admin/stats');
    if (response.success) {
      stats.value = response.stats;
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    notificationStore.error('Error', 'Failed to load platform statistics');
  }
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const response = await apiHelpers.get('/api/admin/users');
    if (response.success) {
      users.value = response.users;
    }
  } catch (err) {
    console.error('Failed to fetch users:', err);
    notificationStore.error('Error', err.message || 'Failed to load users');
  } finally {
    loading.value = false;
  }
};

const viewUserDetails = async (user) => {
  try {
    const response = await apiHelpers.get(`/api/admin/users/${user.id}`);
    if (response.success) {
      userDetails.value = response.user;
      showDetailsModal.value = true;
    }
  } catch (err) {
    console.error('Failed to fetch user details:', err);
    notificationStore.error('Error', 'Failed to load user details');
  }
};

const showPrivateKeyModal = (user) => {
  selectedUser.value = user;
  privateKeys.value = [];
  showPrivateKey.value = false;
  showKeyModal.value = true;
};

const retrievePrivateKeys = async () => {
  loadingKeys.value = true;
  try {
    const response = await apiHelpers.get(`/api/admin/users/${selectedUser.value.id}/private-keys`);
    if (response.success) {
      privateKeys.value = response.private_keys;
      notificationStore.warning(
        'Private Keys Retrieved',
        'This action has been logged for security purposes'
      );
    }
  } catch (err) {
    console.error('Failed to retrieve private keys:', err);
    notificationStore.error('Error', err.message || 'Failed to retrieve private keys');
  } finally {
    loadingKeys.value = false;
  }
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    notificationStore.success('Copied', 'Private key copied to clipboard');
  } catch (err) {
    notificationStore.error('Error', 'Failed to copy to clipboard');
  }
};

const closeKeyModal = () => {
  showKeyModal.value = false;
  selectedUser.value = null;
  privateKeys.value = [];
  showPrivateKey.value = false;
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  userDetails.value = null;
};

const getInitials = (user) => {
  const first = user.first_name?.[0] || '';
  const last = user.last_name?.[0] || '';
  return (first + last).toUpperCase() || '?';
};

const getStatusClass = (user) => {
  if (!user.is_active) return 'inactive';
  if (user.email_verified && user.two_fa_enabled) return 'verified';
  return 'active';
};

const getStatusText = (user) => {
  if (!user.is_active) return 'Inactive';
  if (user.email_verified && user.two_fa_enabled) return 'Verified';
  return 'Active';
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

// Check if user is admin
const checkAdminAccess = () => {
  // This should be checked on the backend, but we can also check on frontend
  // The backend will ultimately enforce this
  if (!authStore.user?.is_admin) {
    notificationStore.error('Access Denied', 'Admin privileges required');
    router.push('/dashboard');
  }
};

onMounted(() => {
  checkAdminAccess();
  fetchStats();
  fetchUsers();
});
</script>

<style scoped>
.admin-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(66, 153, 225, 0.1);
  border-radius: 12px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: #a0aec0;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: white;
}

.content-section {
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.search-box {
  flex: 0 0 300px;
}

.search-input {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: white;
  font-size: 0.875rem;
}

.search-input:focus {
  outline: none;
  border-color: #4299e1;
}

.table-container {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table thead {
  background: #0f1117;
}

.users-table th {
  text-align: left;
  padding: 1rem;
  color: #a0aec0;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.users-table td {
  padding: 1rem;
  border-top: 1px solid #2d3748;
  color: #e2e8f0;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4299e1 0%, #48bb78 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: white;
}

.user-name {
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-id {
  font-size: 0.75rem;
  color: #718096;
}

.admin-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(246, 173, 85, 0.2);
  border: 1px solid rgba(246, 173, 85, 0.3);
  border-radius: 4px;
  color: #f6ad55;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.verified {
  background: rgba(72, 187, 120, 0.2);
  color: #48bb78;
}

.status-badge.active {
  background: rgba(66, 153, 225, 0.2);
  color: #4299e1;
}

.status-badge.inactive {
  background: rgba(203, 64, 64, 0.2);
  color: #cb4040;
}

.balance-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.balance-item {
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s;
}

.action-btn.view {
  background: rgba(66, 153, 225, 0.2);
}

.action-btn.view:hover {
  background: rgba(66, 153, 225, 0.3);
}

.action-btn.danger {
  background: rgba(203, 64, 64, 0.2);
}

.action-btn.danger:hover {
  background: rgba(203, 64, 64, 0.3);
}

.loading-state,
.empty-state {
  padding: 3rem;
  text-align: center;
  color: #a0aec0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(66, 153, 225, 0.2);
  border-top-color: #4299e1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
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
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.large-modal {
  max-width: 900px;
}

.modal-content.danger-modal {
  border-color: rgba(203, 64, 64, 0.5);
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
}

.modal-close:hover {
  color: white;
}

.modal-body {
  padding: 1.5rem;
}

.warning-box {
  background: rgba(203, 64, 64, 0.1);
  border: 2px solid rgba(203, 64, 64, 0.3);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.warning-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #cb4040;
  margin-bottom: 0.75rem;
}

.warning-text {
  color: #e2e8f0;
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.keys-container {
  margin-bottom: 1.5rem;
}

.key-card {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.key-header {
  margin-bottom: 1rem;
}

.key-currency {
  padding: 0.375rem 0.75rem;
  background: rgba(66, 153, 225, 0.2);
  border-radius: 4px;
  color: #4299e1;
  font-weight: 700;
}

.key-field {
  margin-bottom: 0.75rem;
}

.key-field label {
  display: block;
  font-size: 0.75rem;
  color: #a0aec0;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.key-value {
  background: #000;
  border: 1px solid #2d3748;
  border-radius: 4px;
  padding: 0.75rem;
  color: #48bb78;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.key-value.private-key {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.copy-btn {
  padding: 0.375rem 0.75rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: #3182ce;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn.danger {
  background: #cb4040;
  color: white;
}

.modal-btn.danger:hover:not(:disabled) {
  background: #a02f2f;
}

.modal-btn.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-btn.secondary {
  background: #2d3748;
  color: #e2e8f0;
}

.modal-btn.secondary:hover {
  background: #4a5568;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.details-grid {
  display: grid;
  gap: 1.5rem;
}

.detail-section {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1.5rem;
}

.detail-section-title {
  font-size: 1rem;
  font-weight: 700;
  color: white;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #2d3748;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  color: #a0aec0;
  font-size: 0.875rem;
}

.detail-value {
  color: white;
  font-weight: 600;
}

.wallet-detail,
.address-detail {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: rgba(66, 153, 225, 0.05);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.wallet-currency,
.address-currency {
  font-weight: 700;
  color: #4299e1;
}

.wallet-balance {
  color: white;
  font-family: 'Courier New', monospace;
}

.address-value {
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .admin-page {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    gap: 1rem;
  }

  .search-box {
    flex: 1;
    width: 100%;
  }

  .table-container {
    overflow-x: scroll;
  }

  .modal-content {
    max-width: 100%;
  }
}
</style>
