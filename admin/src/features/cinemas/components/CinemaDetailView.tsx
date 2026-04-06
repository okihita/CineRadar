'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Building2, Calendar, Loader2, Info, Map as MapIcon, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCinemaDetails } from '../hooks/useCinemaDetails';
import { CinemaPerformanceTable } from '@/features/performances_v2/components/CinemaPerformanceTable';
import { getRegion } from '@/lib/regions';
import { TheatreStudiosList } from './TheatreStudiosList';

interface CinemaDetailViewProps {
    theatreId: string;
}

export function CinemaDetailView({ theatreId }: CinemaDetailViewProps) {
    const router = useRouter();
    const today = useMemo(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }), []);
    const [selectedDate, setSelectedDate] = useState(today);
    
    const { theatre, showtimes, loading, error } = useCinemaDetails(theatreId, selectedDate);
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/cinemas')}
                        className="mt-1"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold tracking-tight">{theatre.name}</h1>
                            <Badge className={
                                theatre.merchant === 'XXI' ? 'bg-amber-500 hover:bg-amber-600' :
                                theatre.merchant === 'CGV' ? 'bg-red-600 hover:bg-red-700' :
                                'bg-blue-600 hover:bg-blue-700'
                            }>
                                {theatre.merchant}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground text-sm">
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
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                        <Calendar className="w-4 h-4 ml-2 text-muted-foreground" />
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm font-medium focus:outline-none p-1.5"
                        />
                    </div>
                </div>
            </div>

            {/* Top Section: Map & Key Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm ring-1 ring-border">
                    <CardHeader className="py-3 px-4 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-primary" />
                            Location
                        </CardTitle>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-[10px] uppercase tracking-wider font-bold"
                            onClick={() => {
                                const url = theatre.place_id
                                    ? `https://www.google.com/maps/place/?q=place_id:${theatre.place_id}`
                                    : `https://www.google.com/maps?q=${theatre.lat},${theatre.lng}`;
                                window.open(url, '_blank');
                            }}
                        >
                            Open in Google Maps
                        </Button>
                    </CardHeader>
                    <div className="aspect-[21/9] w-full bg-muted/20">
                        <iframe
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(
                                theatre.name + ' ' + theatre.city + ' Indonesia'
                            )}`}
                        />
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

            {/* Main Content: Performance and Studio Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm ring-1 ring-border">
                    <CardHeader className="py-3 px-4 bg-muted/10 border-b">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Performance Data - {selectedDate}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="p-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : showtimes.length > 0 ? (
                                <CinemaPerformanceTable showtimes={showtimes} />
                            ) : (
                                <div className="text-center py-20 bg-muted/5 rounded-xl border border-dashed">
                                    <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-muted-foreground">No showtimes found for {selectedDate}.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border">
                    <CardHeader className="py-3 px-4 bg-muted/10 border-b">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Studio Layouts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <TheatreStudiosList theatreId={theatreId} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
