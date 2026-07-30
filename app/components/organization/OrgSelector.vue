<script setup lang="ts">
import type { OrganizationRole } from '~/composables/useOrganization'

const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  change: [organizationId: string]
}>()

const {
  organizations,
  activeOrganizationId,
  organizationsLoading,
  organizationsError,
  setActiveOrganization,
  loadOrganizations
} = useOrganization()

const roleLabels: Record<OrganizationRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador'
}

const roleColors: Record<
  OrganizationRole,
  'primary' | 'success' | 'warning' | 'neutral'
> = {
  owner: 'primary',
  admin: 'success',
  operator: 'warning',
  viewer: 'neutral'
}

const activeOrganization = computed(() => {
  return organizations.value.find(
    organization => organization.id === activeOrganizationId.value
  ) ?? null
})

const organizationItems = computed(() => {
  return organizations.value.map(organization => ({
    id: organization.id,
    label: organization.name,
    document: organization.document,
    role: organization.role,
    icon: 'i-lucide-building-2'
  }))
})

const selectedOrganizationId = computed<string | undefined>({
  get() {
    return activeOrganizationId.value ?? undefined
  },

  set(organizationId) {
    if (!organizationId) {
      return
    }

    selectOrganization(organizationId)
  }
})

const collapsedMenuItems = computed(() => {
  const organizationGroup = organizations.value.length
    ? organizations.value.map(organization => ({
        label: organization.name,
        description: organization.document || roleLabels[organization.role],
        icon: 'i-lucide-building-2',
        trailingIcon:
          organization.id === activeOrganizationId.value
            ? 'i-lucide-check'
            : undefined,
        onSelect: () => selectOrganization(organization.id)
      }))
    : [
        {
          label: 'Nenhuma organização',
          icon: 'i-lucide-building-2',
          disabled: true
        }
      ]

  return [
    organizationGroup,
    [
      {
        label: 'Nova organização',
        icon: 'i-lucide-plus',
        to: '/organizations/new'
      },
      {
        label: 'Atualizar organizações',
        icon: 'i-lucide-refresh-cw',
        onSelect: refreshOrganizations
      }
    ]
  ]
})

function selectOrganization(organizationId: string) {
  if (organizationId === activeOrganizationId.value) {
    return
  }

  const changed = setActiveOrganization(organizationId)

  if (changed) {
    emit('change', organizationId)
  }
}

async function refreshOrganizations() {
  await loadOrganizations(true)
}
</script>

<template>
  <div :class="props.collapsed ? 'flex justify-center' : 'w-full'">
    <!-- Sidebar expandida -->
    <USelectMenu
      v-if="!props.collapsed"
      v-model="selectedOrganizationId"
      :items="organizationItems"
      value-key="id"
      label-key="label"
      icon="i-lucide-building-2"
      placeholder="Selecione uma organização"
      :loading="organizationsLoading"
      :disabled="organizationsLoading || organizationItems.length === 0"
      :search-input="{
        placeholder: 'Buscar organização...',
        icon: 'i-lucide-search'
      }"
      :content="{
        align: 'start',
        sideOffset: 8
      }"
      class="w-full"
      size="lg"
    >
      <template #item-label="{ item }">
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ item.label }}
          </p>

          <p
            v-if="item.document"
            class="truncate text-xs text-muted"
          >
            {{ item.document }}
          </p>
        </div>
      </template>

      <template #item-trailing="{ item }">
        <UBadge
          :color="roleColors[item.role]"
          variant="subtle"
          size="xs"
        >
          {{ roleLabels[item.role] }}
        </UBadge>
      </template>

      <template #empty>
        <div class="p-4 text-center">
          <UIcon
            name="i-lucide-building-2"
            class="mb-2 size-6 text-muted"
          />

          <p class="text-sm font-medium">
            Nenhuma organização encontrada
          </p>
        </div>
      </template>

      <template #content-bottom>
        <div class="border-t border-default p-1">
          <UButton
            label="Nova organização"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            block
            to="/organizations/new"
          />

          <UButton
            label="Atualizar organizações"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            block
            :loading="organizationsLoading"
            @click.stop="refreshOrganizations"
          />
        </div>
      </template>
    </USelectMenu>

    <!-- Sidebar recolhida -->
    <UTooltip
      v-else
      :text="activeOrganization?.name ?? 'Selecionar organização'"
      :content="{
        side: 'right',
        sideOffset: 8
      }"
    >
      <UDropdownMenu
        :items="collapsedMenuItems"
        :content="{
          align: 'start',
          side: 'right',
          sideOffset: 8
        }"
        :ui="{
          content: 'w-72'
        }"
      >
        <UButton
          icon="i-lucide-building-2"
          color="neutral"
          variant="ghost"
          square
          size="lg"
          :loading="organizationsLoading"
          aria-label="Selecionar organização"
          :class="{
            'text-primary bg-primary/10': activeOrganization
          }"
        />
      </UDropdownMenu>
    </UTooltip>

    <p
      v-if="organizationsError && !props.collapsed"
      class="mt-1 text-xs text-error"
    >
      {{ organizationsError }}
    </p>
  </div>
</template>