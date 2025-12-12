export interface Theatre {
    theatre_id: string;
    name: string;
    merchant: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    place_id?: string;
    room_types: string[];
    last_seen: string;
    created_at: string;
    updated_at: string;
}

export interface ScraperRun {
    id?: string;
    status: string;
    movies: number;
    cities: number;
    theatres_synced: number;
    date: string;
    timestamp: string;
}
