"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Database } from "@/types/supabase"
import { createCustomer, updateCustomer } from "../actions"

type Customer = Database['public']['Tables']['customers']['Row']

const customerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  document: z.string().optional().nullable(),
  email: z.string().email("Email inválido.").optional().nullable(),
  phone: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  active: z.boolean().default(true)
})

type CustomerFormValues = z.infer<typeof customerSchema>

interface CustomerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer // Se existir, é edição
}

export function CustomerSheet({ open, onOpenChange, customer }: CustomerSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema) as any,
    defaultValues: {
      name: customer?.name || "",
      document: customer?.document || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      code: customer?.code || "",
      active: customer?.active ?? true,
    },
  })

  async function onSubmit(data: CustomerFormValues) {
    startTransition(async () => {
      try {
        if (customer) {
          await updateCustomer(customer.id, data)
        } else {
          await createCustomer(data)
        }
        onOpenChange(false)
        form.reset()
      } catch (error) {
        console.error("Erro ao salvar cliente", error)
        alert("Ocorreu um erro ao salvar o cliente.")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px] p-4">
        <SheetHeader>
          <SheetTitle>{customer ? 'Editar Cliente' : 'Novo Cliente'}</SheetTitle>
          <SheetDescription>
            {customer ? 'Faça alterações nos dados do cliente aqui.' : 'Preencha os dados do novo cliente.'}
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control as any}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento (CPF/CNPJ)</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Interno</FormLabel>
                    <FormControl>
                      <Input placeholder="EX: 1234" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-4 flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
