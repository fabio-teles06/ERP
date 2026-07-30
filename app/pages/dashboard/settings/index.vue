<script setup lang="ts">
import type { OrganizationRole } from '~/composables/useOrganization'
import SettingsNavigation from '~/components/settings/SettingsNavigation.vue'

definePageMeta({
  layout: 'dashboard',
  title: 'Configurações'
})

useHead({
  title: 'Configurações | Velox'
})

const user = useSupabaseUser()

const {
  activeOrganization,
  activeOrganizationId,
  activeRole,
  organizationsLoading,
  organizationsError,
  canManageOrganization,
  loadOrganizations
} = useOrganization()

const fullName = computed(() => {
  return user.value?.user_metadata?.full_name
    || user.value?.user_metadata?.name
    || user.value?.email
    || 'Usuário'
})

const avatarUrl = computed(() => {
  return user.value?.user_metadata?.avatar_url || undefined
})

const roleLabel = computed(() => {
  if (!activeRole.value) {
    return 'Sem função'
  }

  return getRoleLabel(activeRole.value)
})

function getRoleLabel(role: OrganizationRole) {
  const labels: Record<OrganizationRole, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    operator: 'Operador',
    viewer: 'Visualizador'
  }

  return labels[role]
}
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Configurações">
        <template #right>
          <UButton
            type="button"
            label="Atualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="organizationsLoading"
            @click="loadOrganizations(true)"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <SettingsNavigation />

        <div>
          <h1 class="text-2xl font-semibold text-highlighted">
            Configurações
          </h1>
          <p class="mt-1 text-sm text-muted">
            Gerencie sua conta e a organização selecionada.
          </p>
        </div>

        <UAlert
          v-if="organizationsError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Não foi possível carregar as organizações"
          :description="organizationsError"
        />

        <div class="grid gap-4 md:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <UAvatar
                  :src="avatarUrl"
                  :alt="fullName"
                  size="lg"
                />

                <div class="min-w-0">
                  <p class="truncate font-semibold text-highlighted">
                    {{ fullName }}
                  </p>
                  <p class="truncate text-sm text-muted">
                    {{ user?.email }}
                  </p>
                </div>
              </div>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">
                Atualize seu nome, informações profissionais, avatar e senha.
              </p>

              <UButton
                to="/dashboard/settings/profile"
                label="Editar perfil"
                icon="i-lucide-arrow-right"
                trailing
                variant="soft"
              />
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <UIcon name="i-lucide-building-2" class="size-5 text-primary" />
                  </div>

                  <div class="min-w-0">
                    <p class="truncate font-semibold text-highlighted">
                      {{ organizationsLoading
                        ? 'Carregando...'
                        : activeOrganization?.name || 'Nenhuma organização' }}
                    </p>
                    <p class="truncate text-sm text-muted">
                      {{ activeOrganization?.document || 'Documento não informado' }}
                    </p>
                  </div>
                </div>

                <UBadge v-if="activeRole" color="neutral" variant="subtle">
                  {{ roleLabel }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">
                {{ canManageOrganization
                  ? 'Gerencie os dados da empresa, membros, permissões e convites.'
                  : 'Consulte os dados e membros da organização selecionada.' }}
              </p>

              <UButton
                to="/dashboard/settings/organization"
                :label="canManageOrganization
                  ? 'Gerenciar organização'
                  : 'Visualizar organização'"
                icon="i-lucide-arrow-right"
                trailing
                variant="soft"
                :disabled="!activeOrganizationId"
              />
            </div>
          </UCard>
        </div>

        <UAlert
          v-if="!organizationsLoading && !activeOrganizationId"
          color="warning"
          variant="subtle"
          icon="i-lucide-building-2"
          title="Selecione uma organização"
          description="Escolha uma organização no seletor do dashboard para acessar as configurações da empresa."
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
