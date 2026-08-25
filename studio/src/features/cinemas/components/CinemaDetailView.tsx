'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    MapPin, 
    ChevronLeft, 
    ChevronRight, 
    ExternalLink,
    Map,
    ArrowUpRight,
    Loader2,
    ListFilter,
    Gauge,
    HardDrive,
    Copy,
    Check,
    Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MerchantBadge } from '@/components/MerchantBadge';
import { TheatreStudiosList } from './TheatreStudiosList';
import { useCinemaDetails } from '../hooks/useCinemaDetails';
import { useCinemasStore } from '../stores/useCinemasStore';
import type { PerformanceMetrics } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CinemaDetailSkeleton } from './CinemaSkeletons';

interface CinemaDetailViewProps {
    theatreId: string;
}

export function CinemaDetailView({ theatreId }: CinemaDetailViewProps) {
    const { theatre, loading, error } = useCinemaDetails(theatreId);
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    
    const { 
        filteredTheatreIds, 
        selectedMerchant, 
        selectedRegion, 
        searchTerm 
    } = useCinemasStore();
    
    const handleCopyId = () => {
        if (!theatre) return;
        navigator.clipboard.writeText(theatre.theatre_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const navContext = useMemo(() => {
        if (!filteredTheatreIds || filteredTheatreIds.length === 0) return null;
        const currentIndex = filteredTheatreIds.indexOf(theatreId);
        if (currentIndex === -1) return null;
        
        const activeFilters = [];
        if (selectedMerchant && selectedMerchant !== 'all') activeFilters.push(selectedMerchant);
        if (selectedRegion && selectedRegion !== 'all') activeFilters.push(selectedRegion);
        if (searchTerm) {
            const truncated = searchTerm.length > 15 ? `${searchTerm.substring(0, 12)}...` : searchTerm;
            activeFilters.push(`"${truncated}"`);
        }

        return {
            current: currentIndex + 1,
            total: filteredTheatreIds.length,
            prevId: currentIndex > 0 ? filteredTheatreIds[currentIndex - 1] : null,
            nextId: currentIndex < filteredTheatreIds.length - 1 ? filteredTheatreIds[currentIndex + 1] : null,
            filterText: activeFilters.length > 0 ? activeFilters.join(' • ') : 'All Indonesia'
        };
    }, [filteredTheatreIds, theatreId, selectedMerchant, selectedRegion, searchTerm]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft' && navContext?.prevId) {
                router.push(`/cinemas/${navContext.prevId}`);
            } else if (e.key === 'ArrowRight' && navContext?.nextId) {
                router.push(`/cinemas/${navContext.nextId}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navContext, router]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                    <p className="text-red-600 font-bold uppercase text-sm tracking-tight">Error Loading Theatre</p>
                    <p className="text-red-400 text-sm mt-1 italic">{error || 'Theatre not found in registry'}</p>
                </div>
                <Link href="/cinemas">
                    <Button variant="outline" size="sm">Return to Registry</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 min-h-screen">
            {/* Header Navigation - STRICT HEIGHT */}
            <div className="flex items-center justify-between h-8 overflow-hidden">
                <div className="flex items-center gap-2">
                    <Link href="/cinemas">
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="w-4 h-4" /> Back to Registry
                        </Button>
                    </Link>
                </div>
                
                {navContext && (
                    <div className="flex items-center h-8 gap-4 bg-muted/20 px-3 rounded-lg border border-border/50 shadow-sm overflow-hidden animate-in fade-in duration-300">
                        <div className="hidden lg:flex items-center h-full gap-2 border-r border-border/50 pr-4 mr-1">
                            <Tag className="w-2.5 h-2.5 text-primary/50" />
                            <span className="text-sm font-black uppercase tracking-tight text-primary/60 truncate max-w-[200px]">
                                {navContext.filterText}
                            </span>
                        </div>

                        <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-border/50 bg-background/50 text-sm font-black text-muted-foreground/40 uppercase tracking-widest">
                            <span className="border rounded px-1 px-0.5">←</span>
                            <span className="border rounded px-1 px-0.5">→</span>
                            <span>to cycle</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tighter text-muted-foreground/70">
                            <ListFilter className="w-3 h-3" />
                            <span>Theatre {navContext.current} of {navContext.total}</span>
                        </div>

                        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/50">
                            <Button 
                                variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/5"
                                disabled={!navContext.prevId}
                                onClick={() => navContext.prevId && router.push(`/cinemas/${navContext.prevId}`)}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/5"
                                disabled={!navContext.nextId}
                                onClick={() => navContext.nextId && router.push(`/cinemas/${navContext.nextId}`)}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Theatre Card vs Skeleton */}
            {loading || !theatre ? (
                <CinemaDetailSkeleton />
            ) : (
                <Card className="shadow-lg border-primary/10 overflow-hidden bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <CardHeader className="p-6">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div className="space-y-2 flex-1 overflow-hidden">
                                {/* Row 1: Merchant + ID - FORCE 20px HEIGHT */}
                                <div className="flex items-center gap-3 h-5 overflow-hidden">
                                    <MerchantBadge merchant={theatre.merchant} className="h-5" variant="outline" />
                                    <div className="flex items-center gap-1.5 group cursor-pointer h-5 overflow-hidden" onClick={handleCopyId}>
                                        <span className="text-sm font-mono text-muted-foreground/60 uppercase tracking-tighter transition-colors group-hover:text-primary leading-none flex items-center h-full">
                                            ID: {theatre.theatre_id}
                                        </span>
                                        <div className="flex items-center justify-center w-4 h-4 rounded hover:bg-muted transition-colors">
                                            {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5 text-muted-foreground/40 group-hover:text-primary" />}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Row 2: Title + Stats - FORCE 32px HEIGHT */}
                                <div className="flex items-baseline gap-3 flex-wrap min-h-[2rem] pt-1 overflow-hidden">
                                    <div className="flex items-center h-8">
                                        <CardTitle className="text-2xl font-black tracking-tight uppercase leading-none">{theatre.name}</CardTitle>
                                    </div>
                                    <div className="flex items-center h-8 gap-3">
                                        <span className="text-muted-foreground opacity-30 font-light text-xl leading-none">•</span>
                                        <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground/80 leading-none">
                                            {theatre.studio_count || 0} Studios
                                        </span>
                                        <span className="text-muted-foreground opacity-30 font-light text-xl leading-none">•</span>
                                        <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground/80 leading-none">
                                            {(theatre.total_capacity || 0).toLocaleString()} Total Capacity
                                        </span>
                                    </div>
                                </div>

                                {/* Row 3: Address - FORCE 16px HEIGHT */}
                                <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1 h-4 overflow-hidden">
                                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                                    <div className="flex items-center h-full gap-2">
                                        <span className="font-bold uppercase whitespace-nowrap leading-none">{theatre.city}</span>
                                        <span className="opacity-30 leading-none">|</span>
                                        <span className="italic max-w-2xl truncate leading-none">{theatre.address}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-3 shrink-0 h-full">
                                <div className="flex items-center h-6 gap-2">
                                    <div className="flex items-center h-full gap-3 text-sm font-mono text-muted-foreground/40 bg-muted/20 px-3 rounded-full border border-border/50 shadow-sm w-[180px] justify-center relative overflow-hidden">
                                        {metrics ? (
                                            <div className="flex items-center h-full w-full">
                                                <div className="flex items-center gap-1.5 font-bold uppercase tracking-tighter flex-1 justify-center leading-none">
                                                    <Gauge className="w-2.5 h-2.5 opacity-50" />
                                                    <span>{metrics.latencyMs}ms</span>
                                                </div>
                                                <span className="opacity-20 leading-none">|</span>
                                                <div className="flex items-center gap-1.5 font-bold uppercase tracking-tighter flex-1 justify-center leading-none">
                                                    <HardDrive className="w-2.5 h-2.5 opacity-50" />
                                                    <span>{Math.round(metrics.sizeKB)} KB</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 opacity-30 animate-pulse justify-center w-full">
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                <span className="text-sm font-bold uppercase tracking-widest leading-none">Profiling Link...</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-center w-10 h-full rounded bg-primary/5 border border-primary/20 text-sm font-black text-primary uppercase leading-none">
                                        V{theatre.version || '2.0'}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 h-8">
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${theatre.lat},${theatre.lng}`}
                                        target="_blank" rel="noopener noreferrer"
                                    >
                                        <Button variant="outline" size="sm" className="h-8 gap-2 text-sm font-bold uppercase border-primary/20 hover:bg-primary/5">
                                            <Map className="w-3 h-3" /> Maps <ArrowUpRight className="w-2.5 h-2.5 opacity-50" />
                                        </Button>
                                    </a>
                                    <a 
                                        href={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/theatres/${theatre.theatre_id}?project=cineradar-481014`}
                                        target="_blank" rel="noopener noreferrer"
                                    >
                                        <Button variant="outline" size="sm" className="h-8 gap-2 text-sm font-bold uppercase border-primary/20 hover:bg-primary/5">
                                            <ExternalLink className="w-3 h-3" /> Source
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <div className="pt-2">
                <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="h-4 w-1 bg-primary rounded-full shadow-sm" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Physical Asset Registry</h2>
                </div>
                <TheatreStudiosList 
                    key={theatreId}
                    theatreId={theatreId} 
                    merchant={theatre?.merchant} 
                    expectedCount={theatre?.studio_count || 4}
                    onMetricsLoad={setMetrics}
                />
            </div>
        </div>
    );
}
