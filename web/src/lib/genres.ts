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
  emoji: string;
  patterns: string[];
}

export const GENRE_DEFINITIONS: Record<CanonicalGenreKey, GenreDefinition> = {
  drama: {
    key: 'drama',
    canonicalName: 'Drama',
    emoji: '🎭',
    patterns: ['drama', 'dr'],
  },
  horror: {
    key: 'horror',
    canonicalName: 'Horror',
    emoji: '👻',
    patterns: ['horror', 'horor', 'ghost', 'hantu'],
  },
  comedy: {
    key: 'comedy',
    canonicalName: 'Comedy',
    emoji: '😂',
    patterns: ['comedy', 'komedi', 'lucu', 'humor'],
  },
  action: {
    key: 'action',
    canonicalName: 'Action',
    emoji: '💥',
    patterns: ['action', 'aksi'],
  },
  thriller: {
    key: 'thriller',
    canonicalName: 'Thriller',
    emoji: '🔪',
    patterns: ['thriller', 'suspense', 'psychological thriller', 'psychological-thriller', 'psikologis', 'survival'],
  },
  animation: {
    key: 'animation',
    canonicalName: 'Animation',
    emoji: '🎨',
    patterns: ['animation', 'animasi', 'anime', 'kartun', 'animated'],
  },
  romance: {
    key: 'romance',
    canonicalName: 'Romance',
    emoji: '💖',
    patterns: ['romance', 'romantis', 'cinta', 'romantic', 'rom-com'],
  },
  adventure: {
    key: 'adventure',
    canonicalName: 'Adventure',
    emoji: '🧗',
    patterns: ['adventure', 'petualangan'],
  },
  sci_fi: {
    key: 'sci_fi',
    canonicalName: 'Sci-Fi',
    emoji: '🚀',
    patterns: ['sci-fi', 'scifi', 'sci fi', 'science fiction', 'fiksi ilmiah'],
  },
  fantasy: {
    key: 'fantasy',
    canonicalName: 'Fantasy',
    emoji: '🧙',
    patterns: ['fantasy', 'fantasi'],
  },
  family: {
    key: 'family',
    canonicalName: 'Family',
    emoji: '👨‍👩‍👧',
    patterns: ['family', 'keluarga', 'anak'],
  },
  music: {
    key: 'music',
    canonicalName: 'Music',
    emoji: '🎵',
    patterns: ['music', 'musik', 'concert', 'konser', 'musical'],
  },
  crime: {
    key: 'crime',
    canonicalName: 'Crime',
    emoji: '🕵️',
    patterns: ['crime', 'kriminal', 'detektif'],
  },
  history: {
    key: 'history',
    canonicalName: 'History',
    emoji: '📜',
    patterns: ['history', 'sejarah', 'historical', 'period'],
  },
  mystery: {
    key: 'mystery',
    canonicalName: 'Mystery',
    emoji: '🔍',
    patterns: ['mystery', 'misteri'],
  },
  biography: {
    key: 'biography',
    canonicalName: 'Biography',
    emoji: '👤',
    patterns: ['biography', 'biografi', 'biopic'],
  },
  documentary: {
    key: 'documentary',
    canonicalName: 'Documentary',
    emoji: '📹',
    patterns: ['documentary', 'dokumenter'],
  },
  sport: {
    key: 'sport',
    canonicalName: 'Sport',
    emoji: '⚽',
    patterns: ['sport', 'olahraga', 'football', 'soccer'],
  },
  disaster: {
    key: 'disaster',
    canonicalName: 'Disaster',
    emoji: '🌪️',
    patterns: ['disaster', 'bencana'],
  },
  war: {
    key: 'war',
    canonicalName: 'War',
    emoji: '🪖',
    patterns: ['war', 'perang', 'military'],
  },
  superhero: {
    key: 'superhero',
    canonicalName: 'Superhero',
    emoji: '🦸',
    patterns: ['superhero', 'super hero', 'pahlawan super'],
  },
  religi: {
    key: 'religi',
    canonicalName: 'Religious',
    emoji: '🕌',
    patterns: ['religi', 'religious', 'islamic', 'spiritual', 'agama'],
  },
  live_event: {
    key: 'live_event',
    canonicalName: 'Live Event',
    emoji: '🎟️',
    patterns: ['live', 'live event', 'nobar', 'screening', 'live viewing'],
  },
  gothic: {
    key: 'gothic',
    canonicalName: 'Gothic',
    emoji: '🏰',
    patterns: ['gothic', 'gotik'],
  },
  other: {
    key: 'other',
    canonicalName: 'Other',
    emoji: '🎬',
    patterns: ['other', 'others', 'lainnya'],
  },
};

/**
 * Normalizes any raw genre string from Firestore / Scrapers into a CanonicalGenreKey.
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
 * Returns the matching emoji for any raw or canonical genre string.
 */
export function getGenreEmoji(rawOrKey: string): string {
  const key = normalizeGenre(rawOrKey);
  return GENRE_DEFINITIONS[key]?.emoji || '🎬';
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

  return rawGenres.some(raw => {
    // Check if raw token matches directly or normalizes to selected filter key
    const tokens = raw.split(',').map(s => s.trim());
    return tokens.some(token => {
      const canonical = normalizeGenre(token);
      return canonical === selectedFilterKey || token.toLowerCase() === selectedFilterKey.toLowerCase();
    });
  });
}

/**
 * Extracts and aggregates all canonical genres from a movie array with counts and emojis.
 */
export function extractCanonicalGenresFromMovies(
  movies: { genres?: string[] }[]
): {
  key: CanonicalGenreKey;
  canonicalName: string;
  emoji: string;
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
        emoji: def.emoji,
        count,
      };
    });
}
