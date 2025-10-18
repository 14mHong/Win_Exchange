<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white dark:bg-dark-800 rounded-lg p-6 max-w-sm mx-4 text-center">
        <!-- Spinner -->
        <div class="flex justify-center mb-4">
          <div class="spinner h-8 w-8" />
        </div>
        
        <!-- Message -->
        <p class="text-gray-900 dark:text-gray-100">
          {{ message }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'LoadingOverlay',
  props: {
    message: {
      type: String,
      default: 'Loading...'
    }
  }
}
</script>