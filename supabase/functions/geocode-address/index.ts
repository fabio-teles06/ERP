import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

import {
    geocodeAddress,
    type AddressInput
} from '../_shared/geocoding.ts'

type RequestBody = {
    address?: AddressInput
    limit?: number
    proximity?: {
        latitude: number
        longitude: number
    }
}

function jsonResponse(
    body: unknown,
    status = 200
) {
    return Response.json(body, {
        status,
        headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store'
        }
    })
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return jsonResponse({ ok: true })
    }

    if (request.method !== 'POST') {
        return jsonResponse(
            {
                error: 'Método não permitido.'
            },
            405
        )
    }

    try {
        const body = await request.json() as RequestBody

        if (!body.address) {
            return jsonResponse(
                {
                    error: 'O endereço não foi informado.'
                },
                400
            )
        }

        const results = await geocodeAddress(
            body.address,
            {
                limit: body.limit,
                permanent: false,
                proximity: body.proximity
            }
        )

        return jsonResponse({
            results
        })
    } catch (error) {
        console.error('Erro na geocodificação:', error)

        return jsonResponse(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível localizar o endereço.'
            },
            400
        )
    }
})