'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChevronRight, Home, MapPin, Building2, ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShowtimeSnapshot } from '../types/performance';
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

// --- Main Hub Component ---

export function ForensicPerformanceHub({ showtimes, movieId, date }: ForensicPerformanceHubProps) {
    const [viewMode, setViewMode] = useState<'HIERARCHY' | 'FEED'>('HIERARCHY');
    const [viewLevel, setViewLevel] = useState<ViewLevel>('MARKET');
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [selectedCinema, setSelectedCinema] = useState<string | null>(null);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
    
    const hubRef = useRef<HTMLDivElement>(null);

    // Navigation Actions
    const scrollToTop = () => {
        if (hubRef.current) {
            const offset = 120; // Account for sticky header
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = hubRef.current.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const drillToCity = (city: string) => {
        setSlideDirection('left');
        setSelectedCity(city);
        setViewLevel('CITY');
        scrollToTop();
    };

    const drillToCinema = (theatreId: string) => {
        setSlideDirection('left');
        setSelectedCinema(theatreId);
        setViewLevel('CINEMA');
        scrollToTop();
    };

    const goBack = () => {
        setSlideDirection('right');
        if (viewLevel === 'CINEMA') {
            setViewLevel('CITY');
            setSelectedCinema(null);
        } else if (viewLevel === 'CITY') {
            setViewLevel('MARKET');
            setSelectedCity(null);
        }
        scrollToTop();
    };

    const jumpToLevel = (level: ViewLevel) => {
        if (level === viewLevel) return;
        
        // Determine direction based on hierarchy depth
        const depth = { 'MARKET': 0, 'CITY': 1, 'CINEMA': 2 };
        setSlideDirection(depth[level] > depth[viewLevel] ? 'left' : 'right');

        setViewLevel(level);
        if (level === 'CITY') setSelectedCinema(null);
        if (level === 'MARKET') {
            setSelectedCity(null);
            setSelectedCinema(null);
        }
        scrollToTop();
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
        <div ref={hubRef} className="w-full relative scroll-mt-32 min-h-[600px] flex flex-col">
            
            {/* 1. STICKY COMMAND BAR (The 10/10 Upgrade) */}
            <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md pb-4 pt-2 -mx-2 px-2 border-b border-border/40 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Left: Spatial Navigation */}
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    
                    {/* Dedicated Emergency Exit */}
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn(
                            "h-9 w-9 rounded-full flex-shrink-0 shadow-sm transition-all duration-300",
                            viewLevel === 'MARKET' ? "opacity-30 pointer-events-none grayscale" : "border-primary/30 text-primary hover:bg-primary/10 hover:scale-105"
                        )}
                        onClick={goBack}
                        disabled={viewLevel === 'MARKET'}
                        title="Go up one level"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>

                    {/* Interactive Context Pill (Breadcrumbs) */}
                    <div className="flex items-center gap-1.5 px-1.5 py-1 bg-muted/30 rounded-xl border border-border/50 shadow-inner">
                        {breadcrumbs.map((bc, idx) => {
                            const isLast = idx === breadcrumbs.length - 1;
                            const Icon = bc.level === 'MARKET' ? Home : bc.level === 'CITY' ? MapPin : Building2;
                            
                            return (
                                <React.Fragment key={bc.level}>
                                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />}
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className={cn(
                                            "h-7 gap-1.5 px-3 rounded-lg transition-all",
                                            isLast 
                                                ? "bg-background shadow-sm text-foreground font-bold hover:bg-background cursor-default" 
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                        onClick={() => !isLast && jumpToLevel(bc.level)}
                                    >
                                        <Icon className={cn("w-3.5 h-3.5", !isLast && "opacity-70")} />
                                        <span className="text-[10px] uppercase tracking-wider">{bc.label}</span>
                                    </Button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Mode Switcher */}
                <div className="flex items-center bg-muted/20 p-1 rounded-xl border border-border/40">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-4 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            viewMode === 'HIERARCHY' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                            setViewMode('HIERARCHY');
                            scrollToTop();
                        }}
                    >
                        <MapPin className="w-3 h-3 mr-1.5 opacity-70" />
                        Hierarchy
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-4 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            viewMode === 'FEED' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                            setViewMode('FEED');
                            scrollToTop();
                        }}
                    >
                        <Globe className="w-3 h-3 mr-1.5 opacity-70" />
                        Global Feed
                    </Button>
                </div>
            </div>

            {/* 2. DYNAMIC CONTENT AREA */}
            <div className="flex-1 relative overflow-hidden">
                {viewMode === 'HIERARCHY' && (
                    <div 
                        key={viewLevel} // Changing key forces re-render for animation
                        className={cn(
                            "animate-in fade-in duration-500 fill-mode-forwards",
                            slideDirection === 'left' ? "slide-in-from-right-8" : "slide-in-from-left-8"
                        )}
                    >
                        {viewLevel === 'MARKET' && (
                            <div className="border rounded-2xl bg-card overflow-hidden shadow-sm">
                                <MarketMarketTable showtimes={showtimes} onDrillDown={drillToCity} />
                            </div>
                        )}

                        {viewLevel === 'CITY' && (
                            <div className="border rounded-2xl bg-card overflow-hidden shadow-sm">
                                <RegionalCinemaTable showtimes={filteredData} onDrillDown={drillToCinema} />
                            </div>
                        )}

                        {viewLevel === 'CINEMA' && (
                            <div className="space-y-4">
                                <ForensicShowtimeTable showtimes={filteredData} movieId={movieId} date={date} />
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'FEED' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <ShowtimeTable showtimes={showtimes} loading={false} movieId={movieId} date={date} />
                    </div>
                )}
            </div>
        </div>
    );
}
