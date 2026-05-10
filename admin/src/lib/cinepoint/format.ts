/**
 * Shared formatters and pure utility functions for CinePoint analysis.
 */

import type { AnalysisMovie } from './types';

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
  if (a >= 1_000_000) return 'mega_hit';
  if (a >= 500_000) return 'hit';
  if (a >= 100_000) return 'moderate';
  if (a >= 10_000) return 'niche';
  return 'flop';
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
