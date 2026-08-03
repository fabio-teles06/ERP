import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@clerk/nextjs/server";


export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {

    await auth.protect();

    return (
        <>
            <SidebarProvider>
                <AppSidebar />
                <main>
                    {children}
                </main>
            </SidebarProvider>
        </>
    )
}