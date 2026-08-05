"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { Database } from "@/types/supabase"

type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export async function createCustomer(data: Omit<CustomerInsert, 'organization_id'>) {
  const { orgId } = await auth();
  
  if (!orgId) {
    throw new Error("Usuário não está associado a nenhuma organização no Clerk.")
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('customers').insert({
    ...data,
    organization_id: orgId
  })

  if (error) {
    console.error("Erro ao criar cliente:", error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/customers')
}

export async function updateCustomer(id: string, data: CustomerUpdate) {
  const { orgId } = await auth();

  if (!orgId) {
    throw new Error("Usuário não está associado a nenhuma organização no Clerk.")
  }

  const supabase = await createSupabaseServerClient();

  // Garante que só pode atualizar clientes da sua org
  const { error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    console.error("Erro ao atualizar cliente:", error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/customers')
}

export async function deleteCustomer(id: string) {
  const { orgId } = await auth();

  if (!orgId) {
    throw new Error("Usuário não está associado a nenhuma organização no Clerk.")
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) {
    console.error("Erro ao deletar cliente:", error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/customers')
}
