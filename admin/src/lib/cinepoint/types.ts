/**
 * Shared types for CinePoint analysis pages.
 *
 * Single source of truth — all consumer pages import from here.
 */

/** Lightweight movie record returned by the analysis API */
export interface AnalysisMovie {
  id: number;
  title: string;
  type: string;
  language: string;
  genres: string[];
  duration: number;
  total_admission: number;
  score: number;
  rating_category: string[];
  directors: string[];
  actors: string[];
  release_year: number;
}

/** Computed stats for a ranked person (actor or director) */
export interface PersonRanking {
  name: string;
  movie_count: number;
  avg_admission: number;
  median_admission: number;
  total_admission: number;
  best_movie: { id: number; title: string; total_admission: number } | null;
  hit_rate: number;
}

/** Computed stats for a person's detail page */
export interface PersonDetailStats {
  total_movies: number;
  with_admissions: number;
  total_admissions: number;
  avg_admission: number;
  median_admission: number;
  best_movie: AnalysisMovie | null;
  hit_count: number;
  hit_rate: number;
  genres: string[];
  avg_score: number;
}

/** Computed overview statistics */
export interface OverviewStats {
  total_movies: number;
  with_admissions: number;
  total_admissions: number;
  avg_admission: number;
  median_admission: number;
  tiers: Record<string, number>;
}

/** Computed genre statistics */
export interface GenreStat {
  genre: string;
  count: number;
  with_admissions: number;
  avg_admission: number;
  median_admission: number;
  hit_rate_pct: number;
  avg_score: number;
  total_admission: number;
}

/** Computed language statistics */
export interface LanguageStat {
  count: number;
  with_admissions: number;
  avg_admission: number;
  median_admission: number;
  total_admission: number;
  hit_rate_pct: number;
  top_genres: { genre: string; count: number; avg_admission: number }[];
}

/** Computed rating statistics */
export interface RatingStat {
  rating: string;
  count: number;
  avg_admission: number;
  median_admission: number;
}

/** Computed duration bucket */
export interface DurationBucket {
  range: string;
  count: number;
  avg_admission: number;
  median_admission: number;
}

/** Computed genre combination */
export interface GenreCombo {
  combo: string;
  genres: string[];
  count: number;
  avg_admission: number;
}

/** Factor toggle state for the filter panel */
export interface FactorState {
  genre: boolean;
  director: boolean;
  actor: boolean;
  language: boolean;
  duration: boolean;
  rating: boolean;
}

// ─── Box Office API Types ───────────────────────────────────

export interface DailyTotal {
  date: string;
  total_admissions: number;
  total_showtimes: number;
  movie_count: number;
  local_admissions: number;
  international_admissions: number;
}

export interface MovieDaily {
  date: string;
  admission: number;
  rank: number;
  change: number;
  total_admission: number;
  showtimes: number;
  score: number;
}

export interface MovieRanking {
  id: number;
  title: string;
  type: string;
  image_title: string | null;
  movie_genre: string[];
  release_date: string;
  daily: MovieDaily[];
  total_period_admissions: number;
  latest_total_admission: number;
  latest_score: number;
  latest_rank: number | null;
  peak_admission: number;
  opening_admission: number | null;
}

export interface TopMover extends MovieRanking {
  rank_change: number;
  first_rank: number;
  last_rank: number;
}

export interface YearSummary {
  year: number;
  dates_with_data: number;
  total_admissions: number;
  local_admissions: number;
  international_admissions: number;
  unique_movies: number;
  top_movie: {
    movie_id: number;
    title: string;
    type: string;
    total_admissions: number;
    movie_genre: string[];
    release_date: string;
    score: number;
  } | null;
  top_local: { movie_id: number; title: string; total_admissions: number; movie_genre: string[] } | null;
  top_international: { movie_id: number; title: string; total_admissions: number; movie_genre: string[] } | null;
}

export interface BoxOfficeData {
  success: boolean;
  has_data: boolean;
  meta: {
    date_range: { start: string; end: string };
    days_with_data: number;
    unique_movies: number;
    grand_total_admissions: number;
    avg_daily_admissions: number;
    peak_day: { date: string; admissions: number } | null;
    top_movie: { title: string; total_period_admissions: number; latest_total_admission: number } | null;
  };
  daily_totals: DailyTotal[];
  movie_rankings: MovieRanking[];
  top_movers: TopMover[];
  genre_breakdown: { genre: string; admissions: number }[];
  day_of_week: { day: string; avg_admissions: number; total_admissions: number; days_count: number }[];
  new_releases: MovieRanking[];
  sync_meta?: {
    status: string;
    date_start: string;
    date_end: string;
    last_scraped_date: string | null;
    docs_written: number;
    dates_scraped: number;
  } | null;
}
