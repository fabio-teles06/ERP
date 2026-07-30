import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

type OrganizationRole = "admin" | "operator" | "viewer";

interface InviteRequest {
    organizationId: string;
    email: string;
    role?: OrganizationRole;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = new Set<OrganizationRole>([
    "admin",
    "operator",
    "viewer",
]);

function json(
    body: Record<string, unknown>,
    status = 200,
): Response {
    return Response.json(body, {
        status,
        headers: corsHeaders,
    });
}

const authenticatedHandler = withSupabase(
    { auth: "user" },
    async (req, ctx) => {
        if (req.method !== "POST") {
            return json(
                { error: "Método não permitido." },
                405,
            );
        }

        let body: InviteRequest;

        try {
            body = await req.json();
        } catch {
            return json(
                { error: "Corpo da requisição inválido." },
                400,
            );
        }

        const organizationId = body.organizationId?.trim();
        const email = body.email?.trim().toLowerCase();
        const role = body.role ?? "operator";

        if (!organizationId) {
            return json(
                { error: "organizationId é obrigatório." },
                400,
            );
        }

        if (!email || !email.includes("@")) {
            return json(
                { error: "Informe um e-mail válido." },
                400,
            );
        }

        if (!allowedRoles.has(role)) {
            return json(
                { error: "Perfil de acesso inválido." },
                400,
            );
        }

        /*
         * Recupera o usuário autenticado.
         */
        const {
            data: { user: authenticatedUser },
            error: authenticatedUserError,
        } = await ctx.supabase.auth.getUser();

        if (authenticatedUserError || !authenticatedUser) {
            return json(
                { error: "Usuário não autenticado." },
                401,
            );
        }

        /*
         * Somente owner e admin podem convidar.
         */
        const {
            data: inviterMembership,
            error: membershipError,
        } = await ctx.supabaseAdmin
            .from("organization_members")
            .select("role")
            .eq("organization_id", organizationId)
            .eq("user_id", authenticatedUser.id)
            .maybeSingle();

        if (membershipError) {
            console.error("Membership lookup error:", membershipError);

            return json(
                { error: "Não foi possível validar a organização." },
                500,
            );
        }

        if (
            !inviterMembership ||
            !["owner", "admin"].includes(inviterMembership.role)
        ) {
            return json(
                {
                    error:
                        "Somente proprietários e administradores podem convidar membros.",
                },
                403,
            );
        }

        /*
         * Confere se o usuário já existe no Supabase Auth.
         */
        const {
            data: existingUserId,
            error: findUserError,
        } = await ctx.supabaseAdmin.rpc(
            "find_auth_user_id_by_email",
            {
                p_email: email,
            },
        );

        if (findUserError) {
            console.error("User lookup error:", findUserError);

            return json(
                { error: "Não foi possível procurar o usuário." },
                500,
            );
        }

        /*
         * O usuário já possui conta.
         */
        if (existingUserId) {
            const {
                data: existingMembership,
                error: existingMembershipError,
            } = await ctx.supabaseAdmin
                .from("organization_members")
                .select("organization_id")
                .eq("organization_id", organizationId)
                .eq("user_id", existingUserId)
                .maybeSingle();

            if (existingMembershipError) {
                console.error(
                    "Existing membership error:",
                    existingMembershipError,
                );

                return json(
                    { error: "Não foi possível verificar o membro." },
                    500,
                );
            }

            if (existingMembership) {
                return json(
                    {
                        status: "already_member",
                        message: "Esse usuário já pertence à organização.",
                    },
                    200,
                );
            }

            const { error: addMemberError } =
                await ctx.supabaseAdmin
                    .from("organization_members")
                    .insert({
                        organization_id: organizationId,
                        user_id: existingUserId,
                        role,
                    });

            if (addMemberError) {
                console.error("Add member error:", addMemberError);

                return json(
                    { error: "Não foi possível adicionar o membro." },
                    500,
                );
            }

            const { error: invitationAuditError } =
                await ctx.supabaseAdmin
                    .from("organization_invitations")
                    .insert({
                        organization_id: organizationId,
                        email,
                        role,
                        invited_by: authenticatedUser.id,
                        invited_user_id: existingUserId,
                        status: "completed",
                        completed_at: new Date().toISOString(),
                    });

            if (invitationAuditError) {
                /*
                 * O membro já foi adicionado.
                 * Esse erro afeta apenas o histórico.
                 */
                console.error(
                    "Invitation audit error:",
                    invitationAuditError,
                );
            }

            return json({
                status: "member_added",
                message:
                    "O usuário já possuía uma conta e foi adicionado à organização.",
                userId: existingUserId,
            });
        }

        /*
         * O usuário ainda não possui uma conta.
         */
        const {
            data: invitation,
            error: invitationError,
        } = await ctx.supabaseAdmin
            .from("organization_invitations")
            .insert({
                organization_id: organizationId,
                email,
                role,
                invited_by: authenticatedUser.id,
            })
            .select("id")
            .single();

        if (invitationError) {
            if (invitationError.code === "23505") {
                return json(
                    {
                        error:
                            "Já existe um convite pendente para esse e-mail.",
                    },
                    409,
                );
            }

            console.error("Invitation creation error:", invitationError);

            return json(
                { error: "Não foi possível criar o convite." },
                500,
            );
        }

        const appUrl =
            Deno.env.get("APP_URL") ?? "http://localhost:3000";

        const {
            data: invitedUser,
            error: inviteError,
        } = await ctx.supabaseAdmin.auth.admin
            .inviteUserByEmail(email, {
                data: {
                    organization_invitation_id: invitation.id,
                },
                redirectTo: `${appUrl}/auth/invite`,
            });

        if (inviteError) {
            console.error("Supabase Auth invite error:", inviteError);

            await ctx.supabaseAdmin
                .from("organization_invitations")
                .update({
                    status: "revoked",
                })
                .eq("id", invitation.id);

            return json(
                {
                    error:
                        "O convite foi registrado, mas o e-mail não pôde ser enviado.",
                },
                500,
            );
        }

        return json({
            status: "invited",
            message:
                "O convite foi enviado e o usuário foi vinculado à organização.",
            invitationId: invitation.id,
            userId: invitedUser.user?.id,
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

        return authenticatedHandler(req);
    },
};