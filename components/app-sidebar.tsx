import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@/components/ui/sidebar';
import { SidebarHeader } from './ui/sidebar';
import { LayoutDashboard, Navigation2Icon, Package, Truck, User } from 'lucide-react';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

const items = [
    {
        title: 'Dashboard',
        children: [
            { title: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard },
            { title: 'Roterização', href: '/dashboard/routing', icon: Navigation2Icon },
        ]
    },
    {
        title: 'Gestão',
        children: [
            { title: 'Clientes', href: '/dashboard/clients', icon: User },
            { title: 'Fretes', href: '/dashboard/shipments', icon: Package },
            { title: 'Veículos', href: '/dashboard/vehicles', icon: Truck },
        ]
    }
]

export function AppSidebar() {
    return (
        <Sidebar>
            <SidebarHeader>
                <div className='flex items-center space-x-2'>
                    <LayoutDashboard className='h-4 w-4' />
                    <span className='text-sm font-medium'>Opero+</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {items.map((item, index) => (
                    <SidebarGroup key={index}>
                        <SidebarGroupLabel>
                            {item.title}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {item.children.map((child, index) => (
                                    <SidebarMenuItem key={index}>
                                        <SidebarMenuButton asChild>
                                            <a href={child.href}>
                                                <child.icon className='mr-2 h-4 w-4' />
                                                {child.title}
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarFooter className='flex flex-col items-center'>
                <OrganizationSwitcher appearance={{
                    elements: {
                        organizationPreviewMainIdentifier: 'text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]',
                    }
                }} />
                <UserButton showName />
            </SidebarFooter>
        </Sidebar>
    )
}