<script setup lang="ts">
type Coordinates = [
  longitude: number,
  latitude: number
]

type MapMarker = {
  id: string
  latitude: number
  longitude: number
}

type GeocodeResult = {
  id: string | null
  formattedAddress: string
  latitude: number
  longitude: number
  routingLatitude?: number
  routingLongitude?: number
  accuracy: string | null
  confidence: string | null
}

type GeocodeResponse = {
  success: boolean
  found: boolean
  count: number
  results: GeocodeResult[]
}

export type AddressState = {
  address_line: string
  address_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
  postal_code: string
  latitude?: number | ''
  longitude?: number | ''
}

const props = defineProps<{
  fill?: (force: boolean) => void
}>()

const state = defineModel<AddressState>('state', {
  required: true
})

const supabase = useSupabaseClient()
const toast = useToast()

const searching = ref(false)

const latitudeInput = ref(
  typeof state.value.latitude === 'number'
    ? String(state.value.latitude)
    : ''
)

const longitudeInput = ref(
  typeof state.value.longitude === 'number'
    ? String(state.value.longitude)
    : ''
)

function parseCoordinate(
  value: string | number,
  minimum: number,
  maximum: number
): number | '' {
  if (value === '') {
    return ''
  }

  const normalized =
    typeof value === 'string'
      ? value.trim().replace(',', '.')
      : value

  if (
    normalized === '' ||
    normalized === '-' ||
    normalized === '.' ||
    normalized === '-.'
  ) {
    return ''
  }

  const parsed = Number(normalized)

  if (!Number.isFinite(parsed)) {
    return ''
  }

  if (parsed < minimum || parsed > maximum) {
    return ''
  }

  return parsed
}

function formatCoordinate(
  value: number | '' | undefined
): string {
  return typeof value === 'number'
    ? String(value)
    : ''
}

watch(latitudeInput, value => {
  state.value.latitude = parseCoordinate(
    value,
    -90,
    90
  )
})

watch(longitudeInput, value => {
  state.value.longitude = parseCoordinate(
    value,
    -180,
    180
  )
})

watch(
  () => state.value.latitude,
  value => {
    if (typeof value !== 'number') {
      return
    }

    const currentValue = parseCoordinate(
      latitudeInput.value,
      -90,
      90
    )

    if (currentValue !== value) {
      latitudeInput.value = formatCoordinate(value)
    }
  }
)

watch(
  () => state.value.longitude,
  value => {
    if (typeof value !== 'number') {
      return
    }

    const currentValue = parseCoordinate(
      longitudeInput.value,
      -180,
      180
    )

    if (currentValue !== value) {
      longitudeInput.value = formatCoordinate(value)
    }
  }
)

function normalizeLatitudeInput() {
  const parsed = parseCoordinate(
    latitudeInput.value,
    -90,
    90
  )

  latitudeInput.value =
    typeof parsed === 'number'
      ? String(parsed)
      : ''
}

function normalizeLongitudeInput() {
  const parsed = parseCoordinate(
    longitudeInput.value,
    -180,
    180
  )

  longitudeInput.value =
    typeof parsed === 'number'
      ? String(parsed)
      : ''
}

const validCoordinates = computed<Coordinates | null>(
  () => {
    const latitude = state.value.latitude
    const longitude = state.value.longitude

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number'
    ) {
      return null
    }

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
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
)

const mapCenter = computed<
  Coordinates | undefined
>(() => {
  return validCoordinates.value ?? undefined
})

const mapMarkers = computed<MapMarker[]>(() => {
  const coordinates = validCoordinates.value

  if (!coordinates) {
    return []
  }

  const [longitude, latitude] = coordinates

  return [
    {
      id: 'address-location',
      latitude,
      longitude
    }
  ]
})

async function pesquisar() {
  if (searching.value) {
    return
  }

  searching.value = true

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.access_token) {
      toast.add({
        title: 'Usuário não autenticado',
        description:
          'Entre novamente para pesquisar o endereço.',
        color: 'error'
      })

      return
    }

    const geocodeQuery = {
      street: state.value.address_line,
      number: state.value.address_number,
      neighborhood: state.value.neighborhood,
      city: state.value.city,
      state: state.value.state,
      postalCode: state.value.postal_code,
      limit: 1,
      permanent: true
    }

    const { data, error } =
      await supabase.functions.invoke<GeocodeResponse>(
        'geocode-address',
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          },
          body: geocodeQuery
        }
      )

    if (error) {
      console.error(
        'Erro ao geocodificar o endereço:',
        {
          name: error.name,
          message: error.message,
          context: error.context
        }
      )

      throw error
    }

    const result = data?.results?.[0]

    if (!data?.success || !result) {
      toast.add({
        title: 'Endereço não encontrado',
        description:
          'Verifique o logradouro, número, bairro, cidade, UF e CEP.',
        color: 'warning'
      })

      return
    }

    const latitude =
      result.routingLatitude ??
      result.latitude

    const longitude =
      result.routingLongitude ??
      result.longitude

    state.value.latitude = latitude
    state.value.longitude = longitude
    
    latitudeInput.value = String(latitude)
    longitudeInput.value = String(longitude)

    toast.add({
      title: 'Endereço encontrado',
      description:
        result.formattedAddress ||
        'O endereço foi geocodificado com sucesso.',
      color: 'success'
    })
  } catch (error) {
    console.error(
      'Erro ao chamar a função de geocodificação:',
      error
    )

    toast.add({
      title: 'Erro ao geocodificar',
      description:
        error instanceof Error
          ? error.message
          : 'Não foi possível geocodificar o endereço.',
      color: 'error'
    })
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <div>
    <h3 class="font-medium text-highlighted">
      Endereço
    </h3>

    <p class="text-sm text-muted">
      Esse endereço poderá ser usado automaticamente
      nas entregas.
    </p>

    <UButton
      v-if="props.fill"
      type="button"
      label="Preencher com o endereço do destinatário"
      color="neutral"
      variant="outline"
      class="mt-2 mb-4"
      @click="props.fill(true)"
    />
  </div>

  <div class="grid gap-4 sm:grid-cols-6">
    <UFormField
      name="address_line"
      label="Logradouro"
      class="sm:col-span-4"
    >
      <UInput
        v-model="state.address_line"
        placeholder="Rua, avenida..."
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="address_number"
      label="Número"
      class="sm:col-span-2"
    >
      <UInput
        v-model="state.address_number"
        placeholder="Número"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="address_complement"
      label="Complemento"
      class="sm:col-span-3"
    >
      <UInput
        v-model="state.address_complement"
        placeholder="Sala, galpão..."
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="neighborhood"
      label="Bairro"
      class="sm:col-span-3"
    >
      <UInput
        v-model="state.neighborhood"
        placeholder="Bairro"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="city"
      label="Cidade"
      class="sm:col-span-3"
    >
      <UInput
        v-model="state.city"
        placeholder="Cidade"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="state"
      label="UF"
      class="sm:col-span-1"
    >
      <UInput
        v-model="state.state"
        maxlength="2"
        placeholder="CE"
        class="w-full uppercase"
      />
    </UFormField>

    <UFormField
      name="postal_code"
      label="CEP"
      class="sm:col-span-2"
    >
      <UInput
        v-model="state.postal_code"
        placeholder="00000-000"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="latitude"
      label="Latitude"
      class="sm:col-span-3"
    >
      <UInput
        v-model="latitudeInput"
        inputmode="decimal"
        placeholder="-3.731900"
        class="w-full"
        @blur="normalizeLatitudeInput"
      />
    </UFormField>

    <UFormField
      name="longitude"
      label="Longitude"
      class="sm:col-span-3"
    >
      <UInput
        v-model="longitudeInput"
        inputmode="decimal"
        placeholder="-38.526700"
        class="w-full"
        @blur="normalizeLongitudeInput"
      />
    </UFormField>

    <UButton
      class="sm:col-span-6"
      type="button"
      label="Procurar endereço"
      icon="i-lucide-search"
      color="primary"
      variant="solid"
      :loading="searching"
      :disabled="searching"
      @click="pesquisar"
    />

    <div class="sm:col-span-6 overflow-hidden rounded-lg">
      <MapboxMap
        :center="mapCenter"
        :zoom="15"
        :markers="mapMarkers"
      />
    </div>
  </div>
</template>