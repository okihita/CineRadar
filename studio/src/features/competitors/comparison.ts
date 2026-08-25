/**
 * Comparison engine: joins CinePoint parsed data with CineRadar performance data.
 */

import type {
  CinePointShowtime,
  CinePointAdmission,
  ComparisonRow,
  ComparisonSummary,
  ConfidenceResult,
  ConfidenceBreakdown,
} from './types';

// CineRadar's per-movie daily performance (fetched from movie_performance_v2)
export interface CineRadarDayPerformance {
  movie_id: string;
  title: string;
  total_showtimes: number;
  total_sold: number;
}

export function buildComparison(
  cpShowtimes: CinePointShowtime[] | undefined,
  cpAdmissions: CinePointAdmission[] | undefined,
  crPerformances: CineRadarDayPerformance[],
): { rows: ComparisonRow[]; summary: ComparisonSummary } {
  // Build lookup: matched_movie_id → CineRadar performance
  const crByMovieId = new Map<string, CineRadarDayPerformance>();
  for (const perf of crPerformances) {
    crByMovieId.set(perf.movie_id, perf);
  }

  // Build lookup: title_cp → showtime data
  const showtimeByTitle = new Map<string, CinePointShowtime>();
  if (cpShowtimes) {
    for (const s of cpShowtimes) {
      showtimeByTitle.set(s.title_cp, s);
    }
  }

  // Build lookup: title_cp → admission data
  const admissionByTitle = new Map<string, CinePointAdmission>();
  if (cpAdmissions) {
    for (const a of cpAdmissions) {
      admissionByTitle.set(a.title_cp, a);
    }
  }

  // Collect all unique CP titles (union of showtimes + admissions)
  const allCpTitles = new Set<string>([
    ...showtimeByTitle.keys(),
    ...admissionByTitle.keys(),
  ]);

  const rows: ComparisonRow[] = [];
  let totalCpShowtimes = 0;
  let totalCrShowtimes = 0;
  let totalCpAdmissions = 0;
  let totalCrAdmissions = 0;
  let matchCount = 0;
  const unmatched: string[] = [];
  const deviations: number[] = [];
  const admissionDeviations: number[] = [];

  for (const title of allCpTitles) {
    const showtime = showtimeByTitle.get(title);
    const admission = admissionByTitle.get(title);

    const movieId = showtime?.matched_movie_id || admission?.matched_movie_id;
    const crTitle = showtime?.matched_title || admission?.matched_title;
    const crPerf = movieId ? crByMovieId.get(movieId) : undefined;

    const row: ComparisonRow = {
      title_cp: title,
      title_cr: crTitle || movieId,
      matched_movie_id: movieId,
    };

    // Showtime comparison
    if (showtime) {
      row.cp_showtimes = showtime.showtimes;
      totalCpShowtimes += showtime.showtimes;

      if (crPerf) {
        row.cr_showtimes = crPerf.total_showtimes;
        totalCrShowtimes += crPerf.total_showtimes;
        row.showtime_delta = crPerf.total_showtimes - showtime.showtimes;
        row.showtime_delta_pct = showtime.showtimes > 0
          ? parseFloat(((row.showtime_delta / showtime.showtimes) * 100).toFixed(2))
          : 0;
        deviations.push(Math.abs(row.showtime_delta_pct));
      }
    }

    // Admission comparison
    if (admission) {
      row.cp_admissions = admission.daily_admissions;
      row.cp_cumulative = admission.cumulative_admissions;
      row.cp_daily_change_pct = admission.daily_change_pct;
      totalCpAdmissions += admission.daily_admissions;

      if (crPerf) {
        row.cr_admissions = crPerf.total_sold;
        totalCrAdmissions += crPerf.total_sold;
        row.admission_delta = crPerf.total_sold - admission.daily_admissions;
        row.admission_delta_pct = admission.daily_admissions > 0
          ? parseFloat(((row.admission_delta / admission.daily_admissions) * 100).toFixed(2))
          : 0;
        admissionDeviations.push(Math.abs(row.admission_delta_pct));
      }
    }

    if (movieId) {
      matchCount++;
    } else {
      unmatched.push(title);
    }

    rows.push(row);
  }

  const summary: ComparisonSummary = {
    total_cp_movies: allCpTitles.size,
    matched_movies: matchCount,
    unmatched_movies: unmatched,

    total_cp_showtimes: totalCpShowtimes,
    total_cr_showtimes: totalCrShowtimes,
    showtime_delta: totalCrShowtimes - totalCpShowtimes,
    showtime_delta_pct: totalCpShowtimes > 0
      ? parseFloat((((totalCrShowtimes - totalCpShowtimes) / totalCpShowtimes) * 100).toFixed(2))
      : 0,
    avg_showtime_deviation_pct: deviations.length > 0
      ? parseFloat((deviations.reduce((a, b) => a + b, 0) / deviations.length).toFixed(2))
      : 0,

    total_cp_admissions: totalCpAdmissions,
    total_cr_admissions: totalCrAdmissions,
    admission_delta: totalCrAdmissions - totalCpAdmissions,
    admission_delta_pct: totalCpAdmissions > 0
      ? parseFloat((((totalCrAdmissions - totalCpAdmissions) / totalCpAdmissions) * 100).toFixed(2))
      : 0,
    avg_admission_deviation_pct: admissionDeviations.length > 0
      ? parseFloat((admissionDeviations.reduce((a, b) => a + b, 0) / admissionDeviations.length).toFixed(2))
      : 0,
  };

  return { rows, summary };
}

// ─── Confidence Score ──────────────────────────────────────

/**
 * Compute a 0-100 confidence score from comparison summary.
 *
 * Weighting:
 *   Match rate (40%) — how many CP movies were linked to CineRadar
 *   Deviation (35%)  — how close the numbers are (penalized 10×)
 *   Completeness (25%) — both showtimes + admissions present
 */
export function computeConfidenceScore(summary: ComparisonSummary): ConfidenceResult {
  // Match score: 0-100
  const matchRate = summary.total_cp_movies > 0
    ? summary.matched_movies / summary.total_cp_movies
    : 0;
  const matchScore = matchRate * 100;

  // Deviation score: penalize avg deviation, max penalty at 10%+
  const avgDev = summary.avg_showtime_deviation_pct || 0;
  const deviationScore = Math.max(0, 100 - avgDev * 10);

  // Completeness score
  const hasShowtimes = summary.total_cp_showtimes > 0;
  const hasAdmissions = summary.total_cp_admissions > 0;
  const completenessScore = (hasShowtimes && hasAdmissions) ? 100 : 50;

  const score = Math.round(
    matchScore * 0.4 +
    deviationScore * 0.35 +
    completenessScore * 0.25,
  );

  const breakdown: ConfidenceBreakdown = {
    match_score: Math.round(matchScore),
    deviation_score: Math.round(deviationScore),
    completeness_score: completenessScore,
  };

  let level: ConfidenceResult['level'];
  if (score >= 90) level = 'excellent';
  else if (score >= 75) level = 'good';
  else if (score >= 55) level = 'warning';
  else level = 'critical';

  return { score, level, breakdown };
}
