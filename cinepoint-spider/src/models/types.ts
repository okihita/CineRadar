/**
 * Cinepoint Data Models
 */

// Movie metadata from Cinepoint directory
export interface CinepointMovie {
    id: number;
    title: string;
    originalTitle?: string;
    posterUrl: string;
    backdropUrl?: string;
    genre: string[];
    duration: number; // minutes
    releaseDate: string; // YYYY-MM-DD
    country: 'Local' | 'International' | string;
    rating: string; // "SU", "R13+", "D17+", "R21+"
    synopsis: string;
    cast: string[];
    directors: string[];
    cinepointScore?: number;
    totalAdmissions?: number;
    status: 'now_playing' | 'upcoming' | 'ended';
    lastUpdated: string;
}

// Box office record (daily/weekly/monthly/yearly)
export interface BoxOfficeRecord {
    movieId: number;
    movieTitle: string;
    date: string; // YYYY-MM-DD
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    rank: number;
    admissions: number; // period admissions
    totalAdmissions: number; // cumulative
    showtimes?: number;
    marketShare?: number; // percentage
    rankChange?: number; // positive = up, negative = down
    admissionChange?: number; // % change
    scrapedAt: string;
}

// Daily showtime ranking
export interface ShowtimeRanking {
    movieId: number;
    movieTitle: string;
    date: string;
    rank: number;
    showtimeCount: number;
    showtimeChange: number; // change from previous day
    marketSharePercent: number;
    scrapedAt: string;
}

// Industry insight article
export interface InsightArticle {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string; // HTML or markdown
    publishedAt: string;
    category: string;
    imageUrl?: string;
    scrapedAt: string;
}

// API response wrappers
export interface CinepointApiResponse<T> {
    status: number;
    data: T;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// Daily showtime API response item
export interface DailyShowtimeItem {
    id: number;
    title: string;
    poster: string;
    showtime_pct: number;
    showtime_count: number;
    showtime_delta: number;
    rank: number;
}

// Box office API response item
export interface BoxOfficeItem {
    id: number;
    title: string;
    poster: string;
    admission: number;
    admission_total: number;
    rank: number;
    rank_delta: number;
    cinepoint_score?: number;
}

// Movie directory item
export interface MovieDirectoryItem {
    id: number;
    title: string;
    original_title?: string;
    poster: string;
    backdrop?: string;
    genre: string[];
    duration: number;
    release_date: string;
    country: string;
    rating: string;
    synopsis: string;
    cast: { name: string }[];
    directors: { name: string }[];
    status: string;
}
