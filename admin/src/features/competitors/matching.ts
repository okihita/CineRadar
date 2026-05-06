/**
 * Movie matching: CinePoint hashtag titles → CineRadar movie records.
 *
 * Strategy:
 *   1. Exact slug match (lowercase, no spaces/special chars)
 *   2. Substring containment (either direction)
 *   3. Unmatched → returned for manual assignment
 */

import type { CinePointShowtime, CinePointAdmission, CineRadarMovie } from './types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface MatchResult<T extends { title_cp: string; matched_movie_id?: string; matched_title?: string }> {
  items: T[];
  unmatched: string[];
  matchCount: number;
}

export function matchShowtimes(
  cpShowtimes: CinePointShowtime[],
  crMovies: CineRadarMovie[],
): MatchResult<CinePointShowtime> {
  const unmatched: string[] = [];
  let matchCount = 0;

  const items = cpShowtimes.map((cp) => {
    // Skip if already matched (from previous save)
    if (cp.matched_movie_id) {
      matchCount++;
      return cp;
    }

    const match = findBestMatch(cp.title_cp, crMovies);
    if (match) {
      matchCount++;
      return {
        ...cp,
        matched_movie_id: match.movie_id || match.id,
        matched_title: match.title,
      };
    }

    unmatched.push(cp.title_cp);
    return cp;
  });

  return { items, unmatched, matchCount };
}

export function matchAdmissions(
  cpAdmissions: CinePointAdmission[],
  crMovies: CineRadarMovie[],
): MatchResult<CinePointAdmission> {
  const unmatched: string[] = [];
  let matchCount = 0;

  const items = cpAdmissions.map((cp) => {
    if (cp.matched_movie_id) {
      matchCount++;
      return cp;
    }

    const match = findBestMatch(cp.title_cp, crMovies);
    if (match) {
      matchCount++;
      return {
        ...cp,
        matched_movie_id: match.movie_id || match.id,
        matched_title: match.title,
      };
    }

    unmatched.push(cp.title_cp);
    return cp;
  });

  return { items, unmatched, matchCount };
}

function findBestMatch(cpTitle: string, crMovies: CineRadarMovie[]): CineRadarMovie | null {
  const cpSlug = slugify(cpTitle);

  // 1. Exact slug match
  for (const movie of crMovies) {
    if (slugify(movie.title) === cpSlug) return movie;
  }

  // 2. Substring containment (either direction)
  for (const movie of crMovies) {
    const crSlug = slugify(movie.title);
    if (crSlug.includes(cpSlug) || cpSlug.includes(crSlug)) return movie;
  }

  return null;
}
