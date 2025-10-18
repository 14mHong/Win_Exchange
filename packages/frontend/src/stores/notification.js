import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationStore = defineStore('notification', () => {
  // State
  const notifications = ref([])
  const maxNotifications = 5

  // Actions
  const addNotification = (notification) => {
    const id = Date.now() + Math.random()
    const newNotification = {
      id,
      type: notification.type || 'info', // success, error, warning, info
      title: notification.title || '',
      message: notification.message || '',
      duration: notification.duration || (notification.type === 'error' ? 0 : 5000), // 0 means persistent
      action: notification.action || null, // { text: 'Action', handler: () => {} }
      timestamp: new Date()
    }

    notifications.value.unshift(newNotification)

    // Remove oldest notifications if we exceed max
    if (notifications.value.length > maxNotifications) {
      notifications.value = notifications.value.slice(0, maxNotifications)
    }

    // Auto-remove notification after duration (if not persistent)
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAll = () => {
    notifications.value = []
  }

  const success = (title, message, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      ...options
    })
  }

  const error = (title, message, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      duration: 0, // Persistent by default for errors
      ...options
    })
  }

  const warning = (title, message, options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      ...options
    })
  }

  const info = (title, message, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    })
  }

  return {
    // State
    notifications,
    
    // Actions
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  }
})