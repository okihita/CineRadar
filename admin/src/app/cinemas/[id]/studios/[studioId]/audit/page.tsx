'use client';

import { useState, useMemo, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudioLayoutViewer } from '@/features/cinemas/components/StudioLayoutViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ExternalLink, ShieldCheck, Zap, History, FileCode, Search, Table } from 'lucide-react';
import Link from 'next/link';
import type { Studio } from '@/features/cinemas/hooks/useTheatreStudios';
import { cn } from '@/lib/utils';
import { JsonViewer, sortObjectKeys } from '@/components/JsonViewer';
import type { TixRawPayload } from '@/features/cinemas/utils/layout-parser';

interface PageProps {
    params: Promise<{
        id: string;
        studioId: string;
    }>;
}

/**
 * Sidebar Component for Evidence Selection
 */
function AuditSidebar({ 
    theatreId, 
    studio, 
    activeDay, 
    onSelect, 
    isLoading 
}: { 
    theatreId: string; 
    studio: Studio; 
    activeDay: number; 
    onSelect: (idx: number) => void;
    isLoading: boolean;
}) {
    const evidence = studio.evidence || [];

    return (
        <div className="w-80 border-r flex flex-col bg-muted/5 shrink-0">
            <div className="p-4 border-b space-y-4">
                <Link href={`/cinemas/${theatreId}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Theatre
                    </Button>
                </Link>
                <div className="space-y-1">
                    <h2 className="font-bold text-lg tracking-tight uppercase text-foreground">Studio {studio.id}</h2>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
                            {studio.room_category || 'REGULAR'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-600 border-blue-200 bg-blue-50/50">
                            V{studio.version}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 text-foreground">
                <div className="space-y-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Master Source</p>
                    <Button 
                        variant={activeDay === -1 ? "secondary" : "ghost"} 
                        className={cn(
                            "w-full justify-start h-12 gap-3 transition-all",
                            activeDay === -1 && "border-l-4 border-primary rounded-l-none bg-primary/5 shadow-sm"
                        )}
                        onClick={() => onSelect(-1)}
                    >
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <div className="flex flex-col items-start text-left">
                            <span className="text-xs font-bold uppercase tracking-tight">Digital Twin</span>
                            <span className="text-[9px] text-muted-foreground opacity-70 italic">Final Consolidated Truth</span>
                        </div>
                    </Button>
                </div>

                <div className="space-y-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Historical Evidence</p>
                    <div className="space-y-1.5">
                        {evidence.map((ev, idx) => (
                            <Button
                                key={idx}
                                variant={activeDay === idx ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start h-auto py-2.5 px-3 gap-3 transition-all text-left",
                                    activeDay === idx && "border-l-4 border-amber-500 rounded-l-none bg-amber-500/5 shadow-sm"
                                )}
                                onClick={() => onSelect(idx)}
                                disabled={isLoading}
                            >
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate leading-tight uppercase tracking-tighter text-foreground/90">{ev.movie_title || ev.movie}</span>
                                    <span className="text-[11px] text-muted-foreground mt-1 font-semibold">
                                        {new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}, {ev.time}
                                    </span>
                                    {ev.price && (
                                        <span className="text-[10px] text-primary font-mono mt-0.5 font-bold">
                                            Rp {ev.price.toLocaleString('id-ID')}
                                        </span>
                                    )}
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t bg-muted/10 text-[9px] text-muted-foreground/60 italic leading-relaxed text-center uppercase tracking-tighter">
                Refined via 7-day Multi-Showtime Consensus
            </div>
        </div>
    );
}

export default function StudioAuditPage({ params }: PageProps) {
    const { id: theatreId, studioId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const activeDay = searchParams.get('day') ? parseInt(searchParams.get('day')!) - 1 : -1;

    const [studio, setStudio] = useState<Studio | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [proofCache, setProofCache] = useState<Record<number, Record<string, unknown>>>({});
    const [isLoadingProof, setIsLoadingProof] = useState(false);

    useEffect(() => {
        fetch(`/api/theatres/${theatreId}/studios`)
            .then(res => res.json())
            .then((studios: Studio[]) => {
                const found = studios.find(s => s.id === studioId);
                setStudio(found || null);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch studio:', err);
                setIsLoading(false);
            });
    }, [theatreId, studioId]);

    const evidence = useMemo(() => studio?.evidence || [], [studio]);

    const handleSelect = useCallback((index: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (index === -1) {
            params.delete('day');
        } else {
            params.set('day', (index + 1).toString());
        }
        router.push(`?${params.toString()}`);
    }, [searchParams, router]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeDay < evidence.length - 1) handleSelect(activeDay + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeDay > -1) handleSelect(activeDay - 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeDay, evidence.length, handleSelect]);

    // Load Proof Sample
    useEffect(() => {
        if (activeDay === -1 || !evidence[activeDay] || proofCache[activeDay]) return;
        const ev = evidence[activeDay];
        const fetchProof = async () => {
            setIsLoadingProof(true);
            try {
                const res = await fetch(`/api/performance/${ev.movie_id}/days/${ev.date}/showtimes/${ev.showtime_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setProofCache(prev => ({ ...prev, [activeDay]: data }));
                }
            } catch (err) {
                console.error('Failed to load proof:', err);
            } finally {
                setIsLoadingProof(false);
            }
        };
        fetchProof();
    }, [activeDay, evidence, proofCache]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse font-bold text-xs tracking-widest uppercase">Initializing forensic environment...</p>
        </div>
    );

    if (!studio) return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-10 text-center bg-background text-foreground">
            <h1 className="text-xl font-bold uppercase tracking-tight">Studio {studioId} Not Found</h1>
            <Link href={`/cinemas/${theatreId}`}>
                <Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Return to Theatre</Button>
            </Link>
        </div>
    );

    const currentTitle = activeDay === -1 ? 'Master Digital Twin' : `Historical Proof Day ${activeDay + 1}`;
    const inspectorData = activeDay === -1 ? studio : proofCache[activeDay];
    const inspectorTitle = activeDay === -1 ? 'Consolidated Master Schema' : 'Raw API Proof Specimen';
    const inspectorIcon = activeDay === -1 ? <FileCode className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5 text-amber-500" />;
    const totalCapacity = studio.physical_layout?.total_capacity || 0;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <AuditSidebar 
                theatreId={theatreId} 
                studio={studio} 
                activeDay={activeDay} 
                onSelect={handleSelect} 
                isLoading={isLoadingProof} 
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-12 border-b flex items-center justify-between px-6 bg-background shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            {activeDay === -1 ? <Zap className="w-4 h-4 text-primary" /> : <History className="w-4 h-4 text-amber-600" />}
                            <h1 className="font-bold tracking-tight text-xs uppercase">{currentTitle}</h1>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono h-5 py-0 bg-primary/5 text-primary border-primary/20">
                            <Table className="w-3 h-3 mr-1.5 opacity-50" />
                            {totalCapacity} Physical Capacity
                        </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <a 
                                href={activeDay === -1 
                                    ? `https://console.cloud.google.com/firestore/databases/-default-/data/panel/theatres/${theatreId}/studios/${studioId}?project=cineradar-481014`
                                    : `https://console.cloud.google.com/firestore/databases/-default-/data/panel/movie_performance_v2/${evidence[activeDay].movie_id}/days/${evidence[activeDay].date}/showtimes/${evidence[activeDay].showtime_id}?project=cineradar-481014`
                                }
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase transition-all shadow-sm"
                            >
                                <ExternalLink className="w-3 h-3" /> 
                                {activeDay === -1 ? 'Template Source' : 'Evidence Source'}
                            </a>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 bg-muted/5 space-y-4">
                    {/* Seating Visualization Card - Solid State (Never unmounts) */}
                    <Card className="shadow-lg border-primary/10 overflow-hidden">
                        <CardContent className="p-6 bg-background min-h-[300px]">
                            <StudioLayoutViewer 
                                showLegend={true}
                                proofData={proofCache[activeDay] as TixRawPayload}
                                studio={studio}
                                isLoading={isLoadingProof}
                            />
                        </CardContent>
                    </Card>

                    {/* The Single Adaptive Inspector */}
                    <Card className="shadow-lg border-primary/10 flex flex-col min-h-[500px]">
                        <CardHeader className="py-2.5 px-4 border-b bg-muted/20 shrink-0 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 opacity-70">
                                {inspectorIcon}
                                {inspectorTitle}
                            </CardTitle>
                            <div className="text-[9px] font-mono opacity-40 uppercase">
                                Specimen ID: {activeDay === -1 ? studio.id : evidence[activeDay]?.showtime_id}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden bg-background">
                            <div className="h-full overflow-auto p-4">
                                {isLoadingProof ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary/20" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">Parsing Specimen...</span>
                                    </div>
                                ) : (
                                    <JsonViewer data={inspectorData ? sortObjectKeys(inspectorData as Record<string, unknown>) : {}} />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
}
