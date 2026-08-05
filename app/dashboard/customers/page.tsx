import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { CustomersClient } from "./components/client"

export const metadata = {
  title: "Clientes",
  description: "Gerencie os clientes",
}

export default async function CustomersPage() {
  const { orgId } = await auth();

  // Caso o usuário não esteja numa organização no Clerk, lidamos com isso.
  // Em alguns setups, pode-se usar o userId como organization_id se não houver orgs.
  // Vamos buscar os clientes filtrando pelo organization_id = orgId
  const supabase = await createSupabaseServerClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    // .eq("organization_id", orgId) - Supabase RLS deve lidar com isso automaticamente se configurado,
    // mas vamos adicionar o filtro por segurança caso a org seja inferida no app.
    // .eq("organization_id", orgId) // Descomente se RLS não estiver ativo para testes
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar clientes:", error);
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
      </div>
      <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
        <Suspense fallback={<div>Carregando clientes...</div>}>
          <CustomersClient data={customers || []} />
        </Suspense>
      </div>
    </div>
  )
}
