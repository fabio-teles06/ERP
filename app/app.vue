<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'pt-BR',
  },
  titleTemplate: title => title ? `${title} | Velox` : 'Velox',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>