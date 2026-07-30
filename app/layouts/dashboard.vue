<script setup lang="ts">
import type {
  DropdownMenuItem,
  NavigationMenuItem
} from '@nuxt/ui'
import OrgSelector from '~/components/organization/OrgSelector.vue'

const route = useRoute()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const colorMode = useColorMode()

const {
  resetOrganizations
} = useOrganization()

const logoutLoading = ref(false)

const items = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      active: route.path === '/dashboard'
    },
    {
      label: 'Rotas',
      icon: 'i-lucide-route',
      // to: '/dashboard/routes',
      active: route.path.startsWith('/dashboard/routes')
    },
    {
      label: 'Roteamento',
      icon: 'i-lucide-navigation-2',
      to: '/dashboard/routing',
      active: route.path.startsWith('/dashboard/routing')
    },
    {
      label: 'Gerenciar',
      icon: 'i-lucide-settings-2',
      children: [
        {
          label: 'Entregas',
          icon: 'i-lucide-package',
          to: '/dashboard/deliveries',
          active: route.path.startsWith('/dashboard/deliveries')
        },
        {
          label: "Coletas",
          icon: 'i-lucide-boxes',
          // to: '/dashboard/pickups',
          active: route.path.startsWith('/dashboard/pickups')
        },
        {
          label: 'Clientes',
          icon: 'i-lucide-users',
          to: '/dashboard/clients',
          active: route.path.startsWith('/dashboard/clients')
        },
        {
          label: 'Veículos',
          icon: 'i-lucide-truck',
          active: route.path.startsWith('/dashboard/vehicles'),
          to: '/dashboard/vehicles'
        },
        {
          label: 'Depósitos',
          icon: 'i-lucide-warehouse',
          active: route.path.startsWith('/dashboard/depots'),
          to: '/dashboard/depots'
        },
      ]
    },
  ]
])

const userName = computed(() => {
  return (
    user.value?.user_metadata?.full_name ||
    user.value?.user_metadata?.name ||
    user.value?.email?.split('@')[0] ||
    'Usuário'
  )
})

const userEmail = computed(() => {
  return user.value?.email ?? ''
})

const userAvatar = computed(() => {
  return (
    user.value?.user_metadata?.avatar_url ||
    user.value?.user_metadata?.picture ||
    undefined
  )
})

const userInitials = computed(() => {
  const words = userName.value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'U'
  }

  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase()
  }

  return `${words[0]![0]}${words.at(-1)![0]}`.toUpperCase()
})

function setColorMode(mode: 'light' | 'dark' | 'system') {
  colorMode.preference = mode
}

async function logout() {
  if (logoutLoading.value) {
    return
  }

  logoutLoading.value = true

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    resetOrganizations()

    await navigateTo('/login', {
      replace: true
    })
  } catch (error) {
    console.error('Erro ao sair:', error)
  } finally {
    logoutLoading.value = false
  }
}

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: userName.value,
      avatar: {
        src: userAvatar.value,
        alt: userName.value,
        text: userInitials.value
      },
      type: 'label'
    }
  ],
  [
    {
      label: 'Meu perfil',
      icon: 'i-lucide-user',
      to: '/dashboard/settings/profile'
    },
    {
      label: 'Configurações',
      icon: 'i-lucide-settings',
      to: '/dashboard/settings'
    },
    {
      label: 'Organização',
      icon: 'i-lucide-building-2',
      to: '/dashboard/settings/organization',
    }
  ],
  [
    {
      label: 'Aparência',
      icon: 'i-lucide-palette',
      children: [
        [
          {
            label: 'Sistema',
            icon: 'i-lucide-monitor',
            type: 'checkbox',
            checked: colorMode.preference === 'system',
            onUpdateChecked(checked) {
              if (checked) {
                setColorMode('system')
              }
            }
          },
          {
            label: 'Claro',
            icon: 'i-lucide-sun',
            type: 'checkbox',
            checked: colorMode.preference === 'light',
            onUpdateChecked(checked) {
              if (checked) {
                setColorMode('light')
              }
            }
          },
          {
            label: 'Escuro',
            icon: 'i-lucide-moon',
            type: 'checkbox',
            checked: colorMode.preference === 'dark',
            onUpdateChecked(checked) {
              if (checked) {
                setColorMode('dark')
              }
            }
          }
        ]
      ]
    }
  ],
  [
    {
      label: logoutLoading.value ? 'Saindo...' : 'Sair',
      icon: logoutLoading.value
        ? 'i-lucide-loader-circle'
        : 'i-lucide-log-out',
      color: 'error',
      disabled: logoutLoading.value,
      onSelect: logout
    }
  ]
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <NuxtLink to="/dashboard" class="flex min-w-0 items-center" aria-label="Velox">
          <UIcon name="i-lucide-route" class="size-8 text-primary" />
          <p v-if="!collapsed" class="ml-2 truncate text-lg font-semibold text-highlighted">
            Velox
          </p>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSidebarCollapse variant="subtle" :label="collapsed ? '' : 'Esconder barra lateral'" />

        <UNavigationMenu :collapsed="collapsed" :items="items[0]" orientation="vertical" />

        <OrgSelector class="mt-auto" :collapsed="collapsed" />
      </template>

      <template #footer="{ collapsed }">
        <ClientOnly>
          <UDropdownMenu :items="userMenuItems" :content="{
            align: 'start',
            side: collapsed ? 'right' : 'top',
            sideOffset: 8
          }" :ui="{
            content: 'w-64'
          }">
            <UTooltip :text="collapsed ? userName : undefined" :content="{
              side: 'right',
              sideOffset: 8
            }">
              <UButton color="neutral" variant="ghost" :square="collapsed" :block="!collapsed"
                :aria-label="`Abrir menu de ${userName}`" :class="[
                  'min-w-0',
                  collapsed
                    ? 'justify-center'
                    : 'justify-start px-2'
                ]">
                <UAvatar :size="collapsed ? 'sm' : 'md'" :src="userAvatar" :alt="userName" :text="userInitials"
                  class="shrink-0" />

                <div v-if="!collapsed" class="min-w-0 flex-1 text-left">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ userName }}
                  </p>

                  <p class="truncate text-xs text-muted">
                    {{ userEmail }}
                  </p>
                </div>

                <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="ml-auto size-4 shrink-0 text-muted" />
              </UButton>
            </UTooltip>
          </UDropdownMenu>

          <template #fallback>
            <div :class="[
              'flex items-center',
              collapsed
                ? 'justify-center'
                : 'gap-3 px-2'
            ]">
              <USkeleton :class="collapsed
                ? 'size-8 rounded-full'
                : 'size-10 rounded-full'" />

              <div v-if="!collapsed" class="min-w-0 flex-1 space-y-2">
                <USkeleton class="h-3 w-24" />
                <USkeleton class="h-3 w-32" />
              </div>
            </div>
          </template>
        </ClientOnly>
      </template>
    </UDashboardSidebar>

    <UMain class="w-full overflow-y-auto">
      <slot />
    </UMain>
  </UDashboardGroup>
</template>