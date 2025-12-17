'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Download, Star, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
    onExport?: () => void;
    exportLabel?: string;
    chartRef?: React.RefObject<HTMLDivElement | null>;
    id?: string;
}

// Get favorites from localStorage
function getFavorites(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem('cineradar_favorites') || '[]');
    } catch { return []; }
}

// Save favorites to localStorage
function saveFavorites(favorites: string[]) {
    localStorage.setItem('cineradar_favorites', JSON.stringify(favorites));
}

export function CollapsibleCard({
    title,
    icon,
    children,
    defaultOpen = true,
    className,
    onExport,
    exportLabel = 'Export CSV',
    chartRef,
    id,
}: CollapsibleCardProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFavorite, setIsFavorite] = useState(() => id ? getFavorites().includes(id) : false);

    const toggleFavorite = () => {
        if (!id) return;
        const favorites = getFavorites();
        const newFavorites = isFavorite
            ? favorites.filter(f => f !== id)
            : [...favorites, id];
        saveFavorites(newFavorites);
        setIsFavorite(!isFavorite);
    };

    const toggleFullscreen = () => {
        if (!chartRef?.current) return;

        if (!isFullscreen) {
            chartRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div className={cn(
            'rounded-lg border bg-card text-card-foreground shadow-sm',
            isFullscreen && 'fixed inset-4 z-50 overflow-auto',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b cursor-pointer hover:bg-muted/50"
                onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-sm font-medium">{title}</h3>
                    {isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                </div>
                <div className="flex items-center gap-1">
                    {/* Favorite Toggle */}
                    {id && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            {isFavorite ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                        </button>
                    )}

                    {/* Export Button */}
                    {onExport && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onExport(); }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={exportLabel}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}

                    {/* Fullscreen Toggle */}
                    {chartRef && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}

                    {/* Collapse Toggle */}
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={cn(
                'transition-all duration-200 overflow-hidden',
                isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            )}>
                <div className="p-4" ref={chartRef as React.RefObject<HTMLDivElement>}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// Keyboard shortcuts hook
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
    if (typeof window === 'undefined') return;

    const handler = (e: KeyboardEvent) => {
        // Check for modifier keys
        const key = [
            e.ctrlKey && 'ctrl',
            e.shiftKey && 'shift',
            e.altKey && 'alt',
            e.key.toLowerCase(),
        ].filter(Boolean).join('+');

        if (shortcuts[key]) {
            e.preventDefault();
            shortcuts[key]();
        }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
}
