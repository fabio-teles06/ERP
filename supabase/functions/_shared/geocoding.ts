export type AddressInput = {
    address?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    postalCode?: string
}

export type GeocodingResult = {
    id: string
    label: string
    latitude: number
    longitude: number
    accuracy: number
    matchCode: Record<string, unknown> | null
}

type MapboxFeature = {
    id?: string
    geometry?: {
        type?: string
        coordinates?: [number, number]
    }
    properties?: {
        name?: string
        full_address?: string
        place_formatted?: string
        coordinates?: {
            accuracy?: string
        }
        match_code?: Record<string, unknown>
    }
}

type MapboxResponse = {
    type?: string
    features?: MapboxFeature[]
    message?: string
}

function normalizePart(value: string | undefined) {
    const normalized = value?.trim()
    return normalized || null
}

export function buildAddressQuery(address: AddressInput) {
    const street = [
        normalizePart(address.address),
        normalizePart(address.number)
    ]
        .filter(Boolean)
        .join(', ')

    return [
        street,
        normalizePart(address.neighborhood),
        normalizePart(address.city),
        normalizePart(address.state)?.toUpperCase(),
        normalizePart(address.postalCode)
    ]
        .filter(Boolean)
        .join(', ')
}

export async function geocodeAddress(address: AddressInput, options?: {
    limit?: number
    permanent?: boolean
    proximity?: { latitude: number; longitude: number }
}): Promise<GeocodingResult[]> {
    const accessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN')

    if (!accessToken) {
        throw new Error('MAPBOX_ACCESS_TOKEN is not set')
    }

    const query = buildAddressQuery(address)

    if (query.length < 5) {
        throw new Error('Address query is too short')
    }

    const limit = Math.min(Math.max(options?.limit ?? 5, 1), 10)

    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')

    url.searchParams.set('q', query)
    url.searchParams.set('access_token', accessToken)
    url.searchParams.set('country', 'br')
    url.searchParams.set('language', 'pt-BR')
    url.searchParams.set('autocomplete', 'false')
    url.searchParams.set('limit', limit.toString())

    url.searchParams.set('permanent', options?.permanent ? 'true' : 'false')

    if (options?.proximity) {
        url.searchParams.set(
            'proximity',
            [
                options.proximity.longitude,
                options.proximity.latitude
            ].join(',')
        )
    }

    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json'
        }
    })

    const data = await response.json() as MapboxResponse

    if (!response.ok) {
        throw new Error(
            data.message ??
            `Erro ${response.status} ao consultar o Mapbox.`
        )
    }

    return (data.features ?? []).flatMap(GeocodingResult)((feature) => {
        const coordinates = feature.geometry?.coordinates

        if (
            !coordinates || coordinates.length < 2 ||
            !Number.isFinite(coordinates[0]) ||
            !Number.isFinite(coordinates[1])
        ) {
            return []
        }

        const properties = feature.properties ?? {}

        const label = properties.full_address ?? [
            properties.name,
            properties.place_formatted
        ].filter(Boolean)
            .join(', ') ??
        query

        return [
            {
                id: feature.id ?? crypto.randomUUID(),
                label,
                longitude: coordinates[0],
                latitude: coordinates[1],
                accuracy: properties.coordinates?.accuracy ? null,
                matchCode: properties.match_code ?? null
            }
        ]
    })
}