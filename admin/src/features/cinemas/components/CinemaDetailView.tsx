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
    Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TheatreStudiosList } from './TheatreStudiosList';
import { useCinemaDetails } from '../hooks/useCinemaDetails';
import { useCinemasStore } from '../';
import type { PerformanceMetrics } from '../hooks/useTheatreStudios';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CinemaDetailViewProps {
    theatreId: string;
}

export function CinemaDetailView({ theatreId }: CinemaDetailViewProps) {
    const { theatre, loading, error } = useCinemaDetails(theatreId);
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    
    const { filteredTheatreIds } = useCinemasStore();
    
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
        return {
            current: currentIndex + 1,
            total: filteredTheatreIds.length,
            prevId: currentIndex > 0 ? filteredTheatreIds[currentIndex - 1] : null,
            nextId: currentIndex < filteredTheatreIds.length - 1 ? filteredTheatreIds[currentIndex + 1] : null
        };
    }, [filteredTheatreIds, theatreId]);

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

    const getMerchantColor = (merchant: string) => {
        const m = merchant.toUpperCase();
        if (m.includes('XXI')) return 'text-orange-600 bg-orange-50 border-orange-200';
        if (m.includes('CGV')) return 'text-red-600 bg-red-50 border-red-200';
        if (m.includes('CINEPOLIS')) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (m.includes('FLIX')) return 'text-zinc-800 bg-zinc-100 border-zinc-300';
        return 'text-muted-foreground bg-muted/50 border-border';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest animate-pulse">Retrieving Asset Metadata...</p>
            </div>
        );
    }

    if (error || !theatre) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                    <p className="text-red-600 font-bold uppercase text-xs tracking-tight">Error Loading Theatre</p>
                    <p className="text-red-400 text-[10px] mt-1 italic">{error || 'Theatre not found in registry'}</p>
                </div>
                <Link href="/cinemas">
                    <Button variant="outline" size="sm">Return to Registry</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between h-8">
                <div className="flex items-center gap-2">
                    <Link href="/cinemas">
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="w-4 h-4" /> Back to Registry
                        </Button>
                    </Link>
                </div>
                
                {navContext && (
                    <div className="flex items-center h-8 gap-4 bg-muted/20 px-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/70">
                            <ListFilter className="w-3 h-3" />
                            <span>Theatre {navContext.current} of {navContext.total}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button 
                                variant="ghost" size="sm" className="h-6 w-6 p-0"
                                disabled={!navContext.prevId}
                                onClick={() => navContext.prevId && router.push(`/cinemas/${navContext.prevId}`)}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" size="sm" className="h-6 w-6 p-0"
                                disabled={!navContext.nextId}
                                onClick={() => navContext.nextId && router.push(`/cinemas/${navContext.nextId}`)}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Card className="shadow-lg border-primary/10 overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className={cn("font-bold uppercase tracking-widest text-[10px] h-5", getMerchantColor(theatre.merchant))}>
                                    {theatre.merchant}
                                </Badge>
                                <div className="flex items-center gap-1.5 group cursor-pointer" onClick={handleCopyId}>
                                    <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-tighter transition-colors group-hover:text-primary">
                                        ID: {theatre.theatre_id}
                                    </span>
                                    <div className="flex items-center justify-center w-4 h-4 rounded hover:bg-muted transition-colors">
                                        {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5 text-muted-foreground/40 group-hover:text-primary" />}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-baseline gap-3 flex-wrap">
                                <CardTitle className="text-2xl font-black tracking-tight uppercase leading-none">{theatre.name}</CardTitle>
                                <span className="text-muted-foreground opacity-30 font-light text-xl">•</span>
                                <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground/80">
                                    {theatre.studio_count || 0} Studios
                                </span>
                                <span className="text-muted-foreground opacity-30 font-light text-xl">•</span>
                                <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground/80">
                                    {(theatre.total_capacity || 0).toLocaleString()} Total Capacity
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground text-xs pt-1">
                                <MapPin className="w-3 h-3 text-primary" />
                                <span className="font-bold uppercase">{theatre.city}</span>
                                <span className="opacity-30">|</span>
                                <span className="italic max-w-2xl truncate">{theatre.address}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-3 shrink-0">
                            <div className="flex items-center h-6 gap-2">
                                <div className="flex items-center h-full gap-3 text-[10px] font-mono text-muted-foreground/40 bg-muted/20 px-3 rounded-full border border-border/50 shadow-sm w-[180px] justify-center relative overflow-hidden">
                                    {metrics ? (
                                        <>
                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-tighter flex-1 justify-center">
                                                <Gauge className="w-2.5 h-2.5 opacity-50" />
                                                <span>{metrics.latencyMs}ms</span>
                                            </div>
                                            <span className="opacity-20">|</span>
                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-tighter flex-1 justify-center">
                                                <HardDrive className="w-2.5 h-2.5 opacity-50" />
                                                <span>{metrics.sizeKB} KB</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 opacity-30 animate-pulse justify-center w-full">
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            <span className="text-[8px] font-bold uppercase tracking-widest">Profiling Link...</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-center w-10 h-full rounded bg-primary/5 border border-primary/20 text-[9px] font-black text-primary uppercase">
                                    V{theatre.version || '2.0'}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${theatre.lat},${theatre.lng}`}
                                    target="_blank" rel="noopener noreferrer"
                                >
                                    <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-bold uppercase border-primary/20 hover:bg-primary/5">
                                        <Map className="w-3 h-3" /> Maps <ArrowUpRight className="w-2.5 h-2.5 opacity-50" />
                                    </Button>
                                </a>
                                <a 
                                    href={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/theatres/${theatre.theatre_id}?project=cineradar-481014`}
                                    target="_blank" rel="noopener noreferrer"
                                >
                                    <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-bold uppercase border-primary/20 hover:bg-primary/5">
                                        <ExternalLink className="w-3 h-3" /> Source
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="pt-2">
                <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="h-4 w-1 bg-primary rounded-full shadow-sm" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Physical Asset Registry</h2>
                </div>
                <TheatreStudiosList 
                    key={theatre.theatre_id}
                    theatreId={theatre.theatre_id} 
                    merchant={theatre.merchant} 
                    onMetricsLoad={setMetrics}
                />
            </div>
        </div>
    );
}
