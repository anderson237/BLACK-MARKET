<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({
  title: 'Connexion administration',
  meta: [{ name: 'robots', content: 'noindex, nofollow', key: 'robots' }],
})
</script>

<template>
  <AdminLogin />
</template>
