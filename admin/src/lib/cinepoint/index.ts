/**
 * CinePoint analysis shared modules.
 *
 * Import from '@/lib/cinepoint' — single entry point.
 */

export type {
  AnalysisMovie,
  PersonRanking,
  PersonDetailStats,
  OverviewStats,
  GenreStat,
  LanguageStat,
  RatingStat,
  DurationBucket,
  GenreCombo,
  FactorState,
  DailyTotal,
  MovieDaily,
  MovieRanking,
  TopMover,
  YearSummary,
  BoxOfficeData,
} from './types';

export {
  formatAdm,
  median,
  classifyTier,
  computeHitRate,
  admissionColor,
  durationBucket,
  HIT_THRESHOLD,
  TIER_THRESHOLDS,
  DURATION_THRESHOLDS,
  TIER_COLORS,
  TIER_LABELS,
  TIER_KEYS,
  LOCAL_COLOR,
  INTL_COLOR,
  CHART_COLORS,
} from './format';

export {
  computeStats,
  computeGenreStats,
  computePersonRankings,
  computePersonDetail,
  computeLanguageStats,
  computeRatingStats,
  computeDurationBuckets,
  computeGenreCombos,
} from './computations';

export { useAnalysisData } from './use-analysis';
