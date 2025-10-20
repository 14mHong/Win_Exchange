import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import CSS
import './assets/main.css'

// Create app instance
const app = createApp(App)

// Use plugins
app.use(createPinia())
app.use(router)

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err, info)
  // In production, you might want to send this to a logging service
}

// Global warning handler
app.config.warnHandler = (msg, vm, trace) => {
  console.warn('Global warning:', msg, trace)
}

// Global properties
app.config.globalProperties.$apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
app.config.globalProperties.$wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'

// Mount app
app.mount('#app')// Force rebuild Mon 20 Oct 2025 02:27:37 WAT
