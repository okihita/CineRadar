'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSession } from 'next-auth/react';

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { data: session, status } = useSession();

    // 1. Prevent Layout Shift: Show the sidebar shell while checking session
    if (status === 'loading') {
        return (
            <div className="flex h-screen">
                {/* Minimal placeholder to reserve space (matches w-64/w-16 in Sidebar) */}
                <div data-sidebar-placeholder className="hidden md:block w-64 bg-muted/10 border-r animate-pulse" />
                <main className="flex-1 overflow-auto bg-background">
                    <ErrorBoundary>{children}</ErrorBoundary>
                </main>
            </div>
        );
    }

    // 2. Guests: no sidebar, full-width content (sign-in page)
    if (!session) {
        return (
            <main className="flex-1 overflow-auto bg-background">
                <ErrorBoundary>{children}</ErrorBoundary>
            </main>
        );
    }

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
                <ErrorBoundary>{children}</ErrorBoundary>
            </main>
        </div>
    );
}

