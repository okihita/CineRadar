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
}

export interface ForensicAggregation {
    total_sold: number;
    total_seats: number;
    showtime_count: number;
    audited_count: number;
    true_occupancy_pct: number;
}
