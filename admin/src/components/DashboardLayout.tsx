'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useSession } from 'next-auth/react';

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { data: session } = useSession();

    // Guests: no sidebar, full-width content (sign-in page)
    if (!session) {
        return (
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        );
    }

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        </div>
    );
}

