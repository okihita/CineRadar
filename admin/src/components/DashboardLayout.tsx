'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useDarkMode } from '@/hooks';

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { darkMode } = useDarkMode(false);

    return (
        <div className={`flex h-screen ${darkMode ? 'dark' : ''}`}>
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        </div>
    );
}
