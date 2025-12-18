'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Search, RefreshCw, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    lastUpdated?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    showMockBadge?: boolean;
}

export function PageHeader({
    title,
    description,
    icon,
    lastUpdated,
    onRefresh,
    isRefreshing,
    showMockBadge = true,
}: PageHeaderProps) {
    const [darkMode, setDarkMode] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('darkMode');
        const isDark = saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setDarkMode(isDark);
        document.documentElement.classList.toggle('dark', isDark);
    }, []);

    const toggleDarkMode = () => {
        const newValue = !darkMode;
        setDarkMode(newValue);
        localStorage.setItem('darkMode', String(newValue));
        document.documentElement.classList.toggle('dark', newValue);
    };

    return (
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Title and description */}
            <div className="flex items-start gap-3">
                {icon && <div className="mt-1">{icon}</div>}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        {showMockBadge && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                                Mock Data
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
                    )}
                    {lastUpdated && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Last updated: {lastUpdated}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Search */}
                <div className={cn(
                    'flex items-center transition-all duration-200',
                    searchOpen ? 'w-48' : 'w-8'
                )}>
                    {searchOpen ? (
                        <div className="relative w-full">
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-8 pr-8 text-sm"
                                autoFocus
                                onBlur={() => !searchTerm && setSearchOpen(false)}
                            />
                            <button
                                onClick={() => { setSearchTerm(''); setSearchOpen(false); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Search"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Refresh */}
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title="Refresh data"
                    >
                        <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                    </button>
                )}

                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={darkMode ? 'Light mode' : 'Dark mode'}
                >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

// Re-export time utilities for backward compatibility
export { formatRelativeWIB as formatRelativeTime, formatWIB, formatWIBShort, formatWIBDate } from '@/lib/timeUtils';
