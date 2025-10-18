<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-900">
    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'AppLayout'
}
</script>