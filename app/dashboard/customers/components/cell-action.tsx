"use client"

import { useState, useTransition } from "react"
import { Database } from "@/types/supabase"
import { MoreHorizontal, Pencil, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CustomerSheet } from "./customer-sheet"
import { deleteCustomer } from "../actions"

type Customer = Database['public']['Tables']['customers']['Row']

interface CellActionProps {
  data: Customer
}

export function CellAction({ data }: CellActionProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onDelete = () => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      startTransition(async () => {
        try {
          await deleteCustomer(data.id)
        } catch (error) {
          console.error(error)
          alert("Ocorreu um erro ao excluir.")
        }
      })
    }
  }

  return (
    <>
      <CustomerSheet
        open={open}
        onOpenChange={setOpen}
        customer={data}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(data.id)}>
            Copiar ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-destructive focus:text-destructive" 
            onClick={onDelete}
            disabled={isPending}
          >
            <Trash className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
