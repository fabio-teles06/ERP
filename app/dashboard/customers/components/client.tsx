"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DataTable } from "./data-table"
import { columns } from "./columns"
import { Database } from "@/types/supabase"
import { useState } from "react"
import { CustomerSheet } from "./customer-sheet"

type Customer = Database['public']['Tables']['customers']['Row']

interface CustomersClientProps {
  data: Customer[]
}

export function CustomersClient({ data }: CustomersClientProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Gerencie os clientes da sua organização.
          </p>
        </div>
        <Button onClick={() => setIsSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>
      <Separator />
      <DataTable columns={columns} data={data} />
      <CustomerSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </>
  )
}
