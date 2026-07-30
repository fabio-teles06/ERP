<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Tables } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Clientes'
})

useHead({
  title: 'Clientes'
})

type Client = Tables<'clients'>

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const clients = ref<Client[]>([])
const loading = ref(false)
const deleting = ref(false)
const search = ref('')

const formOpen = ref(false)
const deleteOpen = ref(false)
const selectedClient = ref<Client | null>(null)

const columns: TableColumn<Client>[] = [
  { accessorKey: 'name', header: 'Cliente' },
  { accessorKey: 'document', header: 'Documento' },
  { id: 'contact', header: 'Contato' },
  { id: 'location', header: 'Localização' },
  { accessorKey: 'updated_at', header: 'Atualizado em' },
  { id: 'actions', header: '' }
]

const filteredClients = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return clients.value

  return clients.value.filter((client) => [
    client.name,
    client.trade_name,
    client.document,
    client.email,
    client.phone,
    client.city,
    client.state
  ].some(value => value?.toLowerCase().includes(query)))
})

async function loadClients() {
  if (!activeOrganizationId.value) {
    clients.value = []
    return
  }

  loading.value = true

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', activeOrganizationId.value)
      .order('name', { ascending: true })

    if (error) throw error
    clients.value = data ?? []
  } catch (error) {
    toast.add({
      title: 'Erro ao carregar clientes',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  selectedClient.value = null
  formOpen.value = true
}

function openEdit(client: Client) {
  selectedClient.value = client
  formOpen.value = true
}

function openDelete(client: Client) {
  selectedClient.value = client
  deleteOpen.value = true
}

async function deleteClient() {
  if (!selectedClient.value || !activeOrganizationId.value) return

  deleting.value = true

  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', selectedClient.value.id)
      .eq('organization_id', activeOrganizationId.value)

    if (error) throw error

    toast.add({
      title: 'Cliente excluído',
      description: 'O cliente foi removido com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    deleteOpen.value = false
    selectedClient.value = null
    await loadClients()
  } catch (error: any) {
    const isForeignKeyError = error?.code === '23503'

    toast.add({
      title: 'Não foi possível excluir o cliente',
      description: isForeignKeyError
        ? 'Este cliente está associado a uma ou mais entregas.'
        : getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deleting.value = false
  }
}

function getActions(client: Client): DropdownMenuItem[][] {
  return [[
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(client)
    },
    {
      label: 'Excluir',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDelete(client)
    }
  ]]
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

watch(activeOrganizationId, loadClients, { immediate: true })
</script>

<template>
  <UDashboardPanel id="clients">
    <template #header>
      <UDashboardNavbar title="Clientes">
        <template #right>
          <UButton
            label="Novo cliente"
            icon="i-lucide-plus"
            :disabled="!activeOrganizationId"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="!activeOrganizationId"
          color="warning"
          variant="subtle"
          icon="i-lucide-building-2"
          title="Selecione uma organização"
          description="Escolha uma organização no seletor para visualizar e cadastrar clientes."
        />

        <UCard v-else>
          <template #header>
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="mt-1 text-sm text-muted">
                  {{ clients.length }} cliente(s) cadastrado(s) nesta organização.
                </p>
              </div>

              <div class="flex flex-col gap-2 sm:flex-row">
                <UInput
                  v-model="search"
                  icon="i-lucide-search"
                  placeholder="Pesquisar clientes..."
                  class="w-full sm:w-72"
                />

                <UButton
                  label="Atualizar"
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="outline"
                  :loading="loading"
                  @click="loadClients"
                />
              </div>
            </div>
          </template>

          <UTable
            :data="filteredClients"
            :columns="columns"
            :loading="loading"
            class="w-full"
          >
            <template #name-cell="{ row }">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">{{ row.original.trade_name || row.original.name }}</p>
                <p v-if="row.original.trade_name" class="truncate text-xs text-muted">{{ row.original.name }}</p>
              </div>
            </template>

            <template #document-cell="{ row }">
              {{ row.original.document || '—' }}
            </template>

            <template #contact-cell="{ row }">
              <div class="text-sm">
                <p>{{ row.original.phone || '—' }}</p>
                <p class="text-xs text-muted">{{ row.original.email || 'Sem e-mail' }}</p>
              </div>
            </template>

            <template #location-cell="{ row }">
              <div class="max-w-xs text-sm">
                <p class="truncate">{{ [row.original.city, row.original.state].filter(Boolean).join(' - ') || '—' }}</p>
                <p class="truncate text-xs text-muted">{{ row.original.address_line || 'Sem endereço' }}</p>
              </div>
            </template>

            <template #updated_at-cell="{ row }">
              {{ formatDate(row.original.updated_at) }}
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UDropdownMenu :items="getActions(row.original)" :content="{ align: 'end' }">
                  <UButton
                    icon="i-lucide-ellipsis-vertical"
                    color="neutral"
                    variant="ghost"
                    aria-label="Ações do cliente"
                  />
                </UDropdownMenu>
              </div>
            </template>
          </UTable>

          <div
            v-if="!loading && filteredClients.length === 0"
            class="flex flex-col items-center justify-center py-14 text-center"
          >
            <UIcon name="i-lucide-users" class="mb-3 size-10 text-muted" />
            <p class="font-medium text-highlighted">Nenhum cliente encontrado</p>
            <p class="mt-1 text-sm text-muted">Cadastre o primeiro cliente ou altere a pesquisa.</p>
            <UButton label="Novo cliente" icon="i-lucide-plus" variant="soft" class="mt-4" @click="openCreate" />
          </div>
        </UCard>
      </div>

      <ClientsFormModal
        v-model:open="formOpen"
        :client="selectedClient"
        @saved="loadClients"
      />

      <ConfirmDeleteModal
        v-model:open="deleteOpen"
        title="Excluir cliente"
        description="Clientes vinculados a entregas não poderão ser excluídos."
        :item-name="selectedClient?.trade_name || selectedClient?.name"
        :loading="deleting"
        @confirm="deleteClient"
      />
    </template>
  </UDashboardPanel>
</template>
