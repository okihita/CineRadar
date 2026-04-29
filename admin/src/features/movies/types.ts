/** Shared movie types for the movies feature module. */

/** Raw Firestore movie document shape */
export interface FirestoreMovie {
    id?: string;
    movie_id?: string;
    name?: string;
    title?: string;
    poster_path?: string;
    scraped_at?: string;
    release_date?: number;
    age_category?: string;
    genres?: Array<{ id: string; name: string }>;
    rating_score?: {
        vote_average?: number;
        vote_count?: number;
    };
}

/** Unified movie used in the database list UI */
export interface UnifiedMovie {
    id: string;
    movie_id: string;
    tix_metadata_id: string;
    title: string;
    poster: string;
    is_showing_today: boolean;
    last_updated: string;
    release_date: number;
    age_category: string;
    genres: string[];
    rating?: {
        average: number;
        count: number;
    };
}

/** API response shape for GET /api/movies */
export interface MovieDatabaseResponse {
    success: boolean;
    date: string;
    movies: UnifiedMovie[];
    error?: string;
}

/** API response shape for GET /api/movies/[id] */
export interface MovieDetailResponse {
    success: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie?: Record<string, any>;
    error?: string;
}
