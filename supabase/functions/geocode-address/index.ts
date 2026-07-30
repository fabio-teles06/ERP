import { withSupabase } from 'npm:@supabase/server@^1'

type GeocodeRequest = {
    query?: string
    street?: string
    number?: string
    neighborhood?: string
    city?: string
    state?: string
    postalCode?: string
    limit?: number
    permanent?: boolean
    proximity?: {
        longitude: number
        latitude: number
    }
}

type MapboxRoutablePoint = {
    name?: string
    longitude?: number
    latitude?: number
}

type MapboxFeature = {
    id?: string
    geometry?: {
        type?: string
        coordinates?: number[]
    }
    properties?: {
        mapbox_id?: string
        feature_type?: string
        name?: string
        name_preferred?: string
        place_formatted?: string
        full_address?: string
        coordinates?: {
            longitude?: number
            latitude?: number
            accuracy?: string
            routable_points?: MapboxRoutablePoint[]
        }
        match_code?: {
            confidence?: string
            [key: string]: unknown
        }
        context?: Record<string, unknown>
    }
}

type MapboxResponse = {
    type?: string
    features?: MapboxFeature[]
    attribution?: string
    message?: string
}

function normalizeText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined
    }

    const normalized = value.trim()

    return normalized.length > 0
        ? normalized
        : undefined
}

function isValidCoordinate(
    value: unknown
): value is number {
    return (
        typeof value === 'number' &&
        Number.isFinite(value)
    )
}

function buildMapboxUrl(
    body: GeocodeRequest,
    accessToken: string
): URL {
    const url = new URL(
        'https://api.mapbox.com/search/geocode/v6/forward'
    )

    const query = normalizeText(body.query)
    const street = normalizeText(body.street)
    const number = normalizeText(body.number)
    const neighborhood = normalizeText(
        body.neighborhood
    )
    const city = normalizeText(body.city)
    const state = normalizeText(body.state)
    const postalCode = normalizeText(body.postalCode)

    const requestedLimit =
        typeof body.limit === 'number'
            ? Math.floor(body.limit)
            : 5

    const limit = Math.min(
        Math.max(requestedLimit, 1),
        10
    )

    url.searchParams.set(
        'access_token',
        accessToken
    )

    url.searchParams.set('country', 'br')
    url.searchParams.set('language', 'pt-BR')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('autocomplete', 'false')
    url.searchParams.set(
        'permanent',
        String(body.permanent === true)
    )

    /*
     * Limites aproximados do Brasil:
     * oeste, sul, leste, norte.
     */
    url.searchParams.set(
        'bbox',
        [
            -73.9872354804,
            -33.7683777809,
            -34.7299934555,
            5.24448639569
        ].join(',')
    )

    url.searchParams.set(
        'types',
        'address,street'
    )

    if (body.proximity) {
        const {
            longitude,
            latitude
        } = body.proximity

        if (
            isValidCoordinate(longitude) &&
            isValidCoordinate(latitude) &&
            longitude >= -180 &&
            longitude <= 180 &&
            latitude >= -90 &&
            latitude <= 90
        ) {
            url.searchParams.set(
                'proximity',
                `${longitude},${latitude}`
            )
        }
    }

    /*
     * Pesquisa livre.
     */
    if (query) {
        if (query.length > 256) {
            throw new Error(
                'O endereço ultrapassa 256 caracteres.'
            )
        }

        url.searchParams.set('q', query)

        return url
    }

    /*
     * Pesquisa estruturada.
     */
    if (street) {
        url.searchParams.set('street', street)
    }

    if (number) {
        url.searchParams.set(
            'address_number',
            number
        )
    }

    if (neighborhood) {
        url.searchParams.set(
            'neighborhood',
            neighborhood
        )
    }

    if (city) {
        url.searchParams.set('place', city)
    }

    if (state) {
        url.searchParams.set('region', state)
    }

    if (postalCode) {
        url.searchParams.set(
            'postcode',
            postalCode.replace(/\D/g, '')
        )
    }

    return url
}

export default {
    fetch: withSupabase(
        {
            auth: 'user'
        },

        async (request, context) => {
            /*
             * O withSupabase responde automaticamente
             * às requisições OPTIONS.
             */
            if (request.method !== 'POST') {
                return Response.json(
                    {
                        error: 'Método não permitido.',
                        allowedMethods: ['POST']
                    },
                    {
                        status: 405
                    }
                )
            }

            /*
             * Com auth: 'user', o wrapper já garante que
             * existe um JWT válido. Esta verificação fica
             * apenas como proteção adicional.
             */
            const userId = context.userClaims?.id

            if (!userId) {
                return Response.json(
                    {
                        error: 'Usuário não autenticado.'
                    },
                    {
                        status: 401
                    }
                )
            }

            const mapboxAccessToken = Deno.env.get(
                'MAPBOX_ACCESS_TOKEN'
            )

            if (!mapboxAccessToken) {
                console.error(
                    'MAPBOX_ACCESS_TOKEN não configurado.'
                )

                return Response.json(
                    {
                        error:
                            'Serviço de geocodificação não configurado.'
                    },
                    {
                        status: 500
                    }
                )
            }

            try {
                const body =
                    (await request.json()) as GeocodeRequest

                const hasAddress =
                    normalizeText(body.query) ||
                    normalizeText(body.street) ||
                    normalizeText(body.city) ||
                    normalizeText(body.postalCode)

                if (!hasAddress) {
                    return Response.json(
                        {
                            error:
                                'Informe um endereço para geocodificar.'
                        },
                        {
                            status: 400
                        }
                    )
                }

                /*
                 * Agora a função auxiliar é realmente utilizada.
                 */
                const mapboxUrl = buildMapboxUrl(
                    body,
                    mapboxAccessToken
                )

                const mapboxResponse = await fetch(
                    mapboxUrl,
                    {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json'
                        }
                    }
                )

                const mapboxData =
                    (await mapboxResponse.json()) as MapboxResponse

                if (!mapboxResponse.ok) {
                    console.error(
                        'Erro retornado pelo Mapbox:',
                        {
                            status: mapboxResponse.status,
                            message: mapboxData.message
                        }
                    )

                    return Response.json(
                        {
                            error:
                                'Erro ao consultar o Mapbox.',
                            providerStatus:
                                mapboxResponse.status,
                            providerMessage:
                                mapboxData.message ??
                                'Erro desconhecido do Mapbox.'
                        },
                        {
                            status: 502
                        }
                    )
                }

                const results = (
                    mapboxData.features ?? []
                )
                    .map(feature => {
                        const properties =
                            feature.properties ?? {}

                        const geometryCoordinates =
                            feature.geometry?.coordinates ?? []

                        const longitude =
                            properties.coordinates?.longitude ??
                            geometryCoordinates[0]

                        const latitude =
                            properties.coordinates?.latitude ??
                            geometryCoordinates[1]

                        if (
                            !isValidCoordinate(longitude) ||
                            !isValidCoordinate(latitude)
                        ) {
                            return null
                        }

                        const routablePoint =
                            properties.coordinates
                                ?.routable_points
                                ?.find(
                                    point =>
                                        point.name === 'default'
                                )

                        const routingLongitude =
                            isValidCoordinate(
                                routablePoint?.longitude
                            )
                                ? routablePoint.longitude
                                : longitude

                        const routingLatitude =
                            isValidCoordinate(
                                routablePoint?.latitude
                            )
                                ? routablePoint.latitude
                                : latitude

                        const formattedAddress =
                            properties.full_address ??
                            [
                                properties.name_preferred ??
                                properties.name,
                                properties.place_formatted
                            ]
                                .filter(Boolean)
                                .join(', ')

                        return {
                            id:
                                properties.mapbox_id ??
                                feature.id ??
                                null,

                            formattedAddress,

                            featureType:
                                properties.feature_type ??
                                null,

                            longitude,
                            latitude,

                            routingLongitude,
                            routingLatitude,

                            accuracy:
                                properties.coordinates?.accuracy ??
                                null,

                            confidence:
                                properties.match_code?.confidence ??
                                null,

                            matchCode:
                                properties.match_code ?? null,

                            context:
                                properties.context ?? null
                        }
                    })
                    .filter(
                        (
                            result
                        ): result is NonNullable<
                            typeof result
                        > => result !== null
                    )

                return Response.json({
                    success: true,
                    requestedBy: userId,
                    found: results.length > 0,
                    count: results.length,
                    results
                })
            } catch (error) {
                console.error(
                    'Erro ao geocodificar:',
                    error
                )

                return Response.json(
                    {
                        error:
                            'Não foi possível geocodificar.',
                        message:
                            error instanceof Error
                                ? error.message
                                : 'Erro desconhecido.'
                    },
                    {
                        status: 400
                    }
                )
            }
        }
    )
}