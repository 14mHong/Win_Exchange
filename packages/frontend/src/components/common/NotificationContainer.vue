<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <TransitionGroup 
        name="notification" 
        tag="div" 
        class="space-y-2"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="[
            'notification',
            `notification-${notification.type}`,
            'w-80 sm:w-96'
          ]"
        >
          <div class="flex items-start p-4">
            <!-- Icon -->
            <div class="flex-shrink-0">
              <component 
                :is="getIcon(notification.type)"
                :class="[
                  'h-5 w-5',
                  getIconColor(notification.type)
                ]"
              />
            </div>

            <!-- Content -->
            <div class="ml-3 flex-1">
              <h4 
                v-if="notification.title"
                class="text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                {{ notification.title }}
              </h4>
              <p 
                v-if="notification.message"
                :class="[
                  'text-sm',
                  notification.title ? 'mt-1' : '',
                  'text-gray-700 dark:text-gray-300'
                ]"
              >
                {{ notification.message }}
              </p>

              <!-- Action button -->
              <button
                v-if="notification.action"
                class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
                @click="handleAction(notification)"
              >
                {{ notification.action.text }}
              </button>
            </div>

            <!-- Close button -->
            <div class="ml-4 flex-shrink-0">
              <button
                class="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
                @click="removeNotification(notification.id)"
              >
                <XMarkIcon class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Progress bar for timed notifications -->
          <div
            v-if="notification.duration > 0"
            class="h-1 bg-gray-200 dark:bg-gray-700"
          >
            <div
              :class="[
                'h-full transition-all ease-linear',
                getProgressColor(notification.type)
              ]"
              :style="{ 
                width: '100%',
                animation: `shrink ${notification.duration}ms linear forwards`
              }"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script>
import { computed } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

export default {
  name: 'NotificationContainer',
  components: {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XMarkIcon
  },
  setup() {
    const notificationStore = useNotificationStore()

    const notifications = computed(() => notificationStore.notifications)

    const getIcon = (type) => {
      const icons = {
        success: CheckCircleIcon,
        error: ExclamationCircleIcon,
        warning: ExclamationTriangleIcon,
        info: InformationCircleIcon
      }
      return icons[type] || InformationCircleIcon
    }

    const getIconColor = (type) => {
      const colors = {
        success: 'text-success-500',
        error: 'text-danger-500',
        warning: 'text-warning-500',
        info: 'text-primary-500'
      }
      return colors[type] || 'text-primary-500'
    }

    const getProgressColor = (type) => {
      const colors = {
        success: 'bg-success-500',
        error: 'bg-danger-500',
        warning: 'bg-warning-500',
        info: 'bg-primary-500'
      }
      return colors[type] || 'bg-primary-500'
    }

    const removeNotification = (id) => {
      notificationStore.removeNotification(id)
    }

    const handleAction = (notification) => {
      if (notification.action?.handler) {
        notification.action.handler()
      }
      removeNotification(notification.id)
    }

    return {
      notifications,
      getIcon,
      getIconColor,
      getProgressColor,
      removeNotification,
      handleAction
    }
  }
}
</script>

<style scoped>
.notification-enter-active {
  transition: all 0.3s ease-out;
}

.notification-leave-active {
  transition: all 0.3s ease-in;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@keyframes shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
</style>