'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MapPin, Building2, Loader2, Info, Map as MapIcon, Layers, Zap, Database, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCinemaDetails } from '../hooks/useCinemaDetails';
import { useTheatres } from '@/hooks/useTheatres';
import { useCinemasStore } from '../stores/useCinemasStore';
import { getRegion } from '@/lib/regions';
import { TheatreStudiosList } from './TheatreStudiosList';
import type { PerformanceMetrics } from '../hooks/useTheatreStudios';

interface CinemaDetailViewProps {
    theatreId: string;
}

export function CinemaDetailView({ theatreId }: CinemaDetailViewProps) {
    const router = useRouter();
    const { filteredTheatreIds } = useCinemasStore();
    const { theatres: allTheatres } = useTheatres();
    
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

    // Navigation logic with fallback
    const { currentIndex, prevId, nextId, totalCount, isUsingFiltered } = useMemo(() => {
        const isFilteredAvailable = filteredTheatreIds && filteredTheatreIds.length > 0;
        const sourceIds = isFilteredAvailable
            ? filteredTheatreIds.map(id => String(id).trim())
            : allTheatres.map(t => String(t.theatre_id).trim()).sort();

        const currentId = String(theatreId).trim();
        const index = sourceIds.indexOf(currentId);

        if (index === -1) return { currentIndex: -1, prevId: null, nextId: null, totalCount: sourceIds.length, isUsingFiltered: isFilteredAvailable };
        
        return {
            currentIndex: index,
            prevId: index > 0 ? sourceIds[index - 1] : null,
            nextId: index < sourceIds.length - 1 ? sourceIds[index + 1] : null,
            totalCount: sourceIds.length,
            isUsingFiltered: isFilteredAvailable
        };
    }, [filteredTheatreIds, allTheatres, theatreId]);

    const navigateTo = useCallback((id: string | null) => {
        if (id) router.push(`/cinemas/${id}`);
    }, [router]);

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowLeft' && prevId) navigateTo(prevId);
            else if (e.key === 'ArrowRight' && nextId) navigateTo(nextId);
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [prevId, nextId, navigateTo]);

    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    
    const { theatre, loading, error } = useCinemaDetails(theatreId);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    if (loading && !theatre) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Info className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{error}</h2>
                <Button onClick={() => router.push('/cinemas')}>Back to Cinemas</Button>
            </div>
        );
    }

    if (!theatre) return null;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-6 animate-in fade-in duration-500">
            {/* Navigation Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/cinemas')} className="mt-1">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold tracking-tight">{theatre.name}</h1>
                            <Badge className={theatre.merchant === 'XXI' ? 'bg-amber-500 hover:bg-amber-600' : theatre.merchant === 'CGV' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}>
                                {theatre.merchant}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground text-sm">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] bg-muted/50 px-1.5 py-0.5 rounded border border-border/50 cursor-pointer hover:bg-muted transition-colors group" onClick={() => copyToClipboard(theatre.theatre_id)} title="Copy Theatre ID">
                                ID: {theatre.theatre_id}
                                {copied ? <Check className="w-3 h-3 text-green-500 animate-in zoom-in duration-200" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all duration-200" />}
                            </div>
                            <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {theatre.city} ({getRegion(theatre.city)})
                            </div>
                            <div className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {theatre.studio_count} Studios
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {currentIndex !== -1 && (
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border shadow-sm">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" disabled={!prevId} onClick={() => navigateTo(prevId)} title="Previous Theatre (ArrowLeft)">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex flex-col items-center px-3 min-w-[90px]">
                                <span className="text-[10px] font-mono font-bold text-foreground leading-none">{currentIndex + 1} / {totalCount}</span>
                                <span className={cn("text-[7px] uppercase tracking-wider font-bold mt-1 px-1 rounded-[2px]", isUsingFiltered ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground")}>
                                    {isUsingFiltered ? 'Filtered' : 'Full List'}
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" disabled={!nextId} onClick={() => navigateTo(nextId)} title="Next Theatre (ArrowRight)">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Section 1: Physical Asset Registry */}
            <Card className="border-none shadow-sm ring-1 ring-border">
                <CardHeader className="py-2.5 px-4 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        Physical Asset Registry
                    </CardTitle>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4 border-r pr-4 border-border/50">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                                <Zap className="w-3.5 h-3.5 text-blue-500" /> Ground Truth
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                                <Database className="w-3.5 h-3.5 text-amber-500" /> Guessed
                            </div>
                        </div>
                        
                        {metrics && (
                            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/50">
                                <span>{metrics.latencyMs}ms</span>
                                <span className="opacity-30">|</span>
                                <span>{metrics.sizeKB} KB</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <TheatreStudiosList 
                        theatreId={theatreId} 
                        merchant={theatre.merchant} 
                        onMetricsLoad={setMetrics}
                    />
                </CardContent>
            </Card>

            {/* Section 2: Map & Theatre Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm ring-1 ring-border">
                    <CardHeader className="py-3 px-4 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-primary" />
                            Location
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase tracking-wider font-bold" onClick={() => {
                            const url = theatre.place_id ? `https://www.google.com/maps/place/?q=place_id:${theatre.place_id}` : `https://www.google.com/maps?q=${theatre.lat},${theatre.lng}`;
                            window.open(url, '_blank');
                        }}>
                            Open in Google Maps
                        </Button>
                    </CardHeader>
                    <div className="aspect-[21/9] w-full bg-muted/20">
                        <iframe width="100%" height="100%" style={{ border: 0, filter: isDarkMode ? 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none' }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(theatre.name + ' ' + theatre.city + ' Indonesia')}`} />
                    </div>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border">
                    <CardHeader className="py-3 px-4 bg-muted/10 border-b">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Info className="w-4 h-4 text-primary" />
                            Theatre Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Address</p>
                            <p className="text-sm leading-relaxed">{theatre.address || 'Address not available'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">City</p>
                                <p className="text-sm font-medium">{theatre.city}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Region</p>
                                <p className="text-sm font-medium">{getRegion(theatre.city)}</p>
                            </div>
                        </div>
                        <div className="pt-2 border-t mt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Total Capacity</span>
                                <span className="text-sm font-mono font-bold text-primary">{theatre.total_capacity?.toLocaleString() || '0'} seats</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
