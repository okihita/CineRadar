/**
 * Shared formatters and pure utility functions for CinePoint.
 */

/** Format admission number to human-readable string (1.2M, 450K, 832) */
export function formatAdm(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

/** Compute the median of a number array */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Classify an admission number into a success tier */
export function classifyTier(a: number): string {
  if (a >= TIER_THRESHOLDS.mega_hit) return 'mega_hit';
  if (a >= TIER_THRESHOLDS.hit) return 'hit';
  if (a >= TIER_THRESHOLDS.moderate) return 'moderate';
  if (a >= TIER_THRESHOLDS.niche) return 'niche';
  return 'flop';
}

/** Centralized thresholds — single source of truth */
export const HIT_THRESHOLD = 500_000;
export const TIER_THRESHOLDS = {
  mega_hit: 1_000_000,
  hit: 500_000,
  moderate: 100_000,
  niche: 10_000,
} as const;

/** Compute hit rate percentage (fraction of admissions >= HIT_THRESHOLD) */
export function computeHitRate(admissions: number[]): number {
  if (!admissions.length) return 0;
  return Math.round((admissions.filter((v) => v >= HIT_THRESHOLD).length / admissions.length) * 1000) / 10;
}

/** Tier constants used across analysis pages */
export const TIER_COLORS: Record<string, string> = {
  mega_hit: '#10b981',
  hit: '#6366f1',
  moderate: '#f59e0b',
  niche: '#94a3b8',
  flop: '#f87171',
};

export const TIER_LABELS: Record<string, string> = {
  mega_hit: 'Mega Hit (≥1M)',
  hit: 'Hit (500K–1M)',
  moderate: 'Moderate (100K–500K)',
  niche: 'Niche (10K–100K)',
  flop: 'Flop (<10K)',
};

export const TIER_KEYS = ['mega_hit', 'hit', 'moderate', 'niche', 'flop'] as const;

/** Movie type color constants used across insights and detail pages */
export const LOCAL_COLOR = '#6366f1';
export const INTL_COLOR = '#f59e0b';
export const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f87171', '#38bdf8', '#e879f9', '#fb923c', '#34d399'];
