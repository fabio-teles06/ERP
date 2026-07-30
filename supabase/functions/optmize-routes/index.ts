import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

export interface PlannedVehicleRoute {
    vehicleId: string;
    deliveryIds: string[];
}

export interface OptimizeRoutesRequest {
    organizationId: string;
    startDepotId: string;
    endDepotId?: string;
    deliveryIds?: string[];
    vehicleIds?: string[];
    vroomUrl?: string;
    saveRoutes?: boolean;
    updateDeliveryStatus?: boolean;
    serviceDuration?: number; // Service duration per delivery stop in seconds (default: 300s = 5m)
    vehicleProfile?: string;  // Default: 'car'
    mode?: "optimize" | "plan"; // "optimize" (default) or "plan" (evaluates user predefined sequence)
    plannedRoutes?: PlannedVehicleRoute[];
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
    return Response.json(body, {
        status,
        headers: corsHeaders,
    });
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
    return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

const handler = withSupabase(
    { auth: "user" },
    async (req, ctx) => {
        if (req.method !== "POST") {
            return json({ error: "Método não permitido." }, 405);
        }

        let body: OptimizeRoutesRequest;
        try {
            body = await req.json();
        } catch {
            return json({ error: "Corpo da requisição inválido." }, 400);
        }

        const organizationId = body.organizationId?.trim();
        const startDepotId = body.startDepotId?.trim();
        const endDepotId = body.endDepotId?.trim() || startDepotId;
        const saveRoutes = body.saveRoutes !== false;
        const updateDeliveryStatus = body.updateDeliveryStatus === true;
        const serviceDuration = typeof body.serviceDuration === "number" && body.serviceDuration >= 0
            ? body.serviceDuration
            : 300;
        const vehicleProfile = body.vehicleProfile?.trim() || "car";
        const mode = body.mode === "plan" ? "plan" : "optimize";

        if (!organizationId) {
            return json({ error: "organizationId é obrigatório." }, 400);
        }

        if (!startDepotId) {
            return json({ error: "startDepotId é obrigatório." }, 400);
        }

        /*
         * 1. Verificar autenticação do usuário.
         */
        const {
            data: { user: authenticatedUser },
            error: authenticatedUserError,
        } = await ctx.supabase.auth.getUser();

        if (authenticatedUserError || !authenticatedUser) {
            return json({ error: "Usuário não autenticado." }, 401);
        }

        /*
         * 2. Validar se o usuário pertence à organização.
         */
        const { data: membership, error: membershipError } = await ctx.supabaseAdmin
            .from("organization_members")
            .select("role")
            .eq("organization_id", organizationId)
            .eq("user_id", authenticatedUser.id)
            .maybeSingle();

        if (membershipError || !membership) {
            return json(
                { error: "Acesso negado ou organização não encontrada." },
                403,
            );
        }

        /*
         * 3. Buscar depósitos.
         */
        const depotIdsToFetch = Array.from(new Set([startDepotId, endDepotId]));
        const { data: depotsData, error: depotsError } = await ctx.supabaseAdmin
            .from("depots")
            .select("id, name, latitude, longitude")
            .eq("organization_id", organizationId)
            .in("id", depotIdsToFetch);

        if (depotsError || !depotsData || depotsData.length === 0) {
            return json({ error: "Depósito inicial não encontrado." }, 404);
        }

        const startDepot = depotsData.find((d) => d.id === startDepotId);
        const endDepot = depotsData.find((d) => d.id === endDepotId) || startDepot;

        if (!startDepot || !isValidCoordinate(startDepot.latitude, startDepot.longitude)) {
            return json({ error: "Depósito inicial com coordenadas inválidas." }, 400);
        }

        if (!endDepot || !isValidCoordinate(endDepot.latitude, endDepot.longitude)) {
            return json({ error: "Depósito final com coordenadas inválidas." }, 400);
        }

        /*
         * 4. Buscar veículos da organização.
         */
        let vehicleQuery = ctx.supabaseAdmin
            .from("vehicles")
            .select("id, plate, weight_capacity, volume_capacity")
            .eq("organization_id", organizationId);

        if (body.vehicleIds && body.vehicleIds.length > 0) {
            vehicleQuery = vehicleQuery.in("id", body.vehicleIds);
        }

        const { data: vehiclesData, error: vehiclesError } = await vehicleQuery;

        if (vehiclesError || !vehiclesData || vehiclesData.length === 0) {
            return json({ error: "Nenhum veículo disponível para roteirização." }, 400);
        }

        /*
         * 5. Buscar entregas.
         */
        let allDeliveryIds: string[] = [];
        if (mode === "plan" && body.plannedRoutes && body.plannedRoutes.length > 0) {
            allDeliveryIds = body.plannedRoutes.flatMap((r) => r.deliveryIds);
        } else if (body.deliveryIds && body.deliveryIds.length > 0) {
            allDeliveryIds = body.deliveryIds;
        }

        let deliveryQuery = ctx.supabaseAdmin
            .from("deliveries")
            .select("id, invoice_number, weight, volume, quantity, latitude, longitude, scheduled_start_at, scheduled_end_at")
            .eq("organization_id", organizationId);

        if (allDeliveryIds.length > 0) {
            deliveryQuery = deliveryQuery.in("id", Array.from(new Set(allDeliveryIds)));
        } else {
            deliveryQuery = deliveryQuery.eq("status", "pending");
        }

        const { data: deliveriesData, error: deliveriesError } = await deliveryQuery;

        if (deliveriesError || !deliveriesData || deliveriesData.length === 0) {
            return json({ error: "Nenhuma entrega encontrada para roteirização." }, 400);
        }

        const validDeliveries = deliveriesData.filter((d) =>
            isValidCoordinate(d.latitude, d.longitude)
        );

        if (validDeliveries.length === 0) {
            return json(
                { error: "Nenhuma entrega possui coordenadas válidas." },
                400,
            );
        }

        /*
         * 6. Mapeamento de IDs e Construção do Payload VROOM.
         */
        const SCALE_FACTOR = 1000;
        const vehicleIntToUuid = new Map<number, string>();
        const vehicleUuidToInt = new Map<string, number>();
        const deliveryIntToUuid = new Map<number, string>();
        const deliveryUuidToInt = new Map<string, number>();

        // Mapear veículos
        vehiclesData.forEach((v, index) => {
            const vroomVehicleId = index + 1;
            vehicleIntToUuid.set(vroomVehicleId, v.id);
            vehicleUuidToInt.set(v.id, vroomVehicleId);
        });

        // Mapear entregas
        validDeliveries.forEach((d, index) => {
            const vroomJobId = 1000 + index + 1;
            deliveryIntToUuid.set(vroomJobId, d.id);
            deliveryUuidToInt.set(d.id, vroomJobId);
        });

        // Construir array de veículos para o VROOM
        const vroomVehicles = vehiclesData.map((v) => {
            const vroomVehicleId = vehicleUuidToInt.get(v.id)!;

            const weightCap = v.weight_capacity != null && Number(v.weight_capacity) > 0
                ? Math.round(Number(v.weight_capacity) * SCALE_FACTOR)
                : 999999999;

            const volumeCap = v.volume_capacity != null && Number(v.volume_capacity) > 0
                ? Math.round(Number(v.volume_capacity) * SCALE_FACTOR)
                : 999999999;

            const vehicleObj: Record<string, unknown> = {
                id: vroomVehicleId,
                start: [startDepot.longitude, startDepot.latitude],
                end: [endDepot.longitude, endDepot.latitude],
                capacity: [weightCap, volumeCap],
                profile: vehicleProfile,
            };

            // MODO PLAN: Se houver sequência de passos pré-definida para o veículo
            if (mode === "plan" && body.plannedRoutes) {
                const planned = body.plannedRoutes.find((pr) => pr.vehicleId === v.id);
                if (planned && planned.deliveryIds.length > 0) {
                    const steps = planned.deliveryIds
                        .map((dId) => {
                            const jobId = deliveryUuidToInt.get(dId);
                            return jobId ? { type: "job", id: jobId } : null;
                        })
                        .filter((step): step is { type: string; id: number } => step !== null);

                    if (steps.length > 0) {
                        vehicleObj.steps = steps;
                    }
                }
            }

            return vehicleObj;
        });

        // Construir array de jobs para o VROOM
        const vroomJobs = validDeliveries.map((d) => {
            const vroomJobId = deliveryUuidToInt.get(d.id)!;

            const weightReq = Math.max(0, Math.round(Number(d.weight || 0) * SCALE_FACTOR));
            const volumeReq = Math.max(0, Math.round(Number(d.volume || 0) * SCALE_FACTOR));

            const job: Record<string, unknown> = {
                id: vroomJobId,
                location: [d.longitude, d.latitude],
                delivery: [weightReq, volumeReq],
                service: serviceDuration,
            };

            if (d.scheduled_start_at && d.scheduled_end_at) {
                const startSec = Math.floor(new Date(d.scheduled_start_at).getTime() / 1000);
                const endSec = Math.floor(new Date(d.scheduled_end_at).getTime() / 1000);
                if (endSec > startSec) {
                    job.time_windows = [[startSec, endSec]];
                }
            }

            return job;
        });

        const vroomPayload = {
            vehicles: vroomVehicles,
            jobs: vroomJobs,
            options: {
                g: true, // Solicitar polilinha/geometria da rota
            },
        };

        /*
         * 7. Enviar requisição ao VROOM.
         */
        const vroomEndpoint = Deno.env.get("VROOM_API_URL") ||
            body.vroomUrl ||
            "http://router.vroom-project.org";

        console.log(`Enviando requisição VROOM (${mode} mode) para: ${vroomEndpoint}`);

        let vroomResponse: Response;
        try {
            vroomResponse = await fetch(vroomEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(vroomPayload),
            });
        } catch (fetchErr) {
            console.error("Erro na comunicação com o VROOM:", fetchErr);
            return json(
                {
                    error: "Não foi possível conectar ao servidor VROOM.",
                    details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
                },
                502,
            );
        }

        const vroomData = await vroomResponse.json();

        if (!vroomResponse.ok || vroomData.code !== 0) {
            console.error("VROOM erro:", vroomData);
            return json(
                {
                    error: "Erro no processamento da roteirização pelo VROOM.",
                    vroomCode: vroomData.code,
                    vroomError: vroomData.error || "Erro desconhecido",
                },
                400,
            );
        }

        /*
         * 8. Processar resposta e persistir no banco.
         */
        const createdRoutes = [];
        const unassignedDeliveries = (vroomData.unassigned || []).map((un: { id: number }) => ({
            deliveryId: deliveryIntToUuid.get(un.id) || null,
            vroomJobId: un.id,
        })).filter((un: { deliveryId: string | null }) => un.deliveryId !== null);

        // Se estiver salvando no DB e estiver no modo PLAN ou RECOMPUTE, limpa rotas anteriores para esses veículos/organização
        if (saveRoutes && mode === "plan" && body.vehicleIds && body.vehicleIds.length > 0) {
            const { data: existingRoutes } = await ctx.supabaseAdmin
                .from("routes")
                .select("id")
                .eq("organization_id", organizationId)
                .in("vehicle_id", body.vehicleIds);

            if (existingRoutes && existingRoutes.length > 0) {
                const routeIds = existingRoutes.map((r) => r.id);
                await ctx.supabaseAdmin.from("route_points").delete().in("route_id", routeIds);
                await ctx.supabaseAdmin.from("routes").delete().in("id", routeIds);
            }
        }

        for (const route of vroomData.routes || []) {
            const vehicleUuid = vehicleIntToUuid.get(route.vehicle);
            if (!vehicleUuid) continue;

            const jobSteps = (route.steps || []).filter(
                (step: { type: string; id?: number }) =>
                    (step.type === "job" || step.type === "delivery") && step.id != null
            );

            const points = jobSteps.map((step: { id: number; arrival?: number; duration?: number; distance?: number }, pos: number) => {
                const deliveryUuid = deliveryIntToUuid.get(step.id);
                return {
                    deliveryId: deliveryUuid!,
                    position: pos,
                    arrival: step.arrival,
                    duration: step.duration,
                    distance: step.distance,
                };
            }).filter((p: { deliveryId: string | null }) => p.deliveryId != null);

            let routeId: string | null = null;

            if (saveRoutes) {
                const { data: insertedRoute, error: routeInsertError } = await ctx.supabaseAdmin
                    .from("routes")
                    .insert({
                        organization_id: organizationId,
                        start_depot_id: startDepotId,
                        end_depot_id: endDepotId,
                        vehicle_id: vehicleUuid,
                        duration: route.duration || 0,
                        distance: route.distance || 0,
                        geometry: route.geometry || null,
                        delivery: route.delivery || [],
                        pickup: route.pickup || [],
                    })
                    .select("id")
                    .single();

                if (routeInsertError) {
                    console.error("Erro ao salvar rota:", routeInsertError);
                } else if (insertedRoute) {
                    routeId = insertedRoute.id;

                    if (points.length > 0) {
                        const routePointsToInsert = points.map((p: { deliveryId: string; position: number }) => ({
                            organization_id: organizationId,
                            route_id: routeId!,
                            delivery_id: p.deliveryId,
                            position: p.position,
                        }));

                        const { error: pointsInsertError } = await ctx.supabaseAdmin
                            .from("route_points")
                            .insert(routePointsToInsert);

                        if (pointsInsertError) {
                            console.error("Erro ao salvar pontos da rota:", pointsInsertError);
                        }
                    }

                    if (updateDeliveryStatus && points.length > 0) {
                        const assignedDeliveryIds = points.map((p: { deliveryId: string }) => p.deliveryId);
                        await ctx.supabaseAdmin
                            .from("deliveries")
                            .update({ status: "scheduled" })
                            .in("id", assignedDeliveryIds);
                    }
                }
            }

            createdRoutes.push({
                routeId,
                vehicleId: vehicleUuid,
                startDepotId,
                endDepotId,
                duration: route.duration,
                distance: route.distance,
                geometry: route.geometry || null,
                points,
            });
        }

        return json({
            success: true,
            mode,
            summary: {
                cost: vroomData.summary?.cost || 0,
                totalDistance: vroomData.summary?.distance || 0,
                totalDuration: vroomData.summary?.duration || 0,
                serviceDuration: vroomData.summary?.service || 0,
                routesCount: createdRoutes.length,
                unassignedCount: unassignedDeliveries.length,
            },
            routes: createdRoutes,
            unassignedDeliveries,
        });
    },
);

export default {
    fetch(req: Request): Promise<Response> | Response {
        if (req.method === "OPTIONS") {
            return new Response("ok", {
                headers: corsHeaders,
            });
        }

        return handler(req);
    },
};
