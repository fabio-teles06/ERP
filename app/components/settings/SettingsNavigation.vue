<script setup lang="ts">
const route = useRoute()

const items = [
  {
    label: 'Visão geral',
    icon: 'i-lucide-settings',
    to: '/dashboard/settings',
    exact: true
  },
  {
    label: 'Perfil',
    icon: 'i-lucide-user-round',
    to: '/dashboard/settings/profile',
    exact: false
  },
  {
    label: 'Organização',
    icon: 'i-lucide-building-2',
    to: '/dashboard/settings/organization',
    exact: false
  }
]

function isActive(item: typeof items[number]) {
  return item.exact
    ? route.path === item.to
    : route.path.startsWith(item.to)
}
</script>

<template>
  <nav
    class="flex gap-2 overflow-x-auto rounded-lg border border-default bg-elevated/40 p-1"
    aria-label="Configurações"
  >
    <UButton
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :label="item.label"
      :icon="item.icon"
      :color="isActive(item) ? 'primary' : 'neutral'"
      :variant="isActive(item) ? 'soft' : 'ghost'"
      class="shrink-0"
    />
  </nav>
</template>
