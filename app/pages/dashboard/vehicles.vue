<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Enums, Tables } from '~/types/database.types'

definePageMeta({
  layout: 'dashboard',
  title: 'Veículos'
})

useHead({
  title: 'Veículos'
})

type Vehicle = Tables<'vehicles'>

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const vehicles = ref<Vehicle[]>([])
const loading = ref(false)
const deleting = ref(false)
const search = ref('')

const formOpen = ref(false)
const deleteOpen = ref(false)
const selectedVehicle = ref<Vehicle | null>(null)


const columns: TableColumn<Vehicle>[] = [
  { accessorKey: 'plate', header: 'placa' },

  { id: 'capacity', header: 'capacidade' },
  { id: 'updated_at', header: 'Atualizado em' },
  { id: 'actions', header: '' }
]

const vehiclesById = computed(() => {
  return new Map(vehicles.value.map(depot => [depot.id, depot]))
})

const filteredVehicles = computed(() => {
  const query = search.value.trim().toLowerCase()

  return vehicles.value.filter((vehicle) => {
    if (!query) return true

    return [
      vehicle.plate,
    ].some(value => value?.toLowerCase().includes(query))
  })
})

async function loadVehicles() {
  if (!activeOrganizationId.value) {
    vehicles.value = []
    return
  }

  loading.value = true

  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`*`)
      .eq('organization_id', activeOrganizationId.value)
      .order('plate', { ascending: true })

    if (error) throw error
    vehicles.value = data ?? []
  } catch (error) {
    toast.add({
      title: 'Erro ao carregar veículos',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}

async function loadPageData() {
  await loadVehicles()
}

function openCreate() {
  selectedVehicle.value = null
  formOpen.value = true
}


function openEdit(vehicle: Vehicle) {
  selectedVehicle.value = vehicle
  formOpen.value = true
}

function openDelete(vehicle: Vehicle) {
  selectedVehicle.value = vehicle
  deleteOpen.value = true
}

async function deleteVehicle() {
  if (!selectedVehicle.value || !activeOrganizationId.value) return

  deleting.value = true

  try {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', selectedVehicle.value.id)
      .eq('organization_id', activeOrganizationId.value)

    if (error) throw error

    toast.add({
      title: 'Veículo excluído',
      description: 'O veículo foi removido com sucesso.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    deleteOpen.value = false
    selectedVehicle.value = null
    await loadVehicles()
  } catch (error) {
    toast.add({
      title: 'Não foi possível excluir o veículos',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deleting.value = false
  }
}

function getActions(vehicle: Vehicle): DropdownMenuItem[][] {
  return [[
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => openEdit(vehicle)
    },
    {
      label: 'Excluir',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDelete(vehicle)
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

  const [date, time] = value.split('T')
  if (!date || !time) return value
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return value
  
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

watch(activeOrganizationId, loadPageData, { immediate: true })
</script>

<template>
  <UDashboardPanel id="vehicles">
    <template #header>
      <UDashboardNavbar title="Veículos">
        <template #right>
          <UButton label="Novo veículo" icon="i-lucide-plus" :disabled="!activeOrganizationId" @click="openCreate" />
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
                    {{ vehicles.length }} veículo(s) cadastrado(s) nesta organização.
                  </p>
                </div>

                <div class="flex flex-col gap-2 sm:flex-row">
                  <UInput v-model="search" icon="i-lucide-search" placeholder="Pesquisar veículos..."
                    class="w-full sm:w-72" />


                  <UButton label="Atualizar" icon="i-lucide-refresh-cw" color="neutral" variant="outline"
                    :loading="loading" @click="loadPageData" />
                </div>
              </div>
            </template>

            <UTable :data="filteredVehicles" :columns="columns" :loading="loading" class="w-full">
              <template #capacity-cell="{ row }">
                <p class="text-sm text-muted">{{ row.original.weight_capacity }} kg</p>
                <p class="text-sm text-muted">{{ row.original.volume_capacity }} m3</p>
              </template>

              <template #updated_at-cell="{ row }">
                <p class="text-sm text-muted">{{ formatDate(row.original.updated_at) }}</p>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UDropdownMenu :items="getActions(row.original)" :content="{ align: 'end' }">
                    <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost"
                      aria-label="Ações do veículo" />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>

            <div v-if="!loading && filteredVehicles.length === 0"
              class="flex flex-col items-center justify-center py-14 text-center">
              <UIcon name="i-lucide-package-open" class="mb-3 size-10 text-muted" />
              <p class="font-medium text-highlighted">Nenhum veículo encontrado</p>
              <p class="mt-1 text-sm text-muted">Cadastre o primeiro veículo ou altere os filtros.</p>
              <UButton label="Novo veículo" icon="i-lucide-plus" variant="soft" class="mt-4" @click="openCreate" />
            </div>
          </UCard>
        </template>
      </div>

      <!-- <DepotsFormModal v-model:open="formOpen" :depot="selectedVehicle" @saved="loadVehicles" /> -->

      <ConfirmDeleteModal v-model:open="deleteOpen" title="Excluir veículo"
        description="Esta ação removerá permanentemente o veículo selecionado." :item-name="selectedVehicle?.plate"
        :loading="deleting" @confirm="deleteVehicle" />
    </template>
  </UDashboardPanel>
</template>