export type StreamLayoutMode = 'landscape' | 'vertical';

export interface StreamMovieItem {
    id: string;
    rank: number;
    title: string;
    poster: string;
    showtimes: number;
    showtimeSharePct: number;
    estimatedAdmissions: number;
    totalSeats: number;
    avgOccupancyPct: number;
    merchants: string[];
    citiesCount: number;
    genres?: string;
    ageCategory?: string;
    isPremiere?: boolean;
    lastSweptAt?: string;
}

export interface StreamCircuitBreakdown {
    name: 'XXI' | 'CGV' | 'Cinépolis' | 'FLIX';
    showtimes: number;
    theatres: number;
    sharePct: number;
}

export interface StreamSummaryMetrics {
    date: string;
    totalShowtimes: number;
    totalEstimatedAdmissions: number;
    totalMonitoredSeats: number;
    nationalAvgOccupancyPct: number;
    activeMoviesCount: number;
    circuits: StreamCircuitBreakdown[];
    lastSweptAt: string | null;
}
