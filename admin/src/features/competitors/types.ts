/**
 * Competitor tracking types and Firestore schema.
 *
 * Collections:
 *   competitor_snapshots/{date}  — parsed showtime/admission data per date
 *   competitor_tweets/{tweet_id} — raw imported tweets per source
 */

// ─── Firestore Collections ─────────────────────────────────

export const COMPETITOR_COLLECTION = 'competitor_snapshots';
export const TWEET_COLLECTION = 'competitor_tweets';
export const CINEPOINT_CATALOG = 'cinepoint_movies';
export const CINEPOINT_SYNC_META = 'cinepoint_sync_meta';

// ─── Snapshot Document ─────────────────────────────────────

/** A single data point (showtimes or admissions) within a snapshot */
export interface SnapshotDataPoint<T> {
  raw: string;
  parsed: T[];
  source_tweet_id: string;
  updated_at: string;
}

export type ShowtimeDataPoint = SnapshotDataPoint<CinePointShowtime>;
export type AdmissionDataPoint = SnapshotDataPoint<CinePointAdmission>;

export interface CompetitorSnapshot {
  id: string;                         // date string e.g. "2026-05-05"
  date: string;
  source: 'cinepoint';

  /** Showtime data for this date. null if no showtimes tweet imported yet. */
  showtimes?: ShowtimeDataPoint | null;

  /** Admission data for this date. null if no admissions tweet imported yet. */
  admissions?: AdmissionDataPoint | null;

  // ── Legacy flat fields (for backward compat during migration) ──
  showtimes_raw?: string;
  showtimes_parsed?: CinePointShowtime[];
  showtimes_parsed_at?: string;
  admissions_raw?: string;
  admissions_parsed?: CinePointAdmission[];
  admissions_parsed_at?: string;
}

// ─── Parsed CinePoint Data ─────────────────────────────────

export interface CinePointShowtime {
  title_cp: string;                   // "Salmokji" (from hashtag)
  showtimes: number;                  // 2466
  daily_change_pct: number;           // -3.90
  matched_movie_id?: string;          // CineRadar movie_id
  matched_title?: string;             // CineRadar display title
}

export interface CinePointAdmission {
  title_cp: string;                   // "Salmokji"
  daily_admissions: number;           // 74385
  daily_change_pct: number;           // -3.90
  cumulative_admissions: number;      // 389072
  matched_movie_id?: string;
  matched_title?: string;
}

// ─── Comparison Row (client-side join) ─────────────────────

export interface ComparisonRow {
  title_cp: string;
  title_cr?: string;
  matched_movie_id?: string;

  // Showtime comparison
  cp_showtimes?: number;
  cr_showtimes?: number;
  showtime_delta?: number;
  showtime_delta_pct?: number;

  // Admission comparison
  cp_admissions?: number;
  cr_admissions?: number;
  admission_delta?: number;
  admission_delta_pct?: number;
  cp_cumulative?: number;
  cp_daily_change_pct?: number;
}

export interface ComparisonSummary {
  total_cp_movies: number;
  matched_movies: number;
  unmatched_movies: string[];

  total_cp_showtimes: number;
  total_cr_showtimes: number;
  showtime_delta: number;
  showtime_delta_pct: number;
  avg_showtime_deviation_pct: number;

  total_cp_admissions: number;
  total_cr_admissions: number;
  admission_delta: number;
  admission_delta_pct: number;
  avg_admission_deviation_pct: number;
}

// ─── CineRadar Movie (for matching dropdown) ───────────────

export interface CineRadarMovie {
  id: string;
  movie_id: string;
  title: string;
}

// ─── Snapshot Status ───────────────────────────────────────

export type SnapshotStatus = 'empty' | 'showtimes_only' | 'admissions_only' | 'complete';

/** Derive coverage status from a snapshot's nested data points */
export function getSnapshotStatus(snap: { showtimes?: ShowtimeDataPoint | null; admissions?: AdmissionDataPoint | null }): SnapshotStatus {
  const hasShowtimes = !!(snap.showtimes?.parsed?.length);
  const hasAdmissions = !!(snap.admissions?.parsed?.length);
  if (hasShowtimes && hasAdmissions) return 'complete';
  if (hasShowtimes) return 'showtimes_only';
  if (hasAdmissions) return 'admissions_only';
  return 'empty';
}

// ─── Tweet Document ────────────────────────────────────────

export type TweetType = 'showtimes' | 'admissions' | 'other';

export interface CompetitorTweet {
  id: string;                          // tweet rest_id
  source_handle: string;               // "cinepoint_"
  source_name: string;                 // "Cinepoint app official account"
  source_avatar: string;               // avatar URL
  created_at: string;                  // Twitter format: "Tue May 05 15:50:29 +0000 2026"
  text: string;                        // cleaned tweet text
  tweet_type: TweetType;               // auto-detected
  data_date?: string;                  // "2026-05-05" extracted from header
  media_urls: string[];                // attached image URLs
  imported_at: string;                 // ISO timestamp
}

// ─── Source Summary (derived from tweets) ──────────────────

export interface TweetSourceSummary {
  handle: string;
  name: string;
  avatar: string;
  tweet_count: number;
  earliest_date: string;
  latest_date: string;
  date_range: number;                  // number of days covered
}

// ─── Confidence Score ──────────────────────────────────────

export interface ConfidenceBreakdown {
  match_score: number;         // 0-100: matched_movies / total_cp_movies * 100
  deviation_score: number;     // 0-100: penalized by avg deviation
  completeness_score: number;  // 0-100: 100 if both showtimes+admissions, 50 if partial
}

export interface ConfidenceResult {
  score: number;                // 0-100 composite
  level: 'excellent' | 'good' | 'warning' | 'critical';
  breakdown: ConfidenceBreakdown;
}

// ─── Trend Data (30-day dashboard) ─────────────────────────

export interface TrendMovieDay {
  title_cp: string;
  matched: boolean;
  showtime_delta_pct: number | null;
  admission_delta_pct: number | null;
}

export interface TrendDay {
  date: string;
  status: SnapshotStatus;
  confidence: ConfidenceResult | null;
  coverage_ratio: number | null;       // cr_showtimes / cp_showtimes
  showtime_delta_pct: number | null;   // overall showtime delta %
  admission_delta_pct: number | null;  // overall admission delta %
  match_rate: number | null;           // matched / total (0-1)
  total_cp_showtimes: number;
  total_cr_showtimes: number;
  total_cp_admissions: number;
  total_cr_admissions: number;
  movies: TrendMovieDay[];
}

// ─── Cumulative Box Office Tracker ─────────────────────────

export interface CumulativeDataPoint {
  date: string;
  daily_admissions: number;
  cumulative_admissions: number;
  daily_change_pct: number;
}

export interface CumulativeMovieTrack {
  title_cp: string;
  title_cr?: string;
  matched_movie_id?: string;
  data_points: CumulativeDataPoint[];
  latest_cumulative: number;
  peak_daily: number;
  opening_daily?: number;
  days_tracked: number;
  drop_rate_w1_w2?: number;    // 2nd week avg / 1st week avg
}

// ─── Heatmap Data ──────────────────────────────────────────

export type HeatmapCellStatus = 'matched_low' | 'matched_high' | 'unmatched' | 'no_data';

export interface HeatmapCell {
  title_cp: string;
  dates: Record<string, {
    status: HeatmapCellStatus;
    delta_pct: number | null;
    matched: boolean;
  }>;
  total_unmatched: number;
  avg_deviation: number | null;
}

// ─── Twitter API Response (Raw) ────────────────────────────

export interface TwitterInstruction {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries?: any[];
}

export interface TwitterTimelineResponse {
  data?: {
    user?: {
      result?: {
        timeline?: {
          timeline?: {
            instructions?: TwitterInstruction[];
          };
        };
      };
    };
  };
}

// ─── CinePoint Movie Catalog ────────────────────────────────

export type CinePointMovieType = 'local' | 'international';

// ─── Enriched Detail Types ────────────────────────────────

export interface CinePointCastGroup {
  role: 'casts' | 'directors' | 'producers' | 'writers';
  names: string[];
}

export interface CinePointUserRating {
  rating: string;                       // "1" – "10"
  value: number;                        // percentage
}

export interface CinePointPlayingAt {
  title: string;                        // "CGV Cinemas"
  image: string;                        // cinema logo URL
  link: string;                         // cinema website
}

export interface CinePointSimilarMovie {
  id: number;
  title: string;
  image_title: string | null;
  description: string;
}

export interface CinePointMovieRating {
  imdb: number | null;
  rotten_tomatoes: number | null;
}

export interface CinePointComparison {
  periode: string;                      // "7_days" | "14_days"
  id: number;
  title: string;
  admission: number;
  gross: number;
  image_title: string;
  other_movie: {
    periode: string;
    other_movie: null;
    id: number;
    title: string;
    admission: number;
    gross: number;
    image_title: string;
  } | null;
}

export interface CinePointMovie {
  id: number;                          // CinePoint movie ID (doc ID = string)
  title: string;                       // "Cek Khodam"
  title_cp: string;                    // normalized: "cek khodam" (for matching)
  image_title: string | null;          // S3 poster URL
  movie_genre: string[];               // ["Comedy", "Horror"]
  duration: number;                    // minutes (0 = unknown)
  release_date: string;                // "2026-07-16"
  type: CinePointMovieType;            // "local" | "international"
  scraped_at: string;                  // ISO timestamp
  matched_movie_id?: string | null;    // CineRadar movie_id
  matched_title?: string | null;       // CineRadar display title

  // ── Enriched fields (from /movies/detail) ──
  casts?: CinePointCastGroup[];
  description?: string;                // Full synopsis in Bahasa Indonesia
  language?: string;                   // "English", "Indonesia"
  trailer_url?: string | null;         // YouTube link
  rating_category?: string[];          // ["17+"], ["13+"]
  user_ratings?: CinePointUserRating[];
  playing_at?: CinePointPlayingAt[];
  similar_movies?: CinePointSimilarMovie[];
  movie_rating?: CinePointMovieRating;
  production_status?: string;          // "released", "upcoming"
  score?: number;                      // CinePoint audience score (1-10)
  total_admission?: number;            // Lifetime cumulative admissions
  admission?: number;                  // Daily admissions (from detail endpoint)
  change?: number;                     // Day-over-day %
  showtimes?: number;                  // Showtime count
  comparison?: CinePointComparison[];
  details_fetched_at?: string;         // ISO timestamp — enrichment marker
  _detail_hash?: string;               // content hash for idempotency
}

export interface CinePointSyncMeta {
  id: string;                          // always "current"
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  total_movies: number;                // total from API
  total_pages: number;                 // Math.ceil(total / limit)
  last_scraped_page: number;           // resume checkpoint
  limit: number;                       // page size (25)
  movies_scraped: number;              // running count
  pages_scraped: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  auth_token: string;                  // stored for resume
}

// ─── CinePoint Box Office (Daily) ────────────────────────────

export const CINEPOINT_BOX_OFFICE = 'cinepoint_box_office';
export const CINEPOINT_BO_SYNC_META = 'cinepoint_bo_sync_meta';

export interface CinePointBoxOfficeDoc {
  date: string;                         // "2026-05-01" (partition key)
  movie_id: number;                     // CinePoint movie ID
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: CinePointMovieType;
  admission: number;                    // daily
  total_admission: number;              // lifetime cumulative
  change: number;                       // day-over-day %
  showtimes: number;
  score: number;
  current_rank: number;
  last_rank: number | null;
  scraped_at: string;
  batch_id: string;
  _hash?: string;
}

export interface CinePointBOSyncMeta {
  id: 'current';
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  direction: string;
  date_start: string;
  date_end: string;
  last_scraped_date: string | null;
  dates_scraped: number;
  dates_skipped: number;
  docs_written: number;
  docs_skipped_hash: number;
  docs_rejected: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  batch_id: string;
}
