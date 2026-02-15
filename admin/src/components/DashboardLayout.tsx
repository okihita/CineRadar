'use client';

import { ReactNode, useSyncExternalStore } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface DashboardLayoutProps {
    children: ReactNode;
}

// Empty subscribe function for server snapshot
const emptySubscribe = () => () => { };

export function DashboardLayout({ children }: DashboardLayoutProps) {
    // useSyncExternalStore to safely detect client-side mounting
    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    // Prevent hydration mismatch by showing placeholder until mounted
    // The blocking script in layout.tsx handles the initial theme
    if (!mounted) {
        return (
            <div className="flex h-screen">
                <div className="w-64 flex-shrink-0" /> {/* Sidebar placeholder */}
                <main className="flex-1 overflow-auto bg-background" />
            </div>
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

