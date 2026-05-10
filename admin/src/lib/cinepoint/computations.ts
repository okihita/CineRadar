/**
 * Pure computation functions for CinePoint analysis.
 *
 * All functions are stateless, side-effect free, and operate on AnalysisMovie[].
 * Easy to test, easy to reuse across pages.
 */

import type {
  AnalysisMovie,
  OverviewStats,
  GenreStat,
  PersonRanking,
  LanguageStat,
  RatingStat,
  DurationBucket,
  GenreCombo,
} from './types';
import { median } from './format';

/** Compute overview statistics */
export function computeStats(movies: AnalysisMovie[]): OverviewStats {
  const withAdm = movies.filter((m) => m.total_admission > 0);
  const admissions = withAdm.map((m) => m.total_admission);
  const total = admissions.reduce((s, v) => s + v, 0);

  const tiers: Record<string, number> = { mega_hit: 0, hit: 0, moderate: 0, niche: 0, flop: 0 };
  for (const a of admissions) {
    if (a >= 1_000_000) tiers.mega_hit++;
    else if (a >= 500_000) tiers.hit++;
    else if (a >= 100_000) tiers.moderate++;
    else if (a >= 10_000) tiers.niche++;
    else tiers.flop++;
  }

  return {
    total_movies: movies.length,
    with_admissions: withAdm.length,
    total_admissions: total,
    avg_admission: withAdm.length ? Math.round(total / withAdm.length) : 0,
    median_admission: Math.round(median(admissions)),
    tiers,
  };
}

/** Compute per-genre statistics */
export function computeGenreStats(movies: AnalysisMovie[]): GenreStat[] {
  const map = new Map<string, { admissions: number[]; scores: number[]; total_count: number }>();
  const withAdm = movies.filter((m) => m.total_admission > 0);

  for (const m of movies) {
    for (const g of m.genres) {
      if (!map.has(g)) map.set(g, { admissions: [], scores: [], total_count: 0 });
      map.get(g)!.total_count++;
    }
  }
  for (const m of withAdm) {
    for (const g of m.genres) {
      if (!map.has(g)) map.set(g, { admissions: [], scores: [], total_count: 0 });
      map.get(g)!.admissions.push(m.total_admission);
      if (m.score > 0) map.get(g)!.scores.push(m.score);
    }
  }

  return [...map.entries()]
    .map(([genre, d]) => ({
      genre,
      count: d.total_count,
      with_admissions: d.admissions.length,
      avg_admission: d.admissions.length ? Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length) : 0,
      median_admission: Math.round(median(d.admissions)),
      hit_rate_pct: d.admissions.length ? Math.round((d.admissions.filter((v) => v >= 500_000).length / d.admissions.length) * 1000) / 10 : 0,
      avg_score: d.scores.length ? Math.round((d.scores.reduce((s, v) => s + v, 0) / d.scores.length) * 10) / 10 : 0,
      total_admission: d.admissions.reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission);
}

/** Compute person (actor/director) rankings */
export function computePersonRankings(
  movies: AnalysisMovie[],
  role: 'directors' | 'actors',
  minMovies: number,
): PersonRanking[] {
  const map = new Map<string, { id: number; title: string; total_admission: number }[]>();
  const withAdm = movies.filter((m) => m.total_admission > 0);

  for (const m of withAdm) {
    for (const name of m[role]) {
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({ id: m.id, title: m.title, total_admission: m.total_admission });
    }
  }

  return [...map.entries()]
    .filter(([, ms]) => ms.length >= minMovies)
    .map(([name, ms]) => {
      const adm = ms.map((m) => m.total_admission);
      const best = ms.reduce((a, b) => a.total_admission > b.total_admission ? a : b);
      return {
        name,
        movie_count: ms.length,
        avg_admission: Math.round(adm.reduce((s, v) => s + v, 0) / adm.length),
        median_admission: Math.round(median(adm)),
        total_admission: adm.reduce((s, v) => s + v, 0),
        best_movie: best,
        hit_rate: Math.round((adm.filter((v) => v >= 500_000).length / adm.length) * 1000) / 10,
      };
    })
    .sort((a, b) => b.avg_admission - a.avg_admission);
}

/** Compute per-language statistics */
export function computeLanguageStats(movies: AnalysisMovie[]): Record<string, LanguageStat> {
  const map = new Map<string, AnalysisMovie[]>();
  for (const m of movies) {
    if (!m.language) continue;
    if (!map.has(m.language)) map.set(m.language, []);
    map.get(m.language)!.push(m);
  }
  return Object.fromEntries(
    [...map.entries()].map(([lang, ms]) => {
      const withAdm = ms.filter((m) => m.total_admission > 0);
      const adm = withAdm.map((m) => m.total_admission);
      const gMap = new Map<string, { count: number; admissions: number[] }>();
      for (const m of withAdm) {
        for (const g of m.genres) {
          if (!gMap.has(g)) gMap.set(g, { count: 0, admissions: [] });
          gMap.get(g)!.count++;
          gMap.get(g)!.admissions.push(m.total_admission);
        }
      }
      const top_genres = [...gMap.entries()]
        .map(([genre, d]) => ({
          genre,
          count: d.count,
          avg_admission: d.admissions.length ? Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      return [lang, {
        count: ms.length,
        with_admissions: withAdm.length,
        avg_admission: adm.length ? Math.round(adm.reduce((s, v) => s + v, 0) / adm.length) : 0,
        median_admission: Math.round(median(adm)),
        total_admission: adm.reduce((s, v) => s + v, 0),
        hit_rate_pct: adm.length ? Math.round((adm.filter((v) => v >= 500_000).length / adm.length) * 1000) / 10 : 0,
        top_genres,
      }];
    })
  );
}

/** Compute per-age-rating statistics */
export function computeRatingStats(movies: AnalysisMovie[]): RatingStat[] {
  const map = new Map<string, number[]>();
  for (const m of movies.filter((m) => m.total_admission > 0)) {
    for (const r of m.rating_category) {
      if (!r || r === 'N/A') continue;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m.total_admission);
    }
  }
  return [...map.entries()]
    .map(([rating, admissions]) => ({
      rating,
      count: admissions.length,
      avg_admission: Math.round(admissions.reduce((s, v) => s + v, 0) / admissions.length),
      median_admission: Math.round(median(admissions)),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission);
}

/** Compute duration bucket statistics */
export function computeDurationBuckets(movies: AnalysisMovie[]): DurationBucket[] {
  const buckets = [
    { range: '< 80 min', min: 0, max: 80 },
    { range: '80–100', min: 80, max: 100 },
    { range: '100–120', min: 100, max: 120 },
    { range: '120–140', min: 120, max: 140 },
    { range: '140+', min: 140, max: 999 },
  ];
  return buckets.map((b) => {
    const matching = movies.filter((m) => m.total_admission > 0 && m.duration >= b.min && m.duration < b.max);
    const adm = matching.map((m) => m.total_admission);
    return {
      range: b.range,
      count: matching.length,
      avg_admission: adm.length ? Math.round(adm.reduce((s, v) => s + v, 0) / adm.length) : 0,
      median_admission: Math.round(median(adm)),
    };
  });
}

/** Compute top genre combinations */
export function computeGenreCombos(movies: AnalysisMovie[]): GenreCombo[] {
  const map = new Map<string, { genres: string[]; admissions: number[] }>();
  for (const m of movies.filter((m) => m.total_admission > 0 && m.genres.length >= 2)) {
    const sorted = [...m.genres].sort();
    const key = sorted.join(' + ');
    if (!map.has(key)) map.set(key, { genres: sorted, admissions: [] });
    map.get(key)!.admissions.push(m.total_admission);
  }
  return [...map.entries()]
    .filter(([, d]) => d.admissions.length >= 10)
    .map(([combo, d]) => ({
      combo,
      genres: d.genres,
      count: d.admissions.length,
      avg_admission: Math.round(d.admissions.reduce((s, v) => s + v, 0) / d.admissions.length),
    }))
    .sort((a, b) => b.avg_admission - a.avg_admission)
    .slice(0, 20);
}
