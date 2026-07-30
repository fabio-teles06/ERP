<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Enums, Tables } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Depositos'
})

useHead({
  title: 'Depositos'
})

type Depot = Tables<'depots'>

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const depots = ref<Depot[]>([])
const loading = ref(false)
const deleting = ref(false)
const search = ref('')

const formOpen = ref(false)
const deleteOpen = ref(false)
const selectedDepot = ref<Depot | null>(null)


const columns: TableColumn<Depot>[] = [
  { accessorKey: 'sigla', header: 'Sigla' },
  { accessorKey: 'name', header: 'Nome' },
  { id: 'location', header: 'Localização' },
  { id: 'actions', header: '' }
]

const depotsById = computed(() => {
  return new Map(depots.value.map(depot => [depot.id, depot]))
})

const filteredDepots = computed(() => {
  const query = search.value.trim().toLowerCase()

  return depots.value.filter((depot) => {
    if (!query) return true

    return [
      depot.address_line,
      depot.address_number,
      depot.address_complement,
      depot.neighborhood,
      depot.city,
      depot.state,
      depot.postal_code,
      depot.name,
      depot.sigla
    ].some(value => value?.toLowerCase().includes(query))
  })
})

async function loadDepots() {
  if (!activeOrganizationId.value) {
    depots.value = []
    return
  }

  loading.value = true

  try {
    const { data, error } = await supabase
      .from('depots')
      .select(`*`)
      .eq('organization_id', activeOrganizationId.value)
      .order('name', { ascending: true })

    if (error) throw error
    depots.value = data ?? []
  } catch (error) {
    toast.add({
      title: 'Erro ao carregar depósitos',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}

async function loadPageData() {
  await loadDepots()
}

function openCreate() {
  selectedDepot.value = null
  formOpen.value = true
}


function openEdit(depot: Depot) {
  selectedDepot.value = depot
  formOpen.value = true
}

function openDelete(depot: Depot) {
  selectedDepot.value = depot
  deleteOpen.value = true
}

async function deleteDepot() {
  if (!selectedDepot.value || !activeOrganizationId.value) return

  deleting.value = true

  try {
    const { error } = await supabase
      .from('depots')
      .delete()
      .eq('id', selectedDepot.value.id)
      .eq('organization_id', activeOrganizationId.value)

    if (error) throw error

    toast.add({
      title: 'Depósito excluído',
      description: 'O depósito foi removido com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    deleteOpen.value = false
    selectedDepot.value = null
    await loadDepots()
  } catch (error) {
    toast.add({
      title: 'Não foi possível excluir o depósito',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deleting.value = false
  }
}

function getActions(depot: Depot): DropdownMenuItem[][] {
  return [[
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(depot)
    },
    {
      label: 'Excluir',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDelete(depot)
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
      <UDashboardNavbar title="Depósitos">
        <template #right>
          <UButton label="Novo depósito" icon="i-lucide-plus" :disabled="!activeOrganizationId" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UAlert v-if="!activeOrganizationId" color="warning" variant="subtle" icon="i-lucide-building-2"
          title="Selecione uma organização"
          description="Escolha uma organização no seletor para visualizar e cadastrar entregas." />

        <template v-else>
          <UCard>
            <template #header>
              <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p class="mt-1 text-sm text-muted">
                    {{ depots.length }} depósito(s) cadastrado(s) nesta organização.
                  </p>
                </div>

                <div class="flex flex-col gap-2 sm:flex-row">
                  <UInput v-model="search" icon="i-lucide-search" placeholder="Pesquisar depósitos..."
                    class="w-full sm:w-72" />


                  <UButton label="Atualizar" icon="i-lucide-refresh-cw" color="neutral" variant="outline"
                    :loading="loading" @click="loadPageData" />
                </div>
              </div>
            </template>

            <UTable :data="filteredDepots" :columns="columns" :loading="loading" class="w-full">

              <template #location-cell="{ row }">
                <p class="text-sm text-muted">
                  {{ row.original.address_line }} {{ row.original.address_number }} {{ row.original.address_complement }} 
                  {{ row.original.neighborhood }} - {{ row.original.city }}/{{ row.original.state }} - {{ row.original.postal_code }}
                </p>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UDropdownMenu :items="getActions(row.original)" :content="{ align: 'end' }">
                    <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost"
                      aria-label="Ações do depósito" />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>

            <div v-if="!loading && filteredDepots.length === 0"
              class="flex flex-col items-center justify-center py-14 text-center">
              <UIcon name="i-lucide-package-open" class="mb-3 size-10 text-muted" />
              <p class="font-medium text-highlighted">Nenhum depósito encontrado</p>
              <p class="mt-1 text-sm text-muted">Cadastre o primeiro depósito ou altere os filtros.</p>
              <UButton label="Novo depósito" icon="i-lucide-plus" variant="soft" class="mt-4" @click="openCreate" />
            </div>
          </UCard>
        </template>
      </div>

      <DepotsFormModal v-model:open="formOpen" :depot="selectedDepot" @saved="loadDepots" />

      <ConfirmDeleteModal v-model:open="deleteOpen" title="Excluir depósito"
        description="Esta ação removerá permanentemente o depósito selecionado."
        :item-name="selectedDepot?.name || selectedDepot?.sigla" :loading="deleting" @confirm="deleteDepot" />
    </template>
  </UDashboardPanel>
</template>