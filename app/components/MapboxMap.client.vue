<script setup lang="ts">
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type Coordinates = [
  longitude: number,
  latitude: number
]

type DeliveryMarker = {
  id: string
  latitude: number
  longitude: number
  invoiceNumber: string
}

type Marker = {
  id: string
  latitude: number
  longitude: number
}

const props = withDefaults(
  defineProps<{
    center?: Coordinates
    zoom?: number
    markers?: Marker[]
    deliveries?: DeliveryMarker[]
  }>(),
  {
    center: () =>
      [-38.5267, -3.7319] as Coordinates,
    zoom: 12,
    markers: () => [],
    deliveries: () => []
  }
)

const emit = defineEmits<{
  loaded: [map: mapboxgl.Map]
}>()

const config = useRuntimeConfig()

const mapContainer =
  ref<HTMLDivElement | null>(null)

let map: mapboxgl.Map | null = null
let mapLoaded = false
let renderedMarkers: mapboxgl.Marker[] = []

function parseCoordinate(
  value: unknown
): number | null {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null
  }

  const parsed =
    typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

function getValidCoordinates(
  latitudeValue: unknown,
  longitudeValue: unknown
): Coordinates | null {
  const latitude =
    parseCoordinate(latitudeValue)

  const longitude =
    parseCoordinate(longitudeValue)

  if (
    latitude === null ||
    longitude === null
  ) {
    return null
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  return [
    longitude,
    latitude
  ]
}

function clearMarkers() {
  for (const marker of renderedMarkers) {
    marker.remove()
  }

  renderedMarkers = []
}

function createDeliveryPopup(
  invoiceNumber: string
) {
  const container =
    document.createElement('div')

  const title =
    document.createElement('strong')

  title.textContent = 'Nota fiscal'

  const value =
    document.createElement('p')

  value.textContent = invoiceNumber
  value.style.margin = '4px 0 0'

  container.append(title, value)

  return new mapboxgl.Popup({
    offset: 24
  }).setDOMContent(container)
}

function renderMarkers() {
  if (!map || !mapLoaded) {
    return
  }

  clearMarkers()

  for (const markerData of props.markers) {
    const coordinates = getValidCoordinates(
      markerData.latitude,
      markerData.longitude
    )

    if (!coordinates) {
      console.warn(
        'Marcador com coordenadas inválidas:',
        markerData
      )

      continue
    }

    const marker = new mapboxgl.Marker({
      color: '#64748b'
    })
      .setLngLat(coordinates)
      .addTo(map)

    renderedMarkers.push(marker)
  }

  for (const delivery of props.deliveries) {
    const coordinates = getValidCoordinates(
      delivery.latitude,
      delivery.longitude
    )

    if (!coordinates) {
      console.warn(
        'Entrega com coordenadas inválidas:',
        delivery
      )

      continue
    }

    const popup = createDeliveryPopup(
      delivery.invoiceNumber
    )

    const marker = new mapboxgl.Marker({
      color: '#2563eb'
    })
      .setLngLat(coordinates)
      .setPopup(popup)
      .addTo(map)

    renderedMarkers.push(marker)
  }
}

function getAllMarkerCoordinates(): Coordinates[] {
  const coordinates: Coordinates[] = []

  for (const marker of props.markers) {
    const markerCoordinates =
      getValidCoordinates(
        marker.latitude,
        marker.longitude
      )

    if (markerCoordinates) {
      coordinates.push(markerCoordinates)
    }
  }

  for (const delivery of props.deliveries) {
    const deliveryCoordinates =
      getValidCoordinates(
        delivery.latitude,
        delivery.longitude
      )

    if (deliveryCoordinates) {
      coordinates.push(deliveryCoordinates)
    }
  }

  return coordinates
}

function fitMarkers() {
  if (!map || !mapLoaded) {
    return
  }

  const coordinates =
    getAllMarkerCoordinates()

  if (coordinates.length === 0) {
    return
  }

  if (coordinates.length === 1) {
    map.easeTo({
      center: coordinates[0],
      zoom: Math.max(props.zoom, 14),
      duration: 500
    })

    return
  }

  const bounds =
    new mapboxgl.LngLatBounds()

  for (const coordinate of coordinates) {
    bounds.extend(coordinate)
  }

  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 15,
    duration: 700
  })
}

function resize() {
  map?.resize()
}

function getMap() {
  return map
}

watch(
  () => props.center,
  newCenter => {
    if (!map || !mapLoaded || !newCenter) {
      return
    }

    const coordinates =
      getValidCoordinates(
        newCenter[1],
        newCenter[0]
      )

    if (!coordinates) {
      return
    }

    map.easeTo({
      center: coordinates,
      zoom: props.zoom,
      duration: 400
    })
  },
  {
    deep: true
  }
)

watch(
  () => props.zoom,
  newZoom => {
    if (
      !map ||
      !mapLoaded ||
      !Number.isFinite(newZoom)
    ) {
      return
    }

    map.setZoom(newZoom)
  }
)

watch(
  [
    () => props.markers,
    () => props.deliveries
  ],
  () => {
    renderMarkers()
  },
  {
    deep: true
  }
)

onMounted(() => {
  if (!mapContainer.value) {
    return
  }

  const accessToken =
    config.public.mapboxAccessToken as
    | string
    | undefined

  if (!accessToken) {
    console.error(
      'O token público do Mapbox não está configurado.'
    )

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

  map.addControl(
    new mapboxgl.NavigationControl(),
    'top-right'
  )

  map.once('load', () => {
    mapLoaded = true

    renderMarkers()
    map?.resize()

    if (map) {
      emit('loaded', map)
    }
  })

  map.on('error', event => {
    console.error(
      'Erro no Mapbox:',
      event.error
    )
  })
})

onBeforeUnmount(() => {
  clearMarkers()

  map?.remove()
  map = null
  mapLoaded = false
})

defineExpose({
  getMap,
  resize,
  fitMarkers,
  renderMarkers
})
</script>

<template>
  <div ref="mapContainer" class="h-full min-h-[450px] w-full" />
</template>