<script setup lang="ts">
import type GeoJSON from 'geojson'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export type Coordinates = [longitude: number, latitude: number]

export type MapDepot = {
    id: string
    name: string
    latitude: number
    longitude: number
    address?: string
    city?: string
}

export type MapDelivery = {
    id: string
    latitude: number
    longitude: number
    invoiceNumber: string
    clientName?: string
    address?: string
    city?: string
    weight?: number
    volume?: number
    status?: string
}

export type MapRoutePoint = {
    deliveryId: string
    position: number
    latitude: number
    longitude: number
    invoiceNumber?: string
    clientName?: string
    arrival?: number
}

export type MapRoute = {
    id?: string
    vehicleId: string
    vehiclePlate?: string
    color: string
    geometry?: string | Coordinates[]
    distance?: number
    duration?: number
    points: MapRoutePoint[]
}

const props = withDefaults(
    defineProps<{
        center?: Coordinates
        zoom?: number
        depots?: MapDepot[]
        deliveries?: MapDelivery[]
        routes?: MapRoute[]
        activeRouteId?: string | null
        selectedDeliveryIds?: string[]
    }>(),
    {
        center: () => [-38.5267, -3.7319] as Coordinates,
        zoom: 12,
        depots: () => [],
        deliveries: () => [],
        routes: () => [],
        activeRouteId: null,
        selectedDeliveryIds: () => []
    }
)

const emit = defineEmits<{
    loaded: [map: mapboxgl.Map]
    selectDelivery: [id: string]
    selectRoute: [id: string]
    selectInArea: [ids: string[]]
}>()

const config = useRuntimeConfig()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: mapboxgl.Map | null = null
let mapLoaded = false
let renderedMarkers: mapboxgl.Marker[] = []
let addedSourceIds: string[] = []
let addedLayerIds: string[] = []

const isDrawingMode = ref(false)
const polygonPoints = ref<Coordinates[]>([])

function isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
    if (!polygon || polygon.length < 3) return false
    const [x, y] = point
    let inside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const p1 = polygon[i]
        const p2 = polygon[j]
        if (!p1 || !p2) continue

        const [xi, yi] = p1
        const [xj, yj] = p2

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

        if (intersect) inside = !inside
    }

    return inside
}

function toggleDrawingMode() {
    isDrawingMode.value = !isDrawingMode.value
    if (!isDrawingMode.value) {
        clearPolygon()
    } else if (map) {
        map.getCanvas().style.cursor = 'crosshair'
    }
}

function clearPolygon() {
    polygonPoints.value = []
    if (map) {
        map.getCanvas().style.cursor = ''
        renderPolygonLayer()
    }
}

function renderPolygonLayer() {
    if (!map || !mapLoaded) return

    const sourceId = 'area-selection-src'
    const fillLayerId = 'area-selection-fill'
    const lineLayerId = 'area-selection-line'

    if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId)
    if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)

    if (polygonPoints.value.length === 0) return

    const closedCoords = [...polygonPoints.value]
    if (polygonPoints.value.length >= 3 && polygonPoints.value[0]) {
        closedCoords.push(polygonPoints.value[0])
    }

    const geojson: GeoJSON.Feature = polygonPoints.value.length >= 3
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [closedCoords]
            }
        }
        : {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: closedCoords
            }
        }

    map.addSource(sourceId, {
        type: 'geojson',
        data: geojson
    })

    if (polygonPoints.value.length >= 3) {
        map.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.25
            }
        })
    }

    map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': '#2563eb',
            'line-width': 2.5,
            'line-dasharray': [2, 2]
        }
    })
}

function finishPolygonSelection() {
    if (polygonPoints.value.length < 3) return

    const enclosedDeliveryIds: string[] = []

    for (const delivery of props.deliveries) {
        const coords = getValidCoordinates(delivery.latitude, delivery.longitude)
        if (!coords) continue

        if (isPointInPolygon(coords, polygonPoints.value)) {
            enclosedDeliveryIds.push(delivery.id)
        }
    }

    emit('selectInArea', enclosedDeliveryIds)
    isDrawingMode.value = false
    if (map) map.getCanvas().style.cursor = ''
}

function decodePolyline(encoded: string): Coordinates[] {
    let index = 0
    let lat = 0
    let lng = 0
    const coordinates: Coordinates[] = []
    const factor = 1e5

    while (index < encoded.length) {
        let b: number
        let shift = 0
        let result = 0

        do {
            b = encoded.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)

        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
        lat += dlat

        shift = 0
        result = 0

        do {
            b = encoded.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)

        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
        lng += dlng

        coordinates.push([lng / factor, lat / factor])
    }

    return coordinates
}

function parseCoordinate(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) {
        return null
    }

    const parsed = typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number(value)

    return Number.isFinite(parsed) ? parsed : null
}

function getValidCoordinates(latitudeValue: unknown, longitudeValue: unknown): Coordinates | null {
    const latitude = parseCoordinate(latitudeValue)
    const longitude = parseCoordinate(longitudeValue)

    if (latitude === null || longitude === null) return null
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null

    return [longitude, latitude]
}

function clearMarkers() {
    for (const marker of renderedMarkers) {
        marker.remove()
    }
    renderedMarkers = []
}

function clearRoutes() {
    if (!map || !mapLoaded) return

    for (const layerId of addedLayerIds) {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
        }
    }
    addedLayerIds = []

    for (const sourceId of addedSourceIds) {
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
        }
    }
    addedSourceIds = []
}

function createDepotMarkerElement(name: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'group relative flex items-center justify-center cursor-pointer z-10'
    el.innerHTML = `
        <div class="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg border-2 border-white transition-transform duration-200 group-hover:scale-110">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
            <span class="max-w-[100px] truncate">${name}</span>
        </div>
    `
    return el
}

function createRoutePointMarkerElement(position: number, color: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'group relative flex items-center justify-center cursor-pointer z-10'

    el.innerHTML = `
        <div style="background-color: ${color};" class="w-7 h-7 text-xs border-2 border-white shadow-md rounded-full flex items-center justify-center text-white font-extrabold font-mono transition-transform duration-200 group-hover:scale-125">
            ${position + 1}
        </div>
    `
    return el
}

function createDepotPopup(depot: MapDepot): mapboxgl.Popup {
    const html = `
        <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-100">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div class="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                </div>
                <div>
                    <span class="text-[10px] font-bold tracking-wider text-emerald-600 uppercase">Depósito / Origem</span>
                    <h4 class="text-sm font-bold text-slate-900 leading-tight">${depot.name}</h4>
                </div>
            </div>
            ${depot.address ? `<p class="text-xs text-slate-600 dark:text-slate-300 mt-1">${depot.address}</p>` : ''}
            ${depot.city ? `<p class="text-xs text-slate-400 mt-0.5">${depot.city}</p>` : ''}
        </div>
    `
    return new mapboxgl.Popup({ offset: 16, closeButton: true }).setHTML(html)
}

function createDeliveryPopup(delivery: MapDelivery, routePosition?: number, vehiclePlate?: string): mapboxgl.Popup {
    const isRouted = routePosition !== undefined
    const statusText = isRouted ? `Parada #${routePosition + 1}` : 'Pendente'
    const statusBg = isRouted ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200'

    const html = `
        <div class="p-3 max-w-xs font-sans text-slate-800 dark:text-slate-100">
            <div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nota Fiscal</span>
                    <h4 class="text-sm font-bold text-slate-900 leading-tight">${delivery.invoiceNumber || 'S/N'}</h4>
                </div>
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBg}">
                    ${statusText}
                </span>
            </div>

            ${delivery.clientName ? `
                <div class="mb-1.5">
                    <span class="text-[10px] text-slate-400 block">Cliente / Destinatário</span>
                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${delivery.clientName}</p>
                </div>
            ` : ''}

            ${delivery.address ? `
                <div class="mb-2">
                    <span class="text-[10px] text-slate-400 block">Endereço</span>
                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-snug">${delivery.address}${delivery.city ? `, ${delivery.city}` : ''}</p>
                </div>
            ` : ''}

            ${vehiclePlate ? `
                <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span class="text-slate-400">Veículo:</span>
                    <span class="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200">${vehiclePlate}</span>
                </div>
            ` : ''}

            ${(delivery.weight || delivery.volume) ? `
                <div class="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                    ${delivery.weight ? `<span><strong>Peso:</strong> ${delivery.weight} kg</span>` : ''}
                    ${delivery.volume ? `<span><strong>Vol:</strong> ${delivery.volume} m³</span>` : ''}
                </div>
            ` : ''}
        </div>
    `
    return new mapboxgl.Popup({ offset: 20, closeButton: true }).setHTML(html)
}

function renderAllOnMap() {
    if (!map || !mapLoaded) return

    clearMarkers()
    clearRoutes()

    // 1. Depósitos
    for (const depot of props.depots) {
        const coords = getValidCoordinates(depot.latitude, depot.longitude)
        if (!coords) continue

        const el = createDepotMarkerElement(depot.name)
        const popup = createDepotPopup(depot)

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map)

        renderedMarkers.push(marker)
    }

    // 2. Rotas
    const routedDeliveryIds = new Set<string>()

    if (props.routes && props.routes.length > 0) {
        props.routes.forEach((route, index) => {
            const routeId = route.id || `route-${index}`
            const color = route.color || '#2563eb'

            let pathCoords: Coordinates[] = []

            if (typeof route.geometry === 'string' && route.geometry.length > 0) {
                try {
                    pathCoords = decodePolyline(route.geometry)
                } catch {
                    pathCoords = []
                }
            } else if (Array.isArray(route.geometry)) {
                pathCoords = route.geometry
            }

            if (pathCoords.length === 0 && route.points && route.points.length > 0) {
                pathCoords = route.points
                    .map(p => getValidCoordinates(p.latitude, p.longitude))
                    .filter((c): c is Coordinates => c !== null)
            }

            if (pathCoords.length > 1 && map) {
                const sourceId = `src-${routeId}`
                const layerId = `layer-${routeId}`

                map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: { routeId, vehiclePlate: route.vehiclePlate },
                        geometry: { type: 'LineString', coordinates: pathCoords }
                    }
                })

                map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': color,
                        'line-width': props.activeRouteId === routeId ? 6 : 4,
                        'line-opacity': props.activeRouteId && props.activeRouteId !== routeId ? 0.35 : 0.85
                    }
                })

                addedSourceIds.push(sourceId)
                addedLayerIds.push(layerId)
            }

            (route.points || []).forEach((point) => {
                if (!map) return
                routedDeliveryIds.add(point.deliveryId)
                const coords = getValidCoordinates(point.latitude, point.longitude)
                if (!coords) return

                const el = createRoutePointMarkerElement(point.position, color)
                const popup = createDeliveryPopup(
                    {
                        id: point.deliveryId,
                        latitude: point.latitude,
                        longitude: point.longitude,
                        invoiceNumber: point.invoiceNumber || 'N/A',
                        clientName: point.clientName
                    },
                    point.position,
                    route.vehiclePlate
                )

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat(coords)
                    .setPopup(popup)
                    .addTo(map)

                renderedMarkers.push(marker)
            })
        })
    }

    // 3. Entregas Pendentes
    const selectedIdsSet = new Set(props.selectedDeliveryIds)

    for (const delivery of props.deliveries) {
        if (routedDeliveryIds.has(delivery.id)) continue

        const coords = getValidCoordinates(delivery.latitude, delivery.longitude)
        if (!coords) continue

        const isSelected = selectedIdsSet.has(delivery.id)
        const popup = createDeliveryPopup(delivery)

        const marker = new mapboxgl.Marker({
            color: isSelected ? '#2563eb' : '#f59e0b'
        })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map)

        renderedMarkers.push(marker)
    }

    renderPolygonLayer()
}

function getAllCoordinates(): Coordinates[] {
    const coordinates: Coordinates[] = []

    for (const depot of props.depots) {
        const c = getValidCoordinates(depot.latitude, depot.longitude)
        if (c) coordinates.push(c)
    }

    for (const delivery of props.deliveries) {
        const c = getValidCoordinates(delivery.latitude, delivery.longitude)
        if (c) coordinates.push(c)
    }

    for (const route of props.routes || []) {
        for (const point of route.points || []) {
            const c = getValidCoordinates(point.latitude, point.longitude)
            if (c) coordinates.push(c)
        }
    }

    return coordinates
}

function fitMarkers() {
    if (!map || !mapLoaded) return

    const coordinates = getAllCoordinates()
    if (coordinates.length === 0) return

    if (coordinates.length === 1 && coordinates[0]) {
        map.easeTo({
            center: coordinates[0],
            zoom: 14,
            duration: 500
        })
        return
    }

    const bounds = new mapboxgl.LngLatBounds()
    for (const coordinate of coordinates) {
        bounds.extend(coordinate)
    }

    map.fitBounds(bounds, {
        padding: 70,
        maxZoom: 15,
        duration: 700
    })
}

function fitRoute(routeId: string) {
    if (!map || !mapLoaded) return

    const route = props.routes?.find(r => r.id === routeId)
    if (!route || !route.points || route.points.length === 0) return

    const bounds = new mapboxgl.LngLatBounds()
    route.points.forEach(p => {
        const c = getValidCoordinates(p.latitude, p.longitude)
        if (c) bounds.extend(c)
    })

    map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15,
        duration: 600
    })
}

function resize() {
    map?.resize()
}

watch([() => props.depots, () => props.deliveries, () => props.routes, () => props.activeRouteId, () => props.selectedDeliveryIds], () => {
    renderAllOnMap()
}, { deep: true })

onMounted(() => {
    if (!mapContainer.value) return

    const accessToken = config.public.mapboxAccessToken as string | undefined
    if (!accessToken) {
        console.error('O token público do Mapbox não está configurado.')
        return
    }

    mapboxgl.accessToken = accessToken

    map = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: props.center,
        zoom: props.zoom,
        cooperativeGestures: true
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('click', (e) => {
        if (!isDrawingMode.value) return
        polygonPoints.value.push([e.lngLat.lng, e.lngLat.lat])
        renderPolygonLayer()
    })

    map.once('load', () => {
        mapLoaded = true
        renderAllOnMap()
        fitMarkers()
        if (map) emit('loaded', map)
    })
})

onBeforeUnmount(() => {
    clearMarkers()
    clearRoutes()
    map?.remove()
    map = null
    mapLoaded = false
})

defineExpose({
    getMap: () => map,
    resize,
    fitMarkers,
    fitRoute,
    renderAllOnMap,
    toggleDrawingMode,
    clearPolygon,
    finishPolygonSelection,
    isDrawingMode
})
</script>

<template>
    <div class="relative h-full w-full">
        <!-- BARRA DE FERRAMENTAS FLUTUANTE DE DESENHO DE ÁREA -->
        <div class="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                :class="isDrawingMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'"
                @click="toggleDrawingMode"
            >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a2 2 0 01-2 2 2 2 0 01-2-2V4zm-6 8a2 2 0 114 0v1a2 2 0 01-2 2 2 2 0 01-2-2v-1zm12 0a2 2 0 114 0v1a2 2 0 01-2 2 2 2 0 01-2-2v-1zM4 18a2 2 0 114 0v1a2 2 0 01-2 2 2 2 0 01-2-2v-1z"></path>
                </svg>
                {{ isDrawingMode ? 'Clique no mapa...' : 'Desenhar Área' }}
            </button>

            <template v-if="isDrawingMode || polygonPoints.length > 0">
                <span class="text-[11px] text-slate-400 font-mono">{{ polygonPoints.length }} pontos</span>
                <button
                    v-if="polygonPoints.length >= 3"
                    class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg shadow transition-colors"
                    @click="finishPolygonSelection"
                >
                    Selecionar Entregas
                </button>
                <button
                    class="text-slate-400 hover:text-slate-600 text-xs px-1.5"
                    @click="clearPolygon"
                >
                    Limpar
                </button>
            </template>
        </div>

        <div ref="mapContainer" class="h-full min-h-[500px] w-full rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800" />
    </div>
</template>