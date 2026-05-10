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
