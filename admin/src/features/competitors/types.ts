/**
 * Competitor tracking types and Firestore schema.
 *
 * Collections:
 *   beta_competitor_snapshots/{date}  — parsed showtime/admission data per date
 *   beta_competitor_tweets/{tweet_id} — raw imported tweets per source
 */

// ─── Firestore Collections ─────────────────────────────────

export const COMPETITOR_COLLECTION = 'beta_competitor_snapshots';
export const TWEET_COLLECTION = 'beta_competitor_tweets';

// ─── Snapshot Document ─────────────────────────────────────

export interface CompetitorSnapshot {
  id: string;                         // date string e.g. "2026-05-05"
  date: string;
  source: 'cinepoint';

  // Showtime data (from morning tweet)
  showtimes_raw?: string;
  showtimes_parsed?: CinePointShowtime[];
  showtimes_parsed_at?: string;

  // Admission data (from next-day tweet)
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
