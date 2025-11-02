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

    <!-- Invite Codes Section -->
    <div class="content-section mb-6">
      <div class="section-header">
        <h2 class="section-title">🎫 Invite Codes</h2>
        <button @click="showGenerateModal = true" class="generate-btn">
          + Generate Codes
        </button>
      </div>

      <div class="invite-stats-grid">
        <div class="invite-stat-card">
          <div class="invite-stat-label">Total Codes</div>
          <div class="invite-stat-value">{{ inviteStats.total_codes || 0 }}</div>
        </div>
        <div class="invite-stat-card">
          <div class="invite-stat-label">Active Codes</div>
          <div class="invite-stat-value text-green-400">{{ inviteStats.active_codes || 0 }}</div>
        </div>
        <div class="invite-stat-card">
          <div class="invite-stat-label">Used Codes</div>
          <div class="invite-stat-value text-green-400">{{ inviteStats.used_codes || 0 }}</div>
        </div>
        <div class="invite-stat-card">
          <div class="invite-stat-label">Expired Codes</div>
          <div class="invite-stat-value text-red-400">{{ inviteStats.expired_codes || 0 }}</div>
        </div>
      </div>

      <div class="table-container mt-4">
        <table class="users-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Uses</th>
              <th>Created By</th>
              <th>Created At</th>
              <th>Used By</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="code in inviteCodes" :key="code.id">
              <td>
                <div class="code-value">{{ code.code }}</div>
              </td>
              <td>
                <span class="status-badge" :class="code.is_active ? 'verified' : 'inactive'">
                  {{ code.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>{{ code.current_uses }} / {{ code.max_uses }}</td>
              <td>{{ code.created_by_email || 'System' }}</td>
              <td>{{ formatDate(code.created_at) }}</td>
              <td>{{ code.used_by_email || '-' }}</td>
              <td class="text-sm text-gray-400">{{ code.notes || '-' }}</td>
              <td>
                <button
                  v-if="code.is_active"
                  @click="deactivateCode(code.code)"
                  class="action-btn danger"
                  title="Deactivate"
                >
                  ❌
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="loadingCodes" class="loading-state">
          <div class="spinner"></div>
          <p>Loading invite codes...</p>
        </div>

        <div v-if="!loadingCodes && inviteCodes.length === 0" class="empty-state">
          <p>No invite codes generated yet</p>
        </div>
      </div>
    </div>

    <!-- WIN Token Management -->
    <div class="content-section mb-6">
      <div class="section-header">
        <h2 class="section-title">🪙 WIN Token Management</h2>
        <button @click="refreshWinToken" class="generate-btn" :disabled="loadingWinToken">
          🔄 Refresh
        </button>
      </div>

      <div v-if="loadingWinToken" class="loading-state">
        <div class="spinner"></div>
        <p>Loading WIN token data...</p>
      </div>

      <div v-else-if="winTokenConfig" class="win-token-section">
        <!-- Current Price Display -->
        <div class="win-price-display">
          <div class="price-label">Current Price</div>
          <div class="price-value">${{ parseFloat(winTokenConfig.current_price).toFixed(8) }}</div>
          <div class="price-info">
            Base: ${{ parseFloat(winTokenConfig.base_price).toFixed(8) }} |
            Min: ${{ parseFloat(winTokenConfig.min_price).toFixed(8) }} |
            Max: {{ winTokenConfig.max_price ? '$' + parseFloat(winTokenConfig.max_price).toFixed(8) : 'Unlimited' }}
          </div>
        </div>

        <!-- WIN Token Stats Grid -->
        <div class="invite-stats-grid mt-4">
          <div class="invite-stat-card">
            <div class="invite-stat-label">Volatility</div>
            <div class="invite-stat-value">{{ (parseFloat(winTokenConfig.volatility) * 100).toFixed(1) }}%</div>
          </div>
          <div class="invite-stat-card">
            <div class="invite-stat-label">Trend Strength</div>
            <div class="invite-stat-value">{{ (parseFloat(winTokenConfig.trend_strength) * 100).toFixed(1) }}%</div>
          </div>
          <div class="invite-stat-card">
            <div class="invite-stat-label">Simulation</div>
            <div class="invite-stat-value" :class="winTokenConfig.simulation_enabled ? 'text-green-400' : 'text-red-400'">
              {{ winTokenConfig.simulation_enabled ? 'Enabled' : 'Disabled' }}
            </div>
          </div>
          <div class="invite-stat-card">
            <div class="invite-stat-label">Market Cap</div>
            <div class="invite-stat-value">${{ formatLargeNumber(parseFloat(winTokenConfig.market_cap)) }}</div>
          </div>
        </div>

        <!-- Update Price Form -->
        <div class="win-price-form mt-4">
          <h3 class="text-lg font-semibold text-white mb-3">Update Price</h3>
          <div class="form-row">
            <input
              v-model="newWinPrice"
              type="number"
              step="0.00000001"
              placeholder="Enter new price (e.g., 0.0001)"
              class="price-input"
            />
            <input
              v-model="priceUpdateReason"
              type="text"
              placeholder="Reason for price update (optional)"
              class="reason-input"
            />
            <button @click="updateWinPrice" class="update-btn" :disabled="updatingPrice || !newWinPrice">
              {{ updatingPrice ? 'Updating...' : 'Update Price' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Blockchain Monitor Status -->
    <div class="content-section mb-6">
      <div class="section-header">
        <h2 class="section-title">⛓️ Blockchain Monitor Status</h2>
        <button @click="refreshMonitorStatus" class="generate-btn" :disabled="loadingMonitorStatus">
          🔄 Refresh
        </button>
      </div>

      <div v-if="loadingMonitorStatus" class="loading-state">
        <div class="spinner"></div>
        <p>Loading monitor status...</p>
      </div>

      <div v-else-if="monitorStatus" class="win-token-section">
        <!-- Monitoring Status -->
        <div class="monitor-header mb-6">
          <div class="monitor-status-badge" :class="monitorStatus.is_monitoring ? 'status-active' : 'status-inactive'">
            {{ monitorStatus.is_monitoring ? '✓ Monitoring Active' : '✗ Monitoring Inactive' }}
          </div>
        </div>

        <!-- Ethereum Config -->
        <div v-if="monitorStatus.ethereum" class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-3">Ethereum Configuration</h3>
          <div class="config-grid">
            <div class="config-item">
              <span class="config-label">Provider Configured:</span>
              <span class="config-value" :class="monitorStatus.ethereum.provider_configured ? 'text-green-400' : 'text-red-400'">
                {{ monitorStatus.ethereum.provider_configured ? 'Yes' : 'No' }}
              </span>
            </div>
            <div class="config-item">
              <span class="config-label">Network Type:</span>
              <span class="config-value">{{ monitorStatus.ethereum.is_testnet ? 'Testnet (Sepolia)' : 'Mainnet' }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">Network String:</span>
              <span class="config-value">{{ monitorStatus.ethereum.network_string }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">Current Block:</span>
              <span class="config-value">{{ monitorStatus.ethereum.current_block || 'N/A' }}</span>
            </div>
            <div class="config-item config-item-full">
              <span class="config-label">RPC URL:</span>
              <span class="config-value text-sm">{{ monitorStatus.ethereum.rpc_url }}</span>
            </div>
          </div>
        </div>

        <!-- Deposit Addresses -->
        <div v-if="monitorStatus.deposit_addresses">
          <h3 class="text-lg font-semibold text-white mb-3">Deposit Addresses</h3>
          <div class="address-grid">
            <div v-for="(data, currency) in monitorStatus.deposit_addresses" :key="currency" class="address-card">
              <div class="address-currency">{{ currency }}</div>
              <div v-if="data.error" class="address-error">Error: {{ data.error }}</div>
              <div v-else>
                <div class="address-count">{{ data.count }} address(es)</div>
                <div v-if="data.sample" class="address-sample">{{ data.sample.substring(0, 10) }}...{{ data.sample.substring(data.sample.length - 8) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="error-state">
        <p>Failed to load blockchain monitor status</p>
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
                  <button
                    @click="confirmDeleteUser(user)"
                    class="action-btn delete"
                    title="Delete User"
                  >
                    🗑️
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

    <!-- Delete User Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="closeDeleteModal">
      <div class="modal-content danger-modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">⚠️ Delete User</h3>
          <button @click="closeDeleteModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="warning-box">
            <p class="warning-title">CRITICAL WARNING</p>
            <p class="warning-text">
              You are about to permanently delete user:
              <strong>{{ userToDelete?.email }}</strong>
            </p>
            <p class="warning-text">
              This will permanently delete ALL associated data:
            </p>
            <ul class="warning-list">
              <li>User account and profile</li>
              <li>All wallet balances</li>
              <li>All transaction history</li>
              <li>All deposit addresses</li>
              <li>All orders and trades</li>
              <li>All UTXOs</li>
              <li>All sessions and API keys</li>
            </ul>
            <p class="warning-text text-red-400 font-bold mt-4">
              THIS ACTION CANNOT BE UNDONE!
            </p>
          </div>

          <div v-if="userToDelete?.is_admin" class="form-group">
            <label>Admin User - Type email to confirm:</label>
            <input
              v-model="deleteConfirmation"
              type="text"
              :placeholder="userToDelete.email"
              class="form-input"
            />
          </div>

          <div class="modal-actions">
            <button
              @click="deleteUser"
              :disabled="loadingDelete || (userToDelete?.is_admin && deleteConfirmation !== userToDelete.email)"
              class="modal-btn danger"
            >
              <span v-if="!loadingDelete">Permanently Delete User</span>
              <span v-else class="flex items-center justify-center gap-2">
                <div class="spinner-small"></div>
                Deleting...
              </span>
            </button>
            <button @click="closeDeleteModal" class="modal-btn secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Generate Invite Codes Modal -->
    <div v-if="showGenerateModal" class="modal-overlay" @click="closeGenerateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Generate Invite Codes</h3>
          <button @click="closeGenerateModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="generateCodes">
            <div class="form-group">
              <label>Number of Codes</label>
              <input
                v-model.number="generateForm.count"
                type="number"
                min="1"
                max="100"
                class="form-input"
                required
              />
              <p class="form-hint">Generate 1-100 codes at once</p>
            </div>

            <div class="form-group">
              <label>Notes (Optional)</label>
              <textarea
                v-model="generateForm.notes"
                class="form-input"
                rows="3"
                placeholder="e.g., Testing codes for QA team"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Max Uses per Code</label>
              <input
                v-model.number="generateForm.maxUses"
                type="number"
                min="1"
                max="1000"
                class="form-input"
                required
              />
              <p class="form-hint">How many times each code can be used</p>
            </div>

            <div v-if="generatedCodes.length > 0" class="generated-codes-box">
              <div class="generated-header">
                <h4>✅ Generated {{ generatedCodes.length }} Codes</h4>
                <button type="button" @click="copyAllCodes" class="copy-all-btn">
                  📋 Copy All
                </button>
              </div>
              <div class="codes-list">
                <div v-for="code in generatedCodes" :key="code.code" class="generated-code-item">
                  {{ code.code }}
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button
                type="submit"
                :disabled="loadingGenerate"
                class="modal-btn danger"
              >
                <span v-if="!loadingGenerate">Generate Codes</span>
                <span v-else class="flex items-center justify-center gap-2">
                  <div class="spinner-small"></div>
                  Generating...
                </span>
              </button>
              <button type="button" @click="closeGenerateModal" class="modal-btn secondary">
                Close
              </button>
            </div>
          </form>
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
const loadingCodes = ref(false);
const loadingGenerate = ref(false);
const loadingDelete = ref(false);
const users = ref([]);
const stats = ref({});
const searchQuery = ref('');
const showKeyModal = ref(false);
const showDetailsModal = ref(false);
const showGenerateModal = ref(false);
const showDeleteModal = ref(false);
const selectedUser = ref(null);
const userDetails = ref(null);
const privateKeys = ref([]);
const showPrivateKey = ref(false);
const inviteCodes = ref([]);
const inviteStats = ref({});
const generatedCodes = ref([]);
const userToDelete = ref(null);
const deleteConfirmation = ref('');
const generateForm = ref({
  count: 10,
  notes: '',
  maxUses: 1
});
const winTokenConfig = ref(null);
const loadingWinToken = ref(false);
const newWinPrice = ref('');
const priceUpdateReason = ref('');
const updatingPrice = ref(false);

// Blockchain Monitor Status
const monitorStatus = ref(null);
const loadingMonitorStatus = ref(false);

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

// Invite Code Methods
const fetchInviteCodes = async () => {
  loadingCodes.value = true;
  try {
    const response = await apiHelpers.get('/api/admin/invite-codes?limit=50');
    if (response.success) {
      inviteCodes.value = response.codes;
      inviteStats.value = response.stats;
    }
  } catch (err) {
    console.error('Failed to fetch invite codes:', err);
    notificationStore.error('Error', err.message || 'Failed to load invite codes');
  } finally {
    loadingCodes.value = false;
  }
};

const generateCodes = async () => {
  loadingGenerate.value = true;
  try {
    const response = await apiHelpers.post('/api/admin/invite-codes/generate', generateForm.value);
    if (response.success) {
      generatedCodes.value = response.codes;
      notificationStore.success('Success', response.message);
      await fetchInviteCodes(); // Refresh the list
    }
  } catch (err) {
    console.error('Failed to generate codes:', err);
    notificationStore.error('Error', err.message || 'Failed to generate invite codes');
  } finally {
    loadingGenerate.value = false;
  }
};

const deactivateCode = async (code) => {
  if (!confirm(`Are you sure you want to deactivate code: ${code}?`)) {
    return;
  }

  try {
    const response = await apiHelpers.post(`/api/admin/invite-codes/${code}/deactivate`);
    if (response.success) {
      notificationStore.success('Success', 'Code deactivated successfully');
      await fetchInviteCodes(); // Refresh the list
    }
  } catch (err) {
    console.error('Failed to deactivate code:', err);
    notificationStore.error('Error', err.message || 'Failed to deactivate code');
  }
};

const copyAllCodes = async () => {
  const codesList = generatedCodes.value.map(c => c.code).join('\n');
  try {
    await navigator.clipboard.writeText(codesList);
    notificationStore.success('Copied', 'All codes copied to clipboard');
  } catch (err) {
    notificationStore.error('Error', 'Failed to copy to clipboard');
  }
};

const closeGenerateModal = () => {
  showGenerateModal.value = false;
  generatedCodes.value = [];
  generateForm.value = {
    count: 10,
    notes: '',
    maxUses: 1
  };
};

// User Deletion Methods
const confirmDeleteUser = (user) => {
  userToDelete.value = user;
  deleteConfirmation.value = '';
  showDeleteModal.value = true;
};

const deleteUser = async () => {
  if (!userToDelete.value) return;

  loadingDelete.value = true;
  try {
    const response = await apiHelpers.delete(`/api/admin/users/${userToDelete.value.id}`, {
      confirmation: deleteConfirmation.value
    });

    if (response.success) {
      notificationStore.success('User Deleted', response.message);
      closeDeleteModal();
      await fetchUsers(); // Refresh the list
      await fetchStats(); // Refresh stats
    }
  } catch (err) {
    console.error('Failed to delete user:', err);
    notificationStore.error('Error', err.message || 'Failed to delete user');
  } finally {
    loadingDelete.value = false;
  }
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  userToDelete.value = null;
  deleteConfirmation.value = '';
};

// WIN Token Methods
const fetchWinTokenConfig = async () => {
  loadingWinToken.value = true;
  try {
    const response = await apiHelpers.get('/api/admin/win-token/config');
    if (response.success) {
      winTokenConfig.value = response.data;
    }
  } catch (err) {
    console.error('Failed to fetch WIN token config:', err);
    notificationStore.error('Error', 'Failed to load WIN token configuration');
  } finally {
    loadingWinToken.value = false;
  }
};

const refreshWinToken = async () => {
  await fetchWinTokenConfig();
  notificationStore.success('Success', 'WIN token data refreshed');
};

const updateWinPrice = async () => {
  if (!newWinPrice.value || isNaN(newWinPrice.value)) {
    notificationStore.error('Invalid Input', 'Please enter a valid price');
    return;
  }

  updatingPrice.value = true;
  try {
    const response = await apiHelpers.post('/api/admin/win-token/price', {
      price: parseFloat(newWinPrice.value),
      reason: priceUpdateReason.value || 'Manual price update from admin panel'
    });

    if (response.success) {
      notificationStore.success('Success', `WIN token price updated to $${newWinPrice.value}`);
      newWinPrice.value = '';
      priceUpdateReason.value = '';
      await fetchWinTokenConfig();
    }
  } catch (err) {
    console.error('Failed to update WIN price:', err);
    notificationStore.error('Error', err.message || 'Failed to update price');
  } finally {
    updatingPrice.value = false;
  }
};

const formatLargeNumber = (num) => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

// Blockchain Monitor Status Methods
const fetchMonitorStatus = async () => {
  loadingMonitorStatus.value = true;
  try {
    const response = await apiHelpers.get('/api/admin/blockchain/monitor-status');
    if (response.success) {
      monitorStatus.value = response.data;
    }
  } catch (err) {
    console.error('Failed to fetch monitor status:', err);
    notificationStore.error('Error', err.message || 'Failed to fetch blockchain monitor status');
  } finally {
    loadingMonitorStatus.value = false;
  }
};

const refreshMonitorStatus = async () => {
  await fetchMonitorStatus();
  notificationStore.success('Refreshed', 'Blockchain monitor status updated');
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
  fetchInviteCodes();
  fetchWinTokenConfig();
  fetchMonitorStatus();
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
  background: rgba(34, 197, 94, 0.1);
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
  border-color: #22c55e;
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
  background: linear-gradient(135deg, #22c55e 0%, #48bb78 100%);
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
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
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
  background: rgba(34, 197, 94, 0.2);
}

.action-btn.view:hover {
  background: rgba(34, 197, 94, 0.3);
}

.action-btn.danger {
  background: rgba(203, 64, 64, 0.2);
}

.action-btn.danger:hover {
  background: rgba(203, 64, 64, 0.3);
}

.action-btn.delete {
  background: rgba(150, 30, 30, 0.2);
}

.action-btn.delete:hover {
  background: rgba(150, 30, 30, 0.4);
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
  border: 4px solid rgba(34, 197, 94, 0.2);
  border-top-color: #22c55e;
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

.warning-list {
  list-style: disc;
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  color: #e2e8f0;
  line-height: 1.8;
}

.warning-list li {
  margin-bottom: 0.25rem;
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
  background: rgba(34, 197, 94, 0.2);
  border-radius: 4px;
  color: #22c55e;
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
  background: #22c55e;
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
  background: rgba(34, 197, 94, 0.05);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.wallet-currency,
.address-currency {
  font-weight: 700;
  color: #22c55e;
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

/* Invite Code Styles */
.mb-6 {
  margin-bottom: 1.5rem;
}

.generate-btn {
  padding: 0.75rem 1.5rem;
  background: #48bb78;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.generate-btn:hover {
  background: #38a169;
}

.invite-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.invite-stat-card {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.invite-stat-label {
  font-size: 0.875rem;
  color: #a0aec0;
  margin-bottom: 0.5rem;
}

.invite-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #48bb78;
  background: rgba(72, 187, 120, 0.1);
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  display: inline-block;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: white;
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
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
  border-color: #22c55e;
}

.form-hint {
  font-size: 0.75rem;
  color: #718096;
  margin-top: 0.25rem;
}

.generated-codes-box {
  background: rgba(72, 187, 120, 0.1);
  border: 2px solid rgba(72, 187, 120, 0.3);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.generated-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.generated-header h4 {
  color: #48bb78;
  font-size: 1.125rem;
  font-weight: 700;
}

.copy-all-btn {
  padding: 0.5rem 1rem;
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}

.copy-all-btn:hover {
  background: #3182ce;
}

.codes-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.generated-code-item {
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 4px;
  padding: 0.5rem;
  font-family: 'Courier New', monospace;
  color: #48bb78;
  font-size: 0.875rem;
  text-align: center;
}

@media (max-width: 768px) {
  .admin-page {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .invite-stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .section-header {
    flex-direction: column;
    gap: 1rem;
  }

  .section-title {
    font-size: 1.125rem;
  }

  .search-box {
    flex: 1;
    width: 100%;
  }

  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .users-table {
    font-size: 0.875rem;
    min-width: 800px;
  }

  .users-table th,
  .users-table td {
    padding: 0.75rem 0.5rem;
  }

  .modal-content {
    max-width: 100%;
    margin: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .codes-list {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .action-btn {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 640px) {
  .admin-page {
    padding: 0.75rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }

  .stats-grid {
    gap: 0.75rem;
  }

  .stat-card {
    padding: 0.875rem;
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-label {
    font-size: 0.75rem;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .invite-stats-grid {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }

  .section-title {
    font-size: 1rem;
  }

  .users-table {
    font-size: 0.75rem;
    min-width: 700px;
  }

  .users-table th,
  .users-table td {
    padding: 0.625rem 0.375rem;
  }

  .status-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
  }

  .modal-content {
    margin: 0.5rem;
  }

  .generate-btn,
  .btn {
    padding: 0.5rem 0.875rem;
    font-size: 0.875rem;
  }
}

@media (max-width: 480px) {
  .admin-page {
    padding: 0.5rem;
  }

  .page-header h1 {
    font-size: 1.125rem;
  }

  .stat-card {
    padding: 0.75rem;
  }

  .stat-icon {
    font-size: 1.25rem;
  }

  .stat-value {
    font-size: 1.125rem;
  }

  .users-table {
    min-width: 600px;
  }

  .action-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.688rem;
  }
}

/* WIN Token Management Styles */
.win-token-section {
  padding: 1.5rem;
  background: #0f1117;
  border-radius: 8px;
}

.win-price-display {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.price-label {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.5rem;
}

.price-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  font-family: 'JetBrains Mono', monospace;
}

.price-info {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
}

.win-price-form {
  padding: 1.5rem;
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 1rem;
  align-items: center;
}

.price-input,
.reason-input {
  padding: 0.75rem;
  background: #0f1117;
  border: 1px solid #2d3748;
  border-radius: 6px;
  color: white;
  font-size: 0.938rem;
}

.price-input:focus,
.reason-input:focus {
  outline: none;
  border-color: #22c55e;
}

.update-btn {
  padding: 0.75rem 1.5rem;
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.update-btn:hover:not(:disabled) {
  background: #16a34a;
}

.update-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .price-value {
    font-size: 1.75rem;
  }
}

/* Blockchain Monitor Styles */
.monitor-header {
  text-align: center;
}

.monitor-status-badge {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
}

.status-active {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.status-inactive {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding: 1rem;
  background: #1a1d29;
  border-radius: 8px;
  border: 1px solid #2d3748;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #0f1117;
  border-radius: 6px;
}

.config-item-full {
  grid-column: 1 / -1;
}

.config-label {
  font-size: 0.875rem;
  color: #9ca3af;
  font-weight: 500;
}

.config-value {
  font-size: 0.875rem;
  color: white;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.address-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.address-card {
  padding: 1rem;
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 8px;
  text-align: center;
}

.address-currency {
  font-size: 0.875rem;
  font-weight: 700;
  color: #22c55e;
  margin-bottom: 0.5rem;
}

.address-count {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.address-sample {
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: 'JetBrains Mono', monospace;
  word-break: break-all;
}

.address-error {
  font-size: 0.875rem;
  color: #ef4444;
}

@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .address-grid {
    grid-template-columns: 1fr;
  }
}
</style>
