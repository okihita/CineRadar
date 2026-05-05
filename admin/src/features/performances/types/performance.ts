import { MarketingMetadata } from './social';

export interface ShowtimeSnapshot {
    id: string;
    showtime_id: string;
    movie_title: string;
    theatre_name: string;
    theatre_id: string;
    city: string;
    room_category: string;
    merchant: string;
    showtime: string;
    total_seats: number;
    sold_seats: number;
    occupancy_pct: number;
    price?: number;
    initial_unavailable?: number;
    final_unavailable?: number;
    audience_count?: number;
    audience_pct?: number;
    scrape_phase?: string;
    scraped_at?: string;
    studio_id?: string;
    metadata_id?: string;
    movie_id?: string;
    date?: string;
}

export interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
    director?: string;
    production_house?: string;
    actors?: string[];
    marketing?: MarketingMetadata;
    // Aggregated stats
    avg_occupancy_pct?: number;
    total_sold?: number;
    total_seats?: number;
    total_showtimes?: number;
    total_showtimes_scraped?: number;
}

export interface ForensicAggregation {
    total_sold: number;
    total_seats: number;
    showtime_count: number;
    audited_count: number;
    true_occupancy_pct: number;
}

export interface TodayStats {
    date: string;
    total_showtimes: number;
    total_showtimes_scraped: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
    last_swept_at?: string;
}

export interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
    last_swept_at?: string;
}

export interface DailyPerformanceWithMeta extends DailyPerformance {
    id: string;
    movie_id: string;
    title: string;
    marketing?: MarketingMetadata;
}

export interface MovieWithStats {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    today?: TodayStats;
}

export interface DiagnosticItem {
    id: string;
    title: string;
    has_metadata: boolean;
    has_performance: boolean;
    has_schedule: boolean;
    showtimes_count: number;
}

export interface DiagnosticData {
    total_discovered: number;
    active_count: number;
    scheduled_count: number;
    items: DiagnosticItem[];
}

export interface CastMember {
    cast_type: string;
    name?: string;
    actor_name?: string;
}

export type SortDirection = 'asc' | 'desc';

/** API response shape for GET /api/showtimes/[showtimeId]/raw */
export interface RawShowtimeResponse {
    showtimeId: string;
    movieTitle: string;
    theatreName: string;
    city: string;
    roomCategory: string;
    merchant: string;
    showtime: string;
    date: string;
    occupancyPct: number;
    totalSeats: number;
    soldSeats: number;
    scrapedAt: string;
    rawApiResponse: object | null;
    initialLayout: unknown;
    finalLayout: unknown;
    masterLayout: unknown;
    isInferred: boolean;
    inferredStudioId?: string;
}
