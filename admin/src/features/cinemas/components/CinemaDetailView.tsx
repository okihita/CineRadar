'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Building2, Calendar, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCinemaDetails } from '../hooks/useCinemaDetails';
import { CinemaPerformanceTable } from '@/features/performances_v2/components/CinemaPerformanceTable';
import { getRegion } from '@/lib/regions';
import { TheatreDetailPanel } from './TheatreDetailPanel';

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

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : showtimes.length > 0 ? (
                        <CinemaPerformanceTable showtimes={showtimes} />
                    ) : (
                        <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed">
                            <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                            <p className="text-muted-foreground">No showtimes found for {selectedDate}.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <TheatreDetailPanel theatre={theatre} apiKey={apiKey} showIntelligenceLink={false} />
                </div>
            </div>
        </div>
    );
}
