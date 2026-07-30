<script lang="ts" setup>
import type { Tables } from '~/types/database.types'

definePageMeta({
    layout: 'dashboard',
    title: 'Roteirização'
})

useHead({
    title: 'Roteirização VROOM'
})

type Delivery = Tables<'deliveries'>
type Depot = Tables<'depots'>
type Vehicle = Tables<'vehicles'>
type Client = Tables<'clients'>
type Route = Tables<'routes'>
type RoutePoint = Tables<'route_points'>

const supabase = useSupabaseClient()
const toast = useToast()
const { activeOrganizationId } = useOrganization()

const mapRef = ref()

// Dados principais
const depots = ref<Depot[]>([])
const vehicles = ref<Vehicle[]>([])
const deliveries = ref<Delivery[]>([])
const clients = ref<Client[]>([])
const savedRoutes = ref<(Route & { route_points: RoutePoint[] })[]>([])

const loadingData = ref(false)
const optimizing = ref(false)
const evaluatingPlan = ref(false)
const activeTab = ref<'config' | 'routes'>('config')
const activeRouteId = ref<string | null>(null)

// Parâmetros do VROOM
const selectedStartDepotId = ref<string>('')
const selectedEndDepotId = ref<string>('')
const selectedVehicleIds = ref<string[]>([])
const selectedDeliveryIds = ref<string[]>([])
const serviceDurationMinutes = ref<number>(5)
const vehicleProfile = ref<string>('car')

// Seletor para adicionar entregas à rota manualmente
const deliveryToAddByRoute = ref<Record<string, string>>({})

const ROUTE_COLORS = [
    '#2563eb', // Azul
    '#10b981', // Esmeralda
    '#f59e0b', // Âmbar
    '#8b5cf6', // Roxo
    '#ec4899', // Rosa
    '#06b6d4', // Ciano
    '#f97316', // Laranja
    '#6366f1'  // Índigo
]

const clientsById = computed(() => new Map(clients.value.map(c => [c.id, c])))
const deliveriesById = computed(() => new Map(deliveries.value.map(d => [d.id, d])))
const vehiclesById = computed(() => new Map(vehicles.value.map(v => [v.id, v])))

// Entregas pendentes válidas (com coordenadas e status pending)
const validPendingDeliveries = computed(() => {
    return deliveries.value.filter(d =>
        d.latitude != null &&
        d.longitude != null &&
        d.status === 'pending'
    )
})

// Props formatadas para o mapa
const mapDepots = computed(() => {
    return depots.value.map(d => ({
        id: d.id,
        name: d.name,
        latitude: d.latitude,
        longitude: d.longitude,
        address: d.address_line ? `${d.address_line}, ${d.address_number || ''}` : undefined,
        city: d.city || undefined
    }))
})

const mapDeliveries = computed(() => {
    return validPendingDeliveries.value.map(d => {
        const recipient = clientsById.value.get(d.recipient_id)
        return {
            id: d.id,
            latitude: d.latitude!,
            longitude: d.longitude!,
            invoiceNumber: d.invoice_number || 'Sem Nota',
            clientName: recipient?.trade_name || recipient?.name || 'Cliente',
            address: d.delivery_address || undefined,
            city: d.delivery_city || undefined,
            weight: Number(d.weight) || 0,
            volume: Number(d.volume) || 0,
            status: d.status
        }
    })
})

const mapRoutes = computed(() => {
    return savedRoutes.value.map((r, index) => {
        const vehicle = r.vehicle_id ? vehiclesById.value.get(r.vehicle_id) : null
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length] ?? '#2563eb'

        const points = (r.route_points || [])
            .sort((a, b) => a.position - b.position)
            .map(pt => {
                const delivery = deliveriesById.value.get(pt.delivery_id)
                const recipient = delivery ? clientsById.value.get(delivery.recipient_id) : null
                return {
                    deliveryId: pt.delivery_id,
                    position: pt.position,
                    latitude: delivery?.latitude ?? 0,
                    longitude: delivery?.longitude ?? 0,
                    invoiceNumber: delivery?.invoice_number ?? 'S/N',
                    clientName: recipient?.trade_name ?? recipient?.name ?? 'Cliente'
                }
            })
            .filter(pt => pt.latitude !== 0 && pt.longitude !== 0)

        return {
            id: r.id,
            vehicleId: r.vehicle_id ?? '',
            vehiclePlate: vehicle?.plate ?? `Veículo #${index + 1}`,
            color,
            geometry: r.geometry ?? undefined,
            distance: Number(r.distance) || 0,
            duration: Number(r.duration) || 0,
            points
        }
    })
})

const routesSummary = computed(() => {
    const totalDistanceMeters = savedRoutes.value.reduce((acc, r) => acc + (Number(r.distance) || 0), 0)
    const totalDurationSeconds = savedRoutes.value.reduce((acc, r) => acc + (Number(r.duration) || 0), 0)
    const totalPoints = savedRoutes.value.reduce((acc, r) => acc + (r.route_points?.length || 0), 0)

    return {
        totalDistanceKm: (totalDistanceMeters / 1000).toFixed(1),
        totalDurationHours: (totalDurationSeconds / 3600).toFixed(1),
        totalRoutes: savedRoutes.value.length,
        totalDeliveriesRouted: totalPoints
    }
})

async function loadPageData() {
    if (!activeOrganizationId.value) return

    loadingData.value = true

    try {
        const [depotsRes, vehiclesRes, deliveriesRes, clientsRes, routesRes] = await Promise.all([
            supabase.from('depots').select('*').eq('organization_id', activeOrganizationId.value).order('name'),
            supabase.from('vehicles').select('*').eq('organization_id', activeOrganizationId.value).order('plate'),
            supabase.from('deliveries').select('*').eq('organization_id', activeOrganizationId.value).order('created_at', { ascending: false }),
            supabase.from('clients').select('*').eq('organization_id', activeOrganizationId.value),
            supabase.from('routes').select('*, route_points(*)').eq('organization_id', activeOrganizationId.value).order('created_at', { ascending: false })
        ])

        if (depotsRes.error) throw depotsRes.error
        if (vehiclesRes.error) throw vehiclesRes.error
        if (deliveriesRes.error) throw deliveriesRes.error
        if (clientsRes.error) throw clientsRes.error
        if (routesRes.error) throw routesRes.error

        depots.value = depotsRes.data || []
        vehicles.value = vehiclesRes.data || []
        deliveries.value = deliveriesRes.data || []
        clients.value = clientsRes.data || []
        savedRoutes.value = (routesRes.data as any) || []

        if (depots.value.length > 0 && depots.value[0] && !selectedStartDepotId.value) {
            selectedStartDepotId.value = depots.value[0].id
            selectedEndDepotId.value = depots.value[0].id
        }

        if (vehicles.value.length > 0 && selectedVehicleIds.value.length === 0) {
            selectedVehicleIds.value = vehicles.value.map(v => v.id)
        }

        if (validPendingDeliveries.value.length > 0 && selectedDeliveryIds.value.length === 0) {
            selectedDeliveryIds.value = validPendingDeliveries.value.map(d => d.id)
        }

        if (savedRoutes.value.length > 0 && activeTab.value === 'config') {
            activeTab.value = 'routes'
        }
    } catch (error) {
        toast.add({
            title: 'Erro ao carregar dados',
            description: getErrorMessage(error),
            color: 'error',
            icon: 'i-lucide-circle-alert'
        })
    } finally {
        loadingData.value = false
    }
}

/**
 * 1. OTIMIZAÇÃO AUTOMÁTICA VIA VROOM (VRP Solver)
 */
async function runVroomOptimization() {
    if (!activeOrganizationId.value) return

    if (!selectedStartDepotId.value) {
        toast.add({ title: 'Atenção', description: 'Selecione um depósito de saída.', color: 'warning' })
        return
    }

    if (selectedVehicleIds.value.length === 0) {
        toast.add({ title: 'Atenção', description: 'Selecione ao menos um veículo.', color: 'warning' })
        return
    }

    if (selectedDeliveryIds.value.length === 0) {
        toast.add({ title: 'Atenção', description: 'Selecione entregas pendentes.', color: 'warning' })
        return
    }

    optimizing.value = true

    try {
        const { data, error } = await supabase.functions.invoke('optmize-routes', {
            body: {
                organizationId: activeOrganizationId.value,
                startDepotId: selectedStartDepotId.value,
                endDepotId: selectedEndDepotId.value || selectedStartDepotId.value,
                vehicleIds: selectedVehicleIds.value,
                deliveryIds: selectedDeliveryIds.value,
                saveRoutes: true,
                updateDeliveryStatus: true,
                serviceDuration: serviceDurationMinutes.value * 60,
                vehicleProfile: vehicleProfile.value,
                mode: 'optimize'
            }
        })

        if (error) throw error
        if (data && data.error) throw new Error(data.error)

        const totalKm = (data.summary?.totalDistance ? data.summary.totalDistance / 1000 : 0).toFixed(1)
        toast.add({
            title: 'Roteirização Otimizada (VROOM)!',
            description: `${data.summary?.routesCount || 0} rota(s) gerada(s) totalizando ${totalKm} km.`,
            color: 'success',
            icon: 'i-lucide-check-circle'
        })

        await loadPageData()
        activeTab.value = 'routes'
        if (mapRef.value) setTimeout(() => mapRef.value.fitMarkers(), 300)
    } catch (err) {
        toast.add({
            title: 'Erro na Roteirização',
            description: getErrorMessage(err),
            color: 'error',
            icon: 'i-lucide-alert-triangle'
        })
    } finally {
        optimizing.value = false
    }
}

/**
 * 2. VROOM PLAN MODE: REAVALIAR E RECALCULAR ROTAS APÓS EDIÇÃO MANUAL
 */
async function runVroomPlanMode() {
    if (!activeOrganizationId.value || savedRoutes.value.length === 0) return

    evaluatingPlan.value = true

    try {
        const plannedRoutes = savedRoutes.value
            .filter((r): r is typeof r & { vehicle_id: string } => Boolean(r.vehicle_id))
            .map(r => ({
                vehicleId: r.vehicle_id,
                deliveryIds: (r.route_points || [])
                    .sort((a, b) => a.position - b.position)
                    .map(pt => pt.delivery_id)
                    .filter((id): id is string => Boolean(id))
            }))
            .filter(pr => pr.deliveryIds.length > 0)

        if (plannedRoutes.length === 0) {
            toast.add({ title: 'Atenção', description: 'Nenhuma rota válida com entregas para recalcular.', color: 'warning' })
            return
        }

        const defaultDepotId = depots.value[0]?.id ?? ''
        const startDepot = selectedStartDepotId.value || defaultDepotId
        const endDepot = selectedEndDepotId.value || startDepot

        const { data, error } = await supabase.functions.invoke('optmize-routes', {
            body: {
                organizationId: activeOrganizationId.value,
                startDepotId: startDepot,
                endDepotId: endDepot,
                vehicleIds: plannedRoutes.map(pr => pr.vehicleId),
                saveRoutes: true,
                updateDeliveryStatus: true,
                serviceDuration: serviceDurationMinutes.value * 60,
                vehicleProfile: vehicleProfile.value,
                mode: 'plan',
                plannedRoutes
            }
        })

        if (error) throw error
        if (data && data.error) throw new Error(data.error)

        toast.add({
            title: 'Rotas Recalculadas (Modo Plano VROOM)!',
            description: 'Trajeto, tempos e distâncias recalculados para a ordem manual.',
            color: 'success',
            icon: 'i-lucide-refresh-cw'
        })

        await loadPageData()
        if (mapRef.value) setTimeout(() => mapRef.value.fitMarkers(), 300)
    } catch (err) {
        toast.add({
            title: 'Erro ao recalcular plano de rotas',
            description: getErrorMessage(err),
            color: 'error'
        })
    } finally {
        evaluatingPlan.value = false
    }
}

/**
 * 3. AÇÕES DE EDIÇÃO MANUAL DE ROTAS (Subir, Descer, Remover, Adicionar)
 */
function moveStopUp(routeIndex: number, pointIndex: number) {
    if (pointIndex <= 0) return
    const route = savedRoutes.value[routeIndex]
    if (!route || !route.route_points) return

    const points = [...route.route_points].sort((a, b) => a.position - b.position)
    if (pointIndex >= points.length) return

    const temp = points[pointIndex]
    const prev = points[pointIndex - 1]
    if (!temp || !prev) return

    points[pointIndex] = prev
    points[pointIndex - 1] = temp

    points.forEach((pt, idx) => { pt.position = idx })
    route.route_points = points
}

function moveStopDown(routeIndex: number, pointIndex: number) {
    const route = savedRoutes.value[routeIndex]
    if (!route || !route.route_points) return
    const points = [...route.route_points].sort((a, b) => a.position - b.position)
    if (pointIndex >= points.length - 1) return

    const temp = points[pointIndex]
    const next = points[pointIndex + 1]
    if (!temp || !next) return

    points[pointIndex] = next
    points[pointIndex + 1] = temp

    points.forEach((pt, idx) => { pt.position = idx })
    route.route_points = points
}

async function removeStopFromRoute(routeIndex: number, pointIndex: number) {
    const route = savedRoutes.value[routeIndex]
    if (!route || !route.route_points) return

    const points = [...route.route_points].sort((a, b) => a.position - b.position)
    if (pointIndex < 0 || pointIndex >= points.length) return

    const removed = points.splice(pointIndex, 1)[0]
    points.forEach((pt, idx) => { pt.position = idx })
    route.route_points = points

    if (removed?.delivery_id) {
        await supabase.from('deliveries').update({ status: 'pending' }).eq('id', removed.delivery_id)
    }

    toast.add({ title: 'Entrega removida da rota', color: 'info' })
}

function addDeliveryToRoute(routeIndex: number) {
    const route = savedRoutes.value[routeIndex]
    if (!route || !route.id) return

    const deliveryId = deliveryToAddByRoute.value[route.id]
    if (!deliveryId) return

    const points = [...(route.route_points || [])].sort((a, b) => a.position - b.position)

    if (points.some(p => p.delivery_id === deliveryId)) return

    points.push({
        id: `temp-${Date.now()}`,
        organization_id: activeOrganizationId.value ?? '',
        route_id: route.id,
        delivery_id: deliveryId,
        position: points.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    })

    route.route_points = points
    deliveryToAddByRoute.value[route.id] = ''
}

/**
 * 4. HANDLER DE SELEÇÃO POR ÁREA DESENHADA NO MAPA
 */
function handleSelectInArea(enclosedIds: string[]) {
    if (!enclosedIds || enclosedIds.length === 0) {
        toast.add({
            title: 'Nenhuma entrega encontrada',
            description: 'A área desenhada não abrangeu entregas pendentes.',
            color: 'warning'
        })
        return
    }

    const newSelection = Array.from(new Set([...selectedDeliveryIds.value, ...enclosedIds]))
    selectedDeliveryIds.value = newSelection

    toast.add({
        title: 'Entregas Selecionadas no Mapa!',
        description: `${enclosedIds.length} entrega(s) selecionada(s) dentro da área.`,
        color: 'success',
        icon: 'i-lucide-map-pin'
    })

    activeTab.value = 'config'
}

function toggleSelectAllDeliveries() {
    if (selectedDeliveryIds.value.length === validPendingDeliveries.value.length) {
        selectedDeliveryIds.value = []
    } else {
        selectedDeliveryIds.value = validPendingDeliveries.value.map(d => d.id)
    }
}

function toggleSelectAllVehicles() {
    if (selectedVehicleIds.value.length === vehicles.value.length) {
        selectedVehicleIds.value = []
    } else {
        selectedVehicleIds.value = vehicles.value.map(v => v.id)
    }
}

function focusRouteOnMap(routeId: string) {
    activeRouteId.value = activeRouteId.value === routeId ? null : routeId
    if (mapRef.value && activeRouteId.value) {
        mapRef.value.fitRoute(activeRouteId.value)
    } else if (mapRef.value) {
        mapRef.value.fitMarkers()
    }
}

function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}min`
    return `${mins} min`
}

function formatDistance(meters: number) {
    return `${(meters / 1000).toFixed(1)} km`
}

function getErrorMessage(error: unknown) {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message
    }
    return 'Ocorreu um erro inesperado.'
}

watch(activeOrganizationId, loadPageData, { immediate: true })
</script>

<template>
    <UDashboardPanel id="routing" class="h-full">
        <template #header>
            <UDashboardNavbar title="Roteirização ERP & Edição VROOM">
                <template #right>
                    <div class="flex items-center gap-2">
                        <UButton label="Atualizar" icon="i-lucide-refresh-cw" color="neutral" variant="outline"
                            :loading="loadingData" @click="loadPageData" />
                        <UButton label="Gerar Rotas Otimizadas" icon="i-lucide-zap" color="primary"
                            :loading="optimizing"
                            :disabled="!activeOrganizationId || validPendingDeliveries.length === 0 || vehicles.length === 0"
                            @click="runVroomOptimization" />
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[650px]">
                <!-- PAINEL LATERAL ESQUERDO -->
                <div
                    class="w-full lg:w-[440px] flex flex-col gap-4 bg-surface rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <!-- TAB NAVIGATION -->
                    <div class="flex border-b border-slate-200 dark:border-slate-800 pb-2 gap-2">
                        <button
                            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                            :class="activeTab === 'config' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                            @click="activeTab = 'config'">
                            <UIcon name="i-lucide-sliders" class="w-4 h-4" />
                            Configuração
                        </button>
                        <button
                            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors relative"
                            :class="activeTab === 'routes' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                            @click="activeTab = 'routes'">
                            <UIcon name="i-lucide-route" class="w-4 h-4" />
                            Rotas & Edição
                            <span v-if="savedRoutes.length > 0"
                                class="ml-1 px-1.5 py-0.2 bg-primary-500 text-white text-[10px] rounded-full font-bold">
                                {{ savedRoutes.length }}
                            </span>
                        </button>
                    </div>

                    <!-- TAB 1: CONFIGURAÇÃO DE ROTEAMENTO -->
                    <div v-if="activeTab === 'config'" class="flex-1 overflow-y-auto pr-1 space-y-5">
                        <UAlert v-if="!activeOrganizationId" color="warning" variant="subtle" icon="i-lucide-building-2"
                            title="Selecione uma organização"
                            description="Escolha uma organização para gerenciar depósitos, veículos e entregas." />

                        <template v-else>
                            <!-- DEPÓSITOS -->
                            <div class="space-y-3">
                                <h3
                                    class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <UIcon name="i-lucide-warehouse" class="w-4 h-4 text-emerald-500" />
                                    Depósitos de Origem & Destino
                                </h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-[11px] font-medium text-slate-500 block mb-1">Depósito
                                            Inicial</label>
                                        <select v-model="selectedStartDepotId"
                                            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 focus:ring-2 focus:ring-primary-500">
                                            <option v-for="depot in depots" :key="depot.id" :value="depot.id">
                                                {{ depot.name }} ({{ depot.city || 'Sem cidade' }})
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-[11px] font-medium text-slate-500 block mb-1">Depósito
                                            Final</label>
                                        <select v-model="selectedEndDepotId"
                                            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 focus:ring-2 focus:ring-primary-500">
                                            <option v-for="depot in depots" :key="depot.id" :value="depot.id">
                                                {{ depot.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- VEÍCULOS -->
                            <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div class="flex items-center justify-between">
                                    <h3
                                        class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <UIcon name="i-lucide-truck" class="w-4 h-4 text-blue-500" />
                                        Frota de Veículos ({{ selectedVehicleIds.length }}/{{ vehicles.length }})
                                    </h3>
                                    <button class="text-[11px] text-primary-500 hover:underline"
                                        @click="toggleSelectAllVehicles">
                                        {{ selectedVehicleIds.length === vehicles.length ? 'Desmarcar' : 'Marcar todos'
                                        }}
                                    </button>
                                </div>

                                <div v-if="vehicles.length === 0" class="text-xs text-slate-400 py-2">
                                    Nenhum veículo cadastrado.
                                </div>

                                <div v-else
                                    class="max-h-32 overflow-y-auto space-y-1 border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                                    <label v-for="v in vehicles" :key="v.id"
                                        class="flex items-center justify-between p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer text-xs">
                                        <div class="flex items-center gap-2">
                                            <input v-model="selectedVehicleIds" type="checkbox" :value="v.id"
                                                class="rounded border-slate-300 text-primary-600">
                                            <span class="font-bold font-mono text-slate-800 dark:text-slate-200">{{
                                                v.plate }}</span>
                                        </div>
                                        <span class="text-[10px] text-slate-400">
                                            Cap: {{ v.weight_capacity ? `${v.weight_capacity}kg` : 'Ilimitada' }}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <!-- ENTREGAS PENDENTES COM BOTÃO SELEÇÃO POR ÁREA -->
                            <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div class="flex items-center justify-between">
                                    <h3
                                        class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <UIcon name="i-lucide-package" class="w-4 h-4 text-amber-500" />
                                        Entregas Pendentes ({{ selectedDeliveryIds.length }}/{{
                                            validPendingDeliveries.length }})
                                    </h3>
                                    <button class="text-[11px] text-primary-500 hover:underline"
                                        @click="toggleSelectAllDeliveries">
                                        {{ selectedDeliveryIds.length === validPendingDeliveries.length ? 'Desmarcar' :
                                            'Marcar todas' }}
                                    </button>
                                </div>

                                <div
                                    class="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                                        <UIcon name="i-lucide-polygon" class="w-4 h-4 text-blue-600" />
                                        <span>Seleção por Área no Mapa</span>
                                    </div>
                                    <UButton label="Desenhar Área" icon="i-lucide-pencil" size="xs" color="primary"
                                        variant="soft" @click="mapRef?.toggleDrawingMode()" />
                                </div>

                                <div v-if="validPendingDeliveries.length === 0"
                                    class="text-xs text-slate-400 py-3 text-center border border-dashed rounded-lg">
                                    Nenhuma entrega pendente com coordenadas disponíveis.
                                </div>

                                <div v-else
                                    class="max-h-48 overflow-y-auto space-y-1 border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                                    <label v-for="d in validPendingDeliveries" :key="d.id"
                                        class="flex items-center justify-between p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer text-xs">
                                        <div class="flex items-center gap-2">
                                            <input v-model="selectedDeliveryIds" type="checkbox" :value="d.id"
                                                class="rounded border-slate-300 text-primary-600">
                                            <div>
                                                <p class="font-bold text-slate-800 dark:text-slate-200">NF {{
                                                    d.invoice_number || 'S/N' }}</p>
                                                <p class="text-[10px] text-slate-400 truncate max-w-[170px]">{{
                                                    d.delivery_address || d.delivery_city }}</p>
                                            </div>
                                        </div>
                                        <span class="text-[10px] font-mono text-slate-500">{{ Number(d.weight || 0) }}
                                            kg</span>
                                    </label>
                                </div>
                            </div>

                            <!-- OPÇÕES AVANÇADAS DO VROOM -->
                            <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Opções do VROOM
                                </h3>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-[11px] font-medium text-slate-500 block mb-1">Tempo/Parada
                                            (min)</label>
                                        <input v-model.number="serviceDurationMinutes" type="number" min="1" max="60"
                                            class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2">
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>

                    <!-- TAB 2: ROTAS GERADAS E EDIÇÃO MANUAL COM VROOM PLAN MODE -->
                    <div v-else-if="activeTab === 'routes'" class="flex-1 overflow-y-auto pr-1 space-y-4">
                        <div v-if="savedRoutes.length === 0"
                            class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                            <UIcon name="i-lucide-route" class="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
                            <p class="font-semibold text-sm text-slate-700 dark:text-slate-300">Nenhuma Rota Gerada</p>
                            <p class="text-xs mt-1 max-w-xs">Configure os parâmetros na aba de configuração e clique em
                                "Gerar Rotas
                                Otimizadas".</p>
                        </div>

                        <template v-else>
                            <!-- BARRA DE REAVALIAÇÃO DO MODO PLANO -->
                            <div
                                class="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                                <div>
                                    <span class="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">Edição
                                        Manual de Rotas</span>
                                    <span class="text-[10px] text-indigo-600 dark:text-indigo-400">Recalcule horários e
                                        trajetos usando VROOM Plan Mode</span>
                                </div>
                                <UButton label="Recalcular (Plan Mode)" icon="i-lucide-refresh-cw" color="secondary"
                                    size="xs" :loading="evaluatingPlan" @click="runVroomPlanMode" />
                            </div>

                            <!-- RESUMO DE MÉTRICAS -->
                            <div
                                class="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center">
                                <div>
                                    <span class="text-[10px] text-slate-400 uppercase font-bold block">Distância</span>
                                    <span class="text-sm font-extrabold text-primary-600 dark:text-primary-400">{{
                                        routesSummary.totalDistanceKm }} km</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-slate-400 uppercase font-bold block">Tempo</span>
                                    <span class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{{
                                        routesSummary.totalDurationHours }}h</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-slate-400 uppercase font-bold block">Paradas</span>
                                    <span class="text-sm font-extrabold text-purple-600 dark:text-purple-400">{{
                                        routesSummary.totalDeliveriesRouted }}</span>
                                </div>
                            </div>

                            <!-- CARDS DE CADA ROTA COM EDIÇÃO DE SEQUÊNCIA -->
                            <div class="space-y-4">
                                <div v-for="(route, rIdx) in savedRoutes" :key="route.id"
                                    class="border rounded-xl p-3 bg-white dark:bg-slate-900/40 space-y-3"
                                    :class="activeRouteId === route.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 dark:border-slate-800'">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="w-3.5 h-3.5 rounded-full shadow-sm"
                                                :style="{ backgroundColor: ROUTE_COLORS[rIdx % ROUTE_COLORS.length] || '#2563eb' }" />
                                            <h4 class="font-bold text-sm font-mono text-slate-900 dark:text-slate-100">
                                                {{ route.vehicle_id ? vehiclesById.get(route.vehicle_id)?.plate :
                                                    'Veículo' }}
                                            </h4>
                                        </div>
                                        <button
                                            class="text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                                            @click="focusRouteOnMap(route.id)">
                                            <UIcon name="i-lucide-eye" class="w-3.5 h-3.5" />
                                            Ver no mapa
                                        </button>
                                    </div>

                                    <div class="flex items-center justify-between text-xs text-slate-500 px-1">
                                        <span>Distância: {{ formatDistance(Number(route.distance) || 0) }}</span>
                                        <span>Tempo: {{ formatDuration(Number(route.duration) || 0) }}</span>
                                    </div>

                                    <!-- PARADAS COM BOTÕES SUBIR, DESCER E REMOVER -->
                                    <div class="space-y-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                                        <div v-for="(pt, pIdx) in (route.route_points || []).sort((a, b) => a.position - b.position)"
                                            :key="pt.id || pt.delivery_id"
                                            class="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <div class="flex items-center gap-2 truncate">
                                                <span
                                                    class="w-5 h-5 rounded-full text-[10px] font-bold font-mono text-white flex items-center justify-center shrink-0"
                                                    :style="{ backgroundColor: ROUTE_COLORS[rIdx % ROUTE_COLORS.length] || '#2563eb' }">
                                                    {{ pIdx + 1 }}
                                                </span>
                                                <div class="truncate">
                                                    <p class="font-medium truncate text-slate-800 dark:text-slate-200">
                                                        NF {{ deliveriesById.get(pt.delivery_id)?.invoice_number ||
                                                            'S/N' }}
                                                    </p>
                                                    <p class="text-[10px] text-slate-400 truncate">
                                                        {{
                                                            clientsById.get(deliveriesById.get(pt.delivery_id)?.recipient_id
                                                                || '')?.trade_name ||
                                                            deliveriesById.get(pt.delivery_id)?.delivery_city }}
                                                    </p>
                                                </div>
                                            </div>

                                            <!-- CONTROLES DE REORDENAÇÃO -->
                                            <div class="flex items-center gap-1 shrink-0">
                                                <button
                                                    class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                                                    :disabled="pIdx === 0" title="Mover para cima"
                                                    @click="moveStopUp(rIdx, pIdx)">
                                                    <UIcon name="i-lucide-arrow-up" class="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    class="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                                                    :disabled="pIdx === (route.route_points?.length || 0) - 1"
                                                    title="Mover para baixo" @click="moveStopDown(rIdx, pIdx)">
                                                    <UIcon name="i-lucide-arrow-down" class="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    class="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950"
                                                    title="Remover da rota" @click="removeStopFromRoute(rIdx, pIdx)">
                                                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- ADICIONAR ENTREGA PENDENTE À ROTA -->
                                    <div v-if="validPendingDeliveries.length > 0" class="pt-2 flex items-center gap-2">
                                        <select v-model="deliveryToAddByRoute[route.id]"
                                            class="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-1.5">
                                            <option value="">+ Adicionar entrega à rota...</option>
                                            <option v-for="d in validPendingDeliveries" :key="d.id" :value="d.id">
                                                NF {{ d.invoice_number || 'S/N' }} - {{ d.delivery_city }} ({{ d.weight
                                                }}kg)
                                            </option>
                                        </select>
                                        <button
                                            class="bg-primary-600 hover:bg-primary-700 text-white font-bold px-2 py-1.5 rounded-lg text-xs disabled:opacity-40"
                                            :disabled="!deliveryToAddByRoute[route.id]"
                                            @click="addDeliveryToRoute(rIdx)">
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- PAINEL DIREITO: MAPA INTERATIVO MAPBOX -->
                <div class="flex-1 h-full min-h-[500px] relative rounded-xl overflow-hidden shadow-md">
                    <MapboxMap ref="mapRef" :depots="mapDepots" :deliveries="mapDeliveries" :routes="mapRoutes"
                        :active-route-id="activeRouteId" :selected-delivery-ids="selectedDeliveryIds"
                        @select-in-area="handleSelectInArea" />
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>