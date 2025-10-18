<template>
  <div class="wallet-page">
    <div class="wallet-header">
      <h1 class="text-3xl font-bold text-white mb-2">Wallet</h1>
      <p class="text-gray-400">Manage your cryptocurrency assets</p>
    </div>

    <!-- Navigation Tabs -->
    <div class="wallet-tabs">
      <router-link
        to="/wallet/deposit"
        :class="['tab', { active: isActive('/wallet/deposit') }]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span>Deposit</span>
      </router-link>

      <router-link
        to="/wallet/withdraw"
        :class="['tab', { active: isActive('/wallet/withdraw') }]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
        <span>Withdraw</span>
      </router-link>

      <router-link
        to="/wallet/history"
        :class="['tab', { active: isActive('/wallet/history') }]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>History</span>
      </router-link>
    </div>

    <!-- Router View for Child Pages -->
    <div class="wallet-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const isActive = (path) => {
  return route.path.startsWith(path);
};
</script>

<style scoped>
.wallet-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.wallet-header {
  margin-bottom: 2rem;
}

.wallet-tabs {
  display: flex;
  gap: 0.5rem;
  background: #1a1d29;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 0.5rem;
  margin-bottom: 2rem;
  overflow-x: auto;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  color: #a0aec0;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab:hover {
  color: white;
  background: rgba(66, 153, 225, 0.1);
}

.tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.wallet-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .wallet-tabs {
    overflow-x: scroll;
  }

  .tab {
    flex: 0 0 auto;
    min-width: 120px;
  }
}
</style>
