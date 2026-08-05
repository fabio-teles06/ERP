import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@clerk/nextjs/server";


export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {

    await auth.protect();

    return (
        <>
            <SidebarProvider>
                <AppSidebar />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                    {children}
                </main>
            </SidebarProvider>
        </>
    )
}