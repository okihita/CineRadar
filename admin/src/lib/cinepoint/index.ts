/**
 * CinePoint analysis shared modules.
 *
 * Import from '@/lib/cinepoint' — single entry point.
 */

export type {
  AnalysisMovie,
  PersonRanking,
  OverviewStats,
  GenreStat,
  LanguageStat,
  RatingStat,
  DurationBucket,
  GenreCombo,
  FactorState,
} from './types';

export {
  formatAdm,
  median,
  classifyTier,
  TIER_COLORS,
  TIER_LABELS,
  TIER_KEYS,
} from './format';

export {
  computeStats,
  computeGenreStats,
  computePersonRankings,
  computeLanguageStats,
  computeRatingStats,
  computeDurationBuckets,
  computeGenreCombos,
} from './computations';

export { useAnalysisData } from './use-analysis';
