'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, Home, MapPin, Building2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShowtimeSnapshot } from './ShowtimeTable';
import { cn } from '@/lib/utils';

// --- Types ---

export type ViewLevel = 'MARKET' | 'CITY' | 'CINEMA';

interface Breadcrumb {
    label: string;
    level: ViewLevel;
    id?: string;
}

interface ForensicPerformanceHubProps {
    showtimes: ShowtimeSnapshot[];
    movieId: string;
    date: string;
}

import { MarketMarketTable } from './MarketMarketTable';
import { RegionalCinemaTable } from './RegionalCinemaTable';
import { ForensicShowtimeTable } from './ForensicShowtimeTable';
import { ShowtimeTable } from './ShowtimeTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Main Hub Component ---

export function ForensicPerformanceHub({ showtimes, movieId, date }: ForensicPerformanceHubProps) {
    const [viewMode, setViewMode] = useState<'HIERARCHY' | 'FEED'>('HIERARCHY');
    const [viewLevel, setViewLevel] = useState<ViewLevel>('MARKET');
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [selectedCinema, setSelectedCinema] = useState<string | null>(null);

    // Navigation Actions
    const drillToCity = (city: string) => {
        setSelectedCity(city);
        setViewLevel('CITY');
    };

    const drillToCinema = (theatreId: string) => {
        setSelectedCinema(theatreId);
        setViewLevel('CINEMA');
    };

    const goBack = () => {
        if (viewLevel === 'CINEMA') setViewLevel('CITY');
        else if (viewLevel === 'CITY') setViewLevel('MARKET');
    };

    const resetToNational = () => {
        setSelectedCity(null);
        setSelectedCinema(null);
        setViewLevel('MARKET');
    };

    // Breadcrumbs Calculation
    const breadcrumbs = useMemo(() => {
        const items: Breadcrumb[] = [{ label: 'National Market', level: 'MARKET' }];
        if (selectedCity) items.push({ label: selectedCity, level: 'CITY' });
        if (selectedCinema) {
            const cinemaName = showtimes.find(st => st.theatre_id === selectedCinema)?.theatre_name || 'Cinema';
            items.push({ label: cinemaName, level: 'CINEMA' });
        }
        return items;
    }, [selectedCity, selectedCinema, showtimes]);

    // Data Slicing for current view
    const filteredData = useMemo(() => {
        if (viewLevel === 'MARKET') return showtimes;
        if (viewLevel === 'CITY') return showtimes.filter(st => st.city === selectedCity);
        if (viewLevel === 'CINEMA') return showtimes.filter(st => st.theatre_id === selectedCinema);
        return showtimes;
    }, [showtimes, viewLevel, selectedCity, selectedCinema]);

    return (
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'HIERARCHY' | 'FEED')} className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="HIERARCHY">By Market / City</TabsTrigger>
                    <TabsTrigger value="FEED">Global Audit Feed</TabsTrigger>
                </TabsList>

                {viewMode === 'HIERARCHY' && (
                    <div className="flex items-center gap-2 px-1 text-sm overflow-x-auto no-scrollbar py-1 bg-muted/20 rounded-lg border border-border/40">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                                "h-7 gap-1.5 hover:bg-background/50 px-2",
                                viewLevel === 'MARKET' ? "text-primary font-black" : "text-muted-foreground"
                            )}
                            onClick={resetToNational}
                        >
                            <Home className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">National</span>
                        </Button>

                        {breadcrumbs.slice(1).map((bc, idx) => (
                            <React.Fragment key={bc.level}>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-7 gap-1.5 hover:bg-background/50 px-2",
                                        idx === breadcrumbs.length - 2 ? "text-primary font-black" : "text-muted-foreground"
                                    )}
                                    onClick={() => {
                                        setViewLevel(bc.level);
                                        if (bc.level === 'CITY') setSelectedCinema(null);
                                    }}
                                >
                                    {bc.level === 'CITY' ? <MapPin className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{bc.label}</span>
                                </Button>
                            </React.Fragment>
                        ))}

                        {viewLevel !== 'MARKET' && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 ml-auto gap-1 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-3"
                                onClick={goBack}
                            >
                                <ArrowLeft className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Go Back</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <TabsContent value="HIERARCHY" className="mt-0 space-y-6">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {viewLevel === 'MARKET' && (
                        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                            <MarketMarketTable showtimes={showtimes} onDrillDown={drillToCity} />
                        </div>
                    )}

                    {viewLevel === 'CITY' && (
                        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                            <RegionalCinemaTable showtimes={filteredData} onDrillDown={drillToCinema} />
                        </div>
                    )}

                    {viewLevel === 'CINEMA' && (
                        <div className="space-y-4">
                            <ForensicShowtimeTable showtimes={filteredData} movieId={movieId} date={date} />
                        </div>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="FEED" className="mt-0">
                <ShowtimeTable showtimes={showtimes} loading={false} movieId={movieId} date={date} />
            </TabsContent>
        </Tabs>
    );
}
