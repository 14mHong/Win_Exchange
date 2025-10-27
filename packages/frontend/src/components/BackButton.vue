<template>
  <button @click="goBack" class="back-button" :class="variant">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    <span v-if="showText">{{ text }}</span>
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  text: {
    type: String,
    default: 'Back'
  },
  showText: {
    type: Boolean,
    default: true
  },
  variant: {
    type: String,
    default: 'default', // 'default', 'primary', 'ghost'
    validator: (value) => ['default', 'primary', 'ghost'].includes(value)
  },
  fallbackRoute: {
    type: String,
    default: '/dashboard'
  }
});

const router = useRouter();

const goBack = () => {
  // Check if there's history to go back to
  if (window.history.length > 1) {
    router.back();
  } else {
    // Fallback to a default route if no history
    router.push(props.fallbackRoute);
  }
};
</script>

<style scoped>
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.back-button svg {
  flex-shrink: 0;
}

/* Default variant */
.back-button.default {
  background: #1a1d29;
  color: #e2e8f0;
  border: 1px solid #2d3748;
}

.back-button.default:hover {
  background: #2d3748;
  border-color: #4a5568;
  transform: translateX(-2px);
}

/* Primary variant */
.back-button.primary {
  background: linear-gradient(135deg, #22c55e 0%, #48bb78 100%);
  color: white;
  border: none;
}

.back-button.primary:hover {
  opacity: 0.9;
  transform: translateX(-2px);
}

/* Ghost variant */
.back-button.ghost {
  background: transparent;
  color: #a0aec0;
  border: none;
}

.back-button.ghost:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(-2px);
}

.back-button:active {
  transform: translateX(-2px) scale(0.98);
}

@media (max-width: 768px) {
  .back-button {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
  }
}
</style>
