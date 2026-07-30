<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Enums, Tables } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Entregas'
})

useHead({
  title: 'Entregas'
})

type Delivery = Tables<'deliveries'>
type DeliveryStatus = Enums<'delivery_status'>
type Client = Pick<
  Tables<'clients'>,
  | 'id'
  | 'name'
  | 'trade_name'
  | 'document'
  | 'address_line'
  | 'address_number'
  | 'address_complement'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'latitude'
  | 'longitude'
>

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const deliveries = ref<Delivery[]>([])
const clients = ref<Client[]>([])
const loading = ref(false)
const loadingClients = ref(false)
const deleting = ref(false)
const search = ref('')
const statusFilter = ref<'all' | DeliveryStatus>('all')

const formOpen = ref(false)
const deleteOpen = ref(false)
const selectedDelivery = ref<Delivery | null>(null)

const statusMeta = {
  pending: { label: 'Pendente', color: 'warning' },
  ready: { label: 'Pronta', color: 'info' },
  routed: { label: 'Roteirizada', color: 'primary' },
  in_transit: { label: 'Em trânsito', color: 'info' },
  delivered: { label: 'Entregue', color: 'success' },
  failed: { label: 'Falhou', color: 'error' },
  cancelled: { label: 'Cancelada', color: 'neutral' }
} as const

const statusOptions: Array<{ label: string, value: 'all' | DeliveryStatus }> = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Pronta', value: 'ready' },
  { label: 'Roteirizada', value: 'routed' },
  { label: 'Em trânsito', value: 'in_transit' },
  { label: 'Entregue', value: 'delivered' },
  { label: 'Falhou', value: 'failed' },
  { label: 'Cancelada', value: 'cancelled' }
]

const columns: TableColumn<Delivery>[] = [
  { accessorKey: 'invoice_number', header: 'Nota fiscal' },
  { id: 'sender', header: 'Remetente' },
  { id: 'recipient', header: 'Destinatário' },
  { id: 'destination', header: 'Destino' },
  {
    accessorKey: 'weight',
    header: 'Peso',
    meta: { class: { th: 'text-right', td: 'text-right' } }
  },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'expected_delivery_date', header: 'Previsão' },
  { id: 'actions', header: '' }
]

const clientsById = computed(() => {
  return new Map(clients.value.map(client => [client.id, client]))
})

const filteredDeliveries = computed(() => {
  const query = search.value.trim().toLowerCase()

  return deliveries.value.filter((delivery) => {
    if (statusFilter.value !== 'all' && delivery.status !== statusFilter.value) {
      return false
    }

    if (!query) return true

    const sender = clientsById.value.get(delivery.sender_id)
    const recipient = clientsById.value.get(delivery.recipient_id)

    return [
      delivery.external_reference,
      delivery.invoice_number,
      delivery.invoice_series,
      delivery.delivery_address,
      delivery.delivery_city,
      delivery.delivery_state,
      sender?.name,
      sender?.trade_name,
      sender?.document,
      recipient?.name,
      recipient?.trade_name,
      recipient?.document
    ].some(value => value?.toLowerCase().includes(query))
  })
})

async function loadClients() {
  if (!activeOrganizationId.value) {
    clients.value = []
    return
  }

  loadingClients.value = true

  try {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        trade_name,
        document,
        address_line,
        address_number,
        address_complement,
        neighborhood,
        city,
        state,
        postal_code,
        latitude,
        longitude
      `)
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
    loadingClients.value = false
  }
}

async function loadDeliveries() {
  if (!activeOrganizationId.value) {
    deliveries.value = []
    return
  }

  loading.value = true

  try {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('organization_id', activeOrganizationId.value)
      .order('created_at', { ascending: false })

    if (error) throw error
    deliveries.value = data ?? []
  } catch (error) {
    toast.add({
      title: 'Erro ao carregar entregas',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}

async function loadPageData() {
  await Promise.all([
    loadClients(),
    loadDeliveries()
  ])
}

function openCreate() {
  selectedDelivery.value = null
  formOpen.value = true
}

function openEdit(delivery: Delivery) {
  selectedDelivery.value = delivery
  formOpen.value = true
}

function openDelete(delivery: Delivery) {
  selectedDelivery.value = delivery
  deleteOpen.value = true
}

async function deleteDelivery() {
  if (!selectedDelivery.value || !activeOrganizationId.value) return

  deleting.value = true

  try {
    const { error } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', selectedDelivery.value.id)
      .eq('organization_id', activeOrganizationId.value)

    if (error) throw error

    toast.add({
      title: 'Entrega excluída',
      description: 'A entrega foi removida com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    deleteOpen.value = false
    selectedDelivery.value = null
    await loadDeliveries()
  } catch (error) {
    toast.add({
      title: 'Não foi possível excluir a entrega',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deleting.value = false
  }
}

function getActions(delivery: Delivery): DropdownMenuItem[][] {
  return [[
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(delivery)
    },
    {
      label: 'Excluir',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDelete(delivery)
    }
  ]]
}

function clientName(clientId: string) {
  const client = clientsById.value.get(clientId)
  return client?.trade_name || client?.name || 'Cliente não encontrado'
}

function clientDocument(clientId: string) {
  return clientsById.value.get(clientId)?.document || 'Sem documento'
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

function formatWeight(value: number | string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value ?? 0))} kg`
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

watch(activeOrganizationId, loadPageData, { immediate: true })
</script>

<template>
  <UDashboardPanel id="deliveries">
    <template #header>
      <UDashboardNavbar title="Entregas">
        <template #right>
          <UButton
            label="Nova entrega"
            icon="i-lucide-plus"
            :disabled="!activeOrganizationId || clients.length === 0"
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
          description="Escolha uma organização no seletor para visualizar e cadastrar entregas."
        />

        <template v-else>
          <UAlert
            v-if="!loadingClients && clients.length === 0"
            color="warning"
            variant="subtle"
            icon="i-lucide-users"
            title="Cadastre um cliente primeiro"
            description="Uma entrega precisa de um remetente e de um destinatário cadastrados."
            :actions="[{
              label: 'Ir para clientes',
              to: '/dashboard/clientes',
              color: 'warning',
              variant: 'soft'
            }]"
          />

          <UCard>
            <template #header>
              <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p class="mt-1 text-sm text-muted">
                    {{ deliveries.length }} entrega(s) cadastrada(s) nesta organização.
                  </p>
                </div>

                <div class="flex flex-col gap-2 sm:flex-row">
                  <UInput
                    v-model="search"
                    icon="i-lucide-search"
                    placeholder="Pesquisar entregas..."
                    class="w-full sm:w-72"
                  />

                  <USelect
                    v-model="statusFilter"
                    :items="statusOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full sm:w-48"
                  />

                  <UButton
                    label="Atualizar"
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="outline"
                    :loading="loading || loadingClients"
                    @click="loadPageData"
                  />
                </div>
              </div>
            </template>

            <UTable
              :data="filteredDeliveries"
              :columns="columns"
              :loading="loading"
              class="w-full"
            >
              <template #invoice_number-cell="{ row }">
                <div>
                  <p class="font-medium text-highlighted">{{ row.original.invoice_number || 'Sem nota' }}</p>
                  <p class="text-xs text-muted">
                    {{ row.original.invoice_series ? `Série ${row.original.invoice_series}` : row.original.external_reference || 'Sem referência' }}
                  </p>
                </div>
              </template>

              <template #sender-cell="{ row }">
                <div class="max-w-48">
                  <p class="truncate font-medium">{{ clientName(row.original.sender_id) }}</p>
                  <p class="truncate text-xs text-muted">{{ clientDocument(row.original.sender_id) }}</p>
                </div>
              </template>

              <template #recipient-cell="{ row }">
                <div class="max-w-48">
                  <p class="truncate font-medium">{{ clientName(row.original.recipient_id) }}</p>
                  <p class="truncate text-xs text-muted">{{ clientDocument(row.original.recipient_id) }}</p>
                </div>
              </template>

              <template #destination-cell="{ row }">
                <div class="max-w-56">
                  <p class="truncate">{{ [row.original.delivery_city, row.original.delivery_state].filter(Boolean).join(' - ') || '—' }}</p>
                  <p class="truncate text-xs text-muted">{{ row.original.delivery_address || 'Sem endereço' }}</p>
                </div>
              </template>

              <template #weight-cell="{ row }">
                {{ formatWeight(row.original.weight) }}
              </template>

              <template #status-cell="{ row }">
                <UBadge :color="statusMeta[row.original.status].color" variant="subtle">
                  {{ statusMeta[row.original.status].label }}
                </UBadge>
              </template>

              <template #expected_delivery_date-cell="{ row }">
                {{ formatDate(row.original.expected_delivery_date) }}
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UDropdownMenu :items="getActions(row.original)" :content="{ align: 'end' }">
                    <UButton
                      icon="i-lucide-ellipsis-vertical"
                      color="neutral"
                      variant="ghost"
                      aria-label="Ações da entrega"
                    />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>

            <div
              v-if="!loading && filteredDeliveries.length === 0"
              class="flex flex-col items-center justify-center py-14 text-center"
            >
              <UIcon name="i-lucide-package-open" class="mb-3 size-10 text-muted" />
              <p class="font-medium text-highlighted">Nenhuma entrega encontrada</p>
              <p class="mt-1 text-sm text-muted">Cadastre a primeira entrega ou altere os filtros.</p>
              <UButton
                v-if="clients.length > 0"
                label="Nova entrega"
                icon="i-lucide-plus"
                variant="soft"
                class="mt-4"
                @click="openCreate"
              />
            </div>
          </UCard>
        </template>
      </div>

      <DeliveriesFormModal
        v-model:open="formOpen"
        :delivery="selectedDelivery"
        :clients="clients"
        :loading-clients="loadingClients"
        @saved="loadDeliveries"
        @reload-clients="loadClients"
      />

      <ConfirmDeleteModal
        v-model:open="deleteOpen"
        title="Excluir entrega"
        description="Esta ação removerá permanentemente a entrega selecionada."
        :item-name="selectedDelivery?.invoice_number
          ? `NF ${selectedDelivery.invoice_number}`
          : selectedDelivery?.external_reference"
        :loading="deleting"
        @confirm="deleteDelivery"
      />
    </template>
  </UDashboardPanel>
</template>
