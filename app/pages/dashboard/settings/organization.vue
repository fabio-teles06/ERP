<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Database, Tables } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Organização'
})

useHead({
  title: 'Organização | Velox'
})

type OrganizationMember = Tables<'organization_members'>
type OrganizationInvitation = Tables<'organization_invitations'>

const editableRoleValues = [
  'owner',
  'admin',
  'operator',
  'viewer'
] as const satisfies readonly OrganizationRole[]

const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da organização.'),
  document: z.string().trim().optional()
})

const invitationSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  role: z.enum(editableRoleValues)
})

type OrganizationSchema = z.output<typeof organizationSchema>
type InvitationSchema = z.output<typeof invitationSchema>

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()
const {
  activeOrganization,
  activeOrganizationId,
  activeRole,
  organizationsLoading,
  organizationsError,
  canManageOrganization,
  isOwner,
  loadOrganizations
} = useOrganization()

const members = ref<OrganizationMember[]>([])
const invitations = ref<OrganizationInvitation[]>([])

const organizationDataLoading = ref(false)
const savingOrganization = ref(false)
const sendingInvitation = ref(false)
const changingMemberId = ref<string | null>(null)
const deletingMember = ref(false)
const deletingInvitation = ref(false)

const memberDeleteOpen = ref(false)
const invitationDeleteOpen = ref(false)
const selectedMember = ref<OrganizationMember | null>(null)
const selectedInvitation = ref<OrganizationInvitation | null>(null)

const organizationState = reactive<OrganizationSchema>({
  name: '',
  document: ''
})

const invitationState = reactive<InvitationSchema>({
  email: '',
  role: 'operator'
})

const memberColumns: TableColumn<OrganizationMember>[] = [
  { id: 'member', header: 'Membro' },
  { accessorKey: 'role', header: 'Função' },
  { accessorKey: 'created_at', header: 'Desde' },
  { id: 'actions', header: '' }
]

const invitationColumns: TableColumn<OrganizationInvitation>[] = [
  { accessorKey: 'email', header: 'E-mail' },
  { accessorKey: 'role', header: 'Função' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'expires_at', header: 'Expira em' },
  { id: 'actions', header: '' }
]

const roleOptions = editableRoleValues.map(role => ({
  label: roleLabel(role),
  value: role
}))

const memberEmailMap = computed(() => {
  return new Map(
    invitations.value
      .filter(invitation => invitation.invited_user_id)
      .map(invitation => [invitation.invited_user_id as string, invitation.email])
  )
})

function roleLabel(role: OrganizationRole) {
  const labels: Record<OrganizationRole, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    operator: 'Operador',
    viewer: 'Visualizador'
  }

  return labels[role]
}

function roleColor(role: OrganizationRole) {
  switch (role) {
    case 'owner':
      return 'primary'
    case 'admin':
      return 'info'
    case 'operator':
      return 'success'
    default:
      return 'neutral'
  }
}

function invitationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    accepted: 'Aceito',
    declined: 'Recusado',
    expired: 'Expirado',
    cancelled: 'Cancelado',
    revoked: 'Revogado'
  }

  return labels[status] ?? status
}

function invitationStatusColor(status: string) {
  switch (status) {
    case 'accepted':
      return 'success'
    case 'pending':
      return 'warning'
    case 'declined':
    case 'cancelled':
    case 'revoked':
      return 'error'
    default:
      return 'neutral'
  }
}

function memberIdentity(member: OrganizationMember) {
  if (member.user_id === user.value?.sub) {
    return user.value?.email || member.user_id
  }

  return memberEmailMap.value.get(member.user_id) || member.user_id
}

function memberSecondary(member: OrganizationMember) {
  if (member.user_id === user.value?.sub) {
    return 'Você'
  }

  if (memberEmailMap.value.has(member.user_id)) {
    return member.user_id
  }

  return 'Identificação do usuário'
}

function canEditMember(member: OrganizationMember) {
  return isOwner.value
    && member.role !== 'owner'
    && member.user_id !== user.value?.sub
}

function canRemoveMember(member: OrganizationMember) {
  return canManageOrganization.value
    && member.role !== 'owner'
    && member.user_id !== user.value?.sub
}

function syncOrganizationState() {
  Object.assign(organizationState, {
    name: activeOrganization.value?.name ?? '',
    document: activeOrganization.value?.document ?? ''
  })
}

async function loadOrganizationData() {
  const organizationId = activeOrganizationId.value
  const userId = user.value?.sub

  if (!organizationId || !userId) {
    members.value = []
    invitations.value = []
    return
  }

  organizationDataLoading.value = true

  try {
    const [membersResult, invitationsResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
    ])

    if (membersResult.error) throw membersResult.error
    if (invitationsResult.error) throw invitationsResult.error

    /*
     * Evita aplicar os dados de uma organização anterior
     * caso o usuário tenha trocado a seleção durante a consulta.
     */
    if (activeOrganizationId.value !== organizationId) {
      return
    }

    members.value = membersResult.data ?? []
    invitations.value = invitationsResult.data ?? []
  } catch (error) {
    toast.add({
      title: 'Erro ao carregar membros e convites',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    organizationDataLoading.value = false
  }
}

async function refreshOrganizationPage() {
  await loadOrganizations(true)
  syncOrganizationState()
  await loadOrganizationData()
}

async function saveOrganization(event: FormSubmitEvent<OrganizationSchema>) {
  if (!activeOrganizationId.value || !canManageOrganization.value) return

  savingOrganization.value = true

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        name: event.data.name.trim(),
        document: event.data.document?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', activeOrganizationId.value)

    if (error) throw error

    toast.add({
      title: 'Organização atualizada',
      description: 'Os dados da organização foram salvos.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    await loadOrganizations(true)
    syncOrganizationState()
  } catch (error) {
    toast.add({
      title: 'Não foi possível atualizar a organização',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    savingOrganization.value = false
  }
}

async function createInvitation(event: FormSubmitEvent<InvitationSchema>) {

  if (
    !activeOrganizationId.value
    || !user.value?.sub
    || !canManageOrganization.value
  ) {
    return
  }

  const normalizedEmail = event.data.email.trim().toLowerCase()

  supabase.functions.invoke('invite-organization-member', {
    body: {
      organizationId: activeOrganizationId.value,
      email: normalizedEmail,
      role: event.data.role
    }
  }).then(async (result) => {
    if (result.error) {
      throw result.error
    }

    invitationState.email = ''
    invitationState.role = 'operator'

    toast.add({
      title: 'Convite registrado',
      description: 'O convite foi salvo e está aguardando o fluxo de envio/aceite.',
      color: 'success',
      icon: 'i-lucide-mail-check'
    })

    await loadOrganizationData()
  }).catch((error) => {
    toast.add({
      title: 'Não foi possível criar o convite',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  }).finally(() => {
    sendingInvitation.value = false
  })
}

function handleMemberRoleChange(member: OrganizationMember, value: unknown) {
  if (typeof value !== 'string') return

  const nextRole = editableRoleValues.find(role => role === value)
  if (!nextRole) return

  void updateMemberRole(member, nextRole)
}

async function updateMemberRole(
  member: OrganizationMember,
  nextRole: OrganizationRole
) {
  if (!canEditMember(member) || nextRole === 'owner') return

  changingMemberId.value = member.user_id

  try {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: nextRole })
      .eq('organization_id', member.organization_id)
      .eq('user_id', member.user_id)

    if (error) throw error

    member.role = nextRole

    toast.add({
      title: 'Função atualizada',
      description: 'A permissão do membro foi alterada.',
      color: 'success',
      icon: 'i-lucide-shield-check'
    })
  } catch (error) {
    toast.add({
      title: 'Não foi possível alterar a função',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })

    await loadOrganizationData()
  } finally {
    changingMemberId.value = null
  }
}

function askRemoveMember(member: OrganizationMember) {
  selectedMember.value = member
  memberDeleteOpen.value = true
}

async function removeMember() {
  if (!selectedMember.value || !canRemoveMember(selectedMember.value)) return

  deletingMember.value = true

  try {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', selectedMember.value.organization_id)
      .eq('user_id', selectedMember.value.user_id)

    if (error) throw error

    toast.add({
      title: 'Membro removido',
      description: 'O usuário não faz mais parte da organização.',
      color: 'success',
      icon: 'i-lucide-user-round-x'
    })

    memberDeleteOpen.value = false
    selectedMember.value = null
    await loadOrganizationData()
  } catch (error) {
    toast.add({
      title: 'Não foi possível remover o membro',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deletingMember.value = false
  }
}

function askDeleteInvitation(invitation: OrganizationInvitation) {
  selectedInvitation.value = invitation
  invitationDeleteOpen.value = true
}

async function deleteInvitation() {
  if (!selectedInvitation.value || !canManageOrganization.value) return

  deletingInvitation.value = true

  try {
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', selectedInvitation.value.id)
      .eq('organization_id', selectedInvitation.value.organization_id)

    if (error) throw error

    toast.add({
      title: 'Convite removido',
      description: 'O registro de convite foi excluído.',
      color: 'success',
      icon: 'i-lucide-mail-x'
    })

    invitationDeleteOpen.value = false
    selectedInvitation.value = null
    await loadOrganizationData()
  } catch (error) {
    toast.add({
      title: 'Não foi possível remover o convite',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deletingInvitation.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

watch(
  activeOrganization,
  syncOrganizationState,
  { immediate: true }
)

watch(
  [activeOrganizationId, () => user.value?.sub],
  () => void loadOrganizationData(),
  { immediate: true }
)
</script>

<template>
  <UDashboardPanel id="organization-settings">
    <template #header>
      <UDashboardNavbar title="Organização">
        <template #right>
          <UButton label="Atualizar" icon="i-lucide-refresh-cw" color="neutral" variant="outline"
            :loading="organizationsLoading || organizationDataLoading" :disabled="!activeOrganizationId"
            @click="refreshOrganizationPage" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-6xl space-y-6">
        <SettingsNavigation />

        <div>
          <h1 class="text-2xl font-semibold text-highlighted">
            Organização
          </h1>
          <p class="mt-1 text-sm text-muted">
            Gerencie dados da empresa, membros, funções e convites.
          </p>
        </div>

        <UAlert v-if="!activeOrganizationId" color="warning" variant="subtle" icon="i-lucide-building-2"
          title="Selecione uma organização"
          description="Escolha uma organização no seletor para abrir estas configurações." />

        <UAlert v-else-if="organizationsError" color="error" variant="subtle" icon="i-lucide-circle-alert"
          title="Não foi possível carregar a organização" :description="organizationsError" />

        <template v-else>
          <UAlert v-if="activeRole && !canManageOrganization" color="info" variant="subtle" icon="i-lucide-eye"
            title="Acesso somente para consulta"
            description="Sua função permite visualizar os dados, mas não editar a organização ou seus membros." />

          <UCard>
            <template #header>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="font-semibold text-highlighted">
                    Dados da organização
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    Informações usadas no dashboard e nos documentos da empresa.
                  </p>
                </div>

                <UBadge v-if="activeRole" :color="roleColor(activeRole)" variant="subtle">
                  {{ roleLabel(activeRole) }}
                </UBadge>
              </div>
            </template>

            <UForm :schema="organizationSchema" :state="organizationState" class="space-y-5" @submit="saveOrganization">
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField name="name" label="Nome da organização" required>
                  <UInput v-model="organizationState.name" placeholder="Nome da empresa" icon="i-lucide-building-2"
                    class="w-full" :disabled="!canManageOrganization" />
                </UFormField>

                <UFormField name="document" label="CNPJ / Documento">
                  <UInput v-model="organizationState.document" placeholder="Documento da organização"
                    icon="i-lucide-file-text" class="w-full" :disabled="!canManageOrganization" />
                </UFormField>
              </div>

              <div v-if="canManageOrganization" class="flex justify-end border-t border-default pt-5">
                <UButton type="submit" label="Salvar organização" icon="i-lucide-save" :loading="savingOrganization" />
              </div>
            </UForm>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  Membros
                </h2>
                <p class="mt-1 text-sm text-muted">
                  {{ members.length }} usuário(s) vinculado(s) à organização.
                </p>
              </div>
            </template>

            <UTable :data="members" :columns="memberColumns" :loading="organizationsLoading || organizationDataLoading"
              class="w-full">
              <template #member-cell="{ row }">
                <div class="flex min-w-0 items-center gap-3">
                  <UAvatar :alt="memberIdentity(row.original)" size="sm" />

                  <div class="min-w-0">
                    <p class="truncate font-medium text-highlighted">
                      {{ memberIdentity(row.original) }}
                    </p>
                    <p class="truncate text-xs text-muted">
                      {{ memberSecondary(row.original) }}
                    </p>
                  </div>
                </div>
              </template>

              <template #role-cell="{ row }">
                <UBadge v-if="!canEditMember(row.original)" :color="roleColor(row.original.role)" variant="subtle">
                  {{ roleLabel(row.original.role) }}
                </UBadge>

                <USelect v-else :model-value="row.original.role" :items="roleOptions" label-key="label"
                  value-key="value" class="w-44" :loading="changingMemberId === row.original.user_id"
                  @update:model-value="value => handleMemberRoleChange(row.original, value)" />
              </template>

              <template #created_at-cell="{ row }">
                {{ formatDate(row.original.created_at) }}
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UButton v-if="canRemoveMember(row.original)" type="button" icon="i-lucide-user-round-x" color="error"
                    variant="ghost" aria-label="Remover membro" @click="askRemoveMember(row.original)" />
                </div>
              </template>
            </UTable>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  Convidar membro
                </h2>
                <p class="mt-1 text-sm text-muted">
                  Registre um convite para adicionar um usuário à organização.
                </p>
              </div>
            </template>

            <UForm v-if="canManageOrganization" :schema="invitationSchema" :state="invitationState"
              class="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end" @submit="createInvitation">
              <UFormField name="email" label="E-mail" required>
                <UInput v-model="invitationState.email" type="email" placeholder="usuario@empresa.com"
                  icon="i-lucide-mail" class="w-full" />
              </UFormField>

              <UFormField name="role" label="Função" required>
                <USelect v-model="invitationState.role" :items="roleOptions" label-key="label" value-key="value"
                  class="w-full" />
              </UFormField>

              <UButton type="submit" label="Criar convite" icon="i-lucide-user-round-plus" :loading="sendingInvitation"
                class="justify-center" />
            </UForm>

            <UAlert v-else color="neutral" variant="subtle" icon="i-lucide-lock-keyhole"
              title="Sem permissão para convidar"
              description="Somente proprietários e administradores podem criar convites." />
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  Convites
                </h2>
                <p class="mt-1 text-sm text-muted">
                  Acompanhe os convites criados para esta organização.
                </p>
              </div>
            </template>

            <UTable :data="invitations" :columns="invitationColumns"
              :loading="organizationsLoading || organizationDataLoading" class="w-full">
              <template #email-cell="{ row }">
                <div>
                  <p class="font-medium text-highlighted">
                    {{ row.original.email }}
                  </p>
                  <p class="text-xs text-muted">
                    Criado em {{ formatDate(row.original.created_at) }}
                  </p>
                </div>
              </template>

              <template #role-cell="{ row }">
                <UBadge :color="roleColor(row.original.role)" variant="subtle">
                  {{ roleLabel(row.original.role) }}
                </UBadge>
              </template>

              <template #status-cell="{ row }">
                <UBadge :color="invitationStatusColor(row.original.status)" variant="subtle">
                  {{ invitationStatusLabel(row.original.status) }}
                </UBadge>
              </template>

              <template #expires_at-cell="{ row }">
                {{ formatDate(row.original.expires_at) }}
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UButton v-if="canManageOrganization && row.original.status === 'pending'" type="button"
                    icon="i-lucide-trash-2" color="error" variant="ghost" aria-label="Excluir convite"
                    @click="askDeleteInvitation(row.original)" />
                </div>
              </template>
            </UTable>

            <div v-if="!organizationDataLoading && invitations.length === 0"
              class="flex flex-col items-center justify-center py-10 text-center">
              <UIcon name="i-lucide-mail-open" class="mb-3 size-9 text-muted" />
              <p class="font-medium text-highlighted">
                Nenhum convite encontrado
              </p>
              <p class="mt-1 text-sm text-muted">
                Os convites criados aparecerão nesta lista.
              </p>
            </div>
          </UCard>
        </template>
      </div>

      <ConfirmDeleteModal v-model:open="memberDeleteOpen" title="Remover membro"
        description="O usuário perderá o acesso aos dados desta organização."
        :item-name="selectedMember ? memberIdentity(selectedMember) : null" :loading="deletingMember"
        @confirm="removeMember" />

      <ConfirmDeleteModal v-model:open="invitationDeleteOpen" title="Excluir convite"
        description="O convite pendente será removido." :item-name="selectedInvitation?.email"
        :loading="deletingInvitation" @confirm="deleteInvitation" />
    </template>
  </UDashboardPanel>
</template>
