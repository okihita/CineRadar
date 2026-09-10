export type CanonicalGenreKey =
  | 'drama'
  | 'horror'
  | 'comedy'
  | 'action'
  | 'thriller'
  | 'animation'
  | 'romance'
  | 'adventure'
  | 'sci_fi'
  | 'fantasy'
  | 'family'
  | 'music'
  | 'crime'
  | 'history'
  | 'mystery'
  | 'biography'
  | 'documentary'
  | 'sport'
  | 'disaster'
  | 'war'
  | 'superhero'
  | 'religi'
  | 'live_event'
  | 'gothic'
  | 'other';

export interface GenreDefinition {
  key: CanonicalGenreKey;
  canonicalName: string;
  patterns: string[];
}

export const GENRE_DEFINITIONS: Record<CanonicalGenreKey, GenreDefinition> = {
  drama: {
    key: 'drama',
    canonicalName: 'Drama',
    patterns: ['drama', 'dr'],
  },
  horror: {
    key: 'horror',
    canonicalName: 'Horror',
    patterns: ['horror', 'horor', 'ghost', 'hantu'],
  },
  comedy: {
    key: 'comedy',
    canonicalName: 'Comedy',
    patterns: ['comedy', 'komedi', 'lucu', 'humor'],
  },
  action: {
    key: 'action',
    canonicalName: 'Action',
    patterns: ['action', 'aksi'],
  },
  thriller: {
    key: 'thriller',
    canonicalName: 'Thriller',
    patterns: ['thriller', 'triler'],
  },
  animation: {
    key: 'animation',
    canonicalName: 'Animation',
    patterns: ['animation', 'animasi', 'anime', 'kartun'],
  },
  romance: {
    key: 'romance',
    canonicalName: 'Romance',
    patterns: ['romance', 'romantis', 'cinta', 'love'],
  },
  adventure: {
    key: 'adventure',
    canonicalName: 'Adventure',
    patterns: ['adventure', 'petualangan'],
  },
  sci_fi: {
    key: 'sci_fi',
    canonicalName: 'Sci-Fi',
    patterns: ['sci-fi', 'sci fi', 'science fiction', 'fiksi ilmiah'],
  },
  fantasy: {
    key: 'fantasy',
    canonicalName: 'Fantasy',
    patterns: ['fantasy', 'fantasi'],
  },
  family: {
    key: 'family',
    canonicalName: 'Family',
    patterns: ['family', 'keluarga', 'anak', 'kids'],
  },
  music: {
    key: 'music',
    canonicalName: 'Music',
    patterns: ['music', 'musik', 'musical', 'musikal', 'konser'],
  },
  crime: {
    key: 'crime',
    canonicalName: 'Crime',
    patterns: ['crime', 'kriminal'],
  },
  history: {
    key: 'history',
    canonicalName: 'History',
    patterns: ['history', 'sejarah', 'historical'],
  },
  mystery: {
    key: 'mystery',
    canonicalName: 'Mystery',
    patterns: ['mystery', 'misteri'],
  },
  biography: {
    key: 'biography',
    canonicalName: 'Biography',
    patterns: ['biography', 'biografi', 'biopic'],
  },
  documentary: {
    key: 'documentary',
    canonicalName: 'Documentary',
    patterns: ['documentary', 'dokumenter'],
  },
  sport: {
    key: 'sport',
    canonicalName: 'Sport',
    patterns: ['sport', 'olahraga'],
  },
  disaster: {
    key: 'disaster',
    canonicalName: 'Disaster',
    patterns: ['disaster', 'bencana'],
  },
  war: {
    key: 'war',
    canonicalName: 'War',
    patterns: ['war', 'perang'],
  },
  superhero: {
    key: 'superhero',
    canonicalName: 'Superhero',
    patterns: ['superhero', 'super hero', 'marvel', 'dc'],
  },
  religi: {
    key: 'religi',
    canonicalName: 'Religi',
    patterns: ['religi', 'religion', 'islam', 'dakwah', 'spiritual'],
  },
  live_event: {
    key: 'live_event',
    canonicalName: 'Live Event',
    patterns: ['live event', 'live broadcast', 'tayang tunda'],
  },
  gothic: {
    key: 'gothic',
    canonicalName: 'Gothic',
    patterns: ['gothic', 'gotik'],
  },
  other: {
    key: 'other',
    canonicalName: 'Other',
    patterns: [],
  },
};

/**
 * Normalizes any freeform genre string from scraping into a canonical genre key.
 */
export function normalizeGenre(rawGenre: string): CanonicalGenreKey {
  if (!rawGenre || typeof rawGenre !== 'string') return 'other';
  const clean = rawGenre.trim().toLowerCase();

  for (const def of Object.values(GENRE_DEFINITIONS)) {
    if (def.patterns.some(p => p === clean || clean.includes(p))) {
      return def.key;
    }
  }

  return 'other';
}

/**
 * Checks whether a list of raw movie genres matches a selected filter key.
 */
export function matchesGenreFilter(
  rawGenres: string[] | undefined,
  selectedFilterKey: string
): boolean {
  if (!selectedFilterKey || selectedFilterKey === 'all') return true;
  if (!rawGenres || rawGenres.length === 0) return false;

  const normalizedFilterKey = selectedFilterKey.toLowerCase();

  return rawGenres.some(raw => {
    const tokens = raw.split(',').map(s => s.trim());
    return tokens.some(token => {
      const canonical = normalizeGenre(token);
      return canonical === selectedFilterKey || token.toLowerCase() === normalizedFilterKey;
    });
  });
}

/**
 * Extracts and aggregates all canonical genres from a movie array with counts.
 */
export function extractCanonicalGenresFromMovies(
  movies: { genres?: string[] }[]
): {
  key: CanonicalGenreKey;
  canonicalName: string;
  count: number;
}[] {
  const counts = new Map<CanonicalGenreKey, number>();

  movies.forEach(movie => {
    const matchedKeysForMovie = new Set<CanonicalGenreKey>();

    (movie.genres || []).forEach(raw => {
      if (!raw) return;
      const tokens = raw.split(',').map(s => s.trim()).filter(Boolean);
      tokens.forEach(token => {
        const canonicalKey = normalizeGenre(token);
        matchedKeysForMovie.add(canonicalKey);
      });
    });

    matchedKeysForMovie.forEach(key => {
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by highest movie count
    .map(([key, count]) => {
      const def = GENRE_DEFINITIONS[key] || GENRE_DEFINITIONS.other;
      return {
        key,
        canonicalName: def.canonicalName,
        count,
      };
    });
}
