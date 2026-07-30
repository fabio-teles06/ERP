import { defineStore } from "pinia";
import type { Database, Tables } from "~/types/database.types";

export type OrganizationRole =
    Database["public"]["Enums"]["organization_role"];

type OrganizationData = Pick<Tables<"organizations">, 'id' | 'name' | 'document'>;

export type UserOrganization = OrganizationData & {
    role: OrganizationRole;
}

type MembershipQueryRow = {
    organization_id: string
    role: OrganizationRole
    organization: OrganizationData | null
}

export const useOrganizationStore = defineStore("organization", () => {
    const supabase = useSupabaseClient<Database>()
    const user = useSupabaseUser()

    const organizationCookie = useCookie<string | null>(
        "active-organization-id",
        {
            default: () => null,
            sameSite: 'lax',
            secure: !import.meta.dev
        }
    )

    const organizations = ref<UserOrganization[]>([])

    const activeOrganizationId = ref<string | null>(organizationCookie.value)

    const loadedForUserId = ref<string | null>(null)
    const loadingRequestCount = ref(0)
    const error = ref<string | null>(null)

    const pendingLoads = new Map<string, Promise<void>>()

    let stopUserWatcher: (() => void) | null = null

    const loading = computed(() => {
        return loadingRequestCount.value > 0
    })

    const currentUserId = computed(() => {
        return user.value?.sub ?? null
    })

    const loaded = computed(() => {
        return Boolean(
            currentUserId.value &&
            loadedForUserId.value === currentUserId.value
        )
    })

    const activeOrganization = computed<UserOrganization | null>(
        () => {
            if (!activeOrganizationId.value) {
                return null
            }

            return organizations.value.find(
                organization =>
                    organization.id === activeOrganizationId.value
            ) ?? null
        }
    )

    const activeRole = computed<OrganizationRole | null>(() => {
        return activeOrganization.value?.role ?? null
    })

    const canManageOrganization = computed(() => {
        return (
            activeRole.value === 'owner' ||
            activeRole.value === 'admin'
        )
    })

    const isOwner = computed(() => {
        return activeRole.value === 'owner'
    })

    function reset(options?: {
        clearCookie?: boolean
    }) {
        const clearCookie = options?.clearCookie ?? true

        organizations.value = []
        activeOrganizationId.value = null
        loadedForUserId.value = null
        error.value = null

        if (clearCookie) {
            organizationCookie.value = null
        }
    }

    function setActiveOrganization(
        organizationId: string
    ): boolean {
        const organizationExists = organizations.value.some(
            organization => organization.id === organizationId
        )

        if (!organizationExists) {
            console.warn(
                `A organização ${organizationId} não pertence ao usuário atual.`
            )

            return false
        }

        if (activeOrganizationId.value === organizationId) {
            return true
        }

        activeOrganizationId.value = organizationId
        organizationCookie.value = organizationId

        return true
    }

    async function fetchOrganizations(
        userId: string
    ): Promise<UserOrganization[]> {
        const { data, error: queryError } = await supabase
            .from('organization_members')
            .select(`
          organization_id,
          role,
          organization:organizations!inner (
            id,
            name,
            document
          )
        `)
            .eq('user_id', userId)
            .order('created_at', {
                ascending: true
            })

        if (queryError) {
            throw queryError
        }

        const rows =
            (data ?? []) as unknown as MembershipQueryRow[]

        return rows.flatMap<UserOrganization>(row => {
            if (!row.organization) {
                return []
            }

            return [
                {
                    id: row.organization.id,
                    name: row.organization.name,
                    document: row.organization.document,
                    role: row.role
                }
            ]
        })
    }

    async function performLoad(
        userId: string
    ): Promise<void> {
        loadingRequestCount.value += 1
        error.value = null

        try {
            const result = await fetchOrganizations(userId)
            
            if (user.value?.sub !== userId) {
                return
            }

            organizations.value = result

            loadedForUserId.value = userId

            const preferredOrganizationId =
                activeOrganizationId.value ??
                organizationCookie.value

            const preferredOrganizationExists =
                preferredOrganizationId !== null &&
                result.some(
                    organization =>
                        organization.id === preferredOrganizationId
                )

            const nextOrganizationId =
                preferredOrganizationExists
                    ? preferredOrganizationId
                    : result[0]?.id ?? null

            activeOrganizationId.value = nextOrganizationId
            organizationCookie.value = nextOrganizationId
        } catch (loadError) {

            if (user.value?.sub !== userId) {
                return
            }

            console.error(
                'Erro ao carregar organizações:',
                loadError
            )

            error.value =
                loadError instanceof Error
                    ? loadError.message
                    : 'Não foi possível carregar as organizações.'
        } finally {
            loadingRequestCount.value = Math.max(
                0,
                loadingRequestCount.value - 1
            )
        }
    }

    async function loadOrganizations(
        force = false
    ): Promise<void> {
        const userId = user.value?.sub

        if (!userId) {
            return
        }

        if (
            !force &&
            loadedForUserId.value === userId
        ) {
            return
        }

        const existingRequest = pendingLoads.get(userId)

        if (existingRequest) {
            return existingRequest
        }

        const request = performLoad(userId)

        pendingLoads.set(userId, request)

        try {
            await request
        } finally {
            if (pendingLoads.get(userId) === request) {
                pendingLoads.delete(userId)
            }
        }
    }

    async function refreshOrganizations() {
        await loadOrganizations(true)
    }

    async function initialize() {
        if (import.meta.server) {
            await loadOrganizations()
            return
        }

        if (stopUserWatcher) {
            return
        }

        stopUserWatcher = watch(
            () => user.value?.sub,
            async (userId, previousUserId) => {
                if (!userId) {
                    reset()
                    return
                }

                /*
                 * Remove dados pertencentes à conta anterior.
                 */
                if (
                    previousUserId &&
                    previousUserId !== userId
                ) {
                    reset()
                }

                await loadOrganizations()
            },
            {
                immediate: true
            }
        )
    }

    return {
        organizations,
        activeOrganizationId,
        activeOrganization,
        activeRole,

        loading,
        loaded,
        error,

        canManageOrganization,
        isOwner,

        initialize,
        loadOrganizations,
        refreshOrganizations,
        setActiveOrganization,
        reset
    }
});