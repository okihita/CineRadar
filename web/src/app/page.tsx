import MovieBrowser from '@/components/MovieBrowser';

interface TheaterSchedule {
  theatre_id: string;
  theatre_name: string;
  merchant: string;
  address: string;
  rooms: {
    category: string;
    price: string;
    showtimes: string[];
  }[];
}

interface Movie {
  id: string;
  title: string;
  genres: string[];
  poster: string;
  age_category: string;
  country: string;
  merchants: string[];
  cities: string[];
  schedules?: Record<string, TheaterSchedule[]>;
  theatre_counts?: Record<string, number>;
}

interface MovieData {
  scraped_at: string;
  date: string;
  summary: {
    total_cities: number;
    total_movies: number;
  };
  movies: Movie[];
  city_stats: Record<string, number>;
}

async function getMovieData(): Promise<MovieData | null> {
  try {
    // Fetch directly from Firestore REST API (works during build and SSR)
    const projectId = 'cineradar-481014';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/snapshots/latest`;

    const response = await fetch(url, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('Firestore fetch failed:', response.status);
      return null;
    }

    const firestoreDoc = await response.json();
    const fields = firestoreDoc.fields || {};

    // Transform Firestore format to our format
    return {
      scraped_at: fields.scraped_at?.stringValue || '',
      date: fields.date?.stringValue || '',
      summary: {
        total_cities: parseInt(fields.summary?.mapValue?.fields?.total_cities?.integerValue || '0', 10),
        total_movies: parseInt(fields.summary?.mapValue?.fields?.total_movies?.integerValue || '0', 10),
      },
      movies: parseMoviesArray(fields.movies?.arrayValue?.values || []),
      city_stats: parseCityStats(fields.city_stats?.mapValue?.fields || {}),
    };
  } catch (error) {
    console.error('Error loading movie data:', error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMoviesArray(values: any[]): Movie[] {
  return values.map(v => {
    const m = v.mapValue?.fields || {};
    return {
      id: m.id?.stringValue || '',
      title: m.title?.stringValue || '',
      genres: (m.genres?.arrayValue?.values || []).map((g: { stringValue: string }) => g.stringValue),
      poster: m.poster?.stringValue || '',
      age_category: m.age_category?.stringValue || '',
      country: m.country?.stringValue || '',
      merchants: (m.merchants?.arrayValue?.values || []).map((x: { stringValue: string }) => x.stringValue),
      cities: (m.cities?.arrayValue?.values || []).map((x: { stringValue: string }) => x.stringValue),
      theatre_counts: parseTheatreCounts(m.theatre_counts?.mapValue?.fields || {}),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTheatreCounts(fields: any): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [city, val] of Object.entries(fields)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[city] = parseInt((val as any).integerValue || '0', 10);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCityStats(fields: any): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [city, val] of Object.entries(fields)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[city] = parseInt((val as any).integerValue || '0', 10);
  }
  return result;
}

/**
 * Format date/time to WIB (Jakarta time)
 * Keeps database as UTC, displays as WIB
 */
function formatWIB(date: string | null | undefined): string {
  if (!date) return 'N/A';

  // Handle both ISO strings and "YYYY-MM-DD HH:mm:ss" format
  const d = new Date(date.includes('T') ? date : date.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return date; // Return original if can't parse

  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' WIB';
}

export default async function Home() {
  const data = await getMovieData();

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">🎬 CineRadar</h1>
          <p className="text-gray-300">No movie data available. Run the scraper first!</p>
          <code className="mt-4 block bg-black/30 px-4 py-2 rounded-lg text-sm">
            python tix_api.py --schedules
          </code>
        </div>
      </div>
    );
  }

  // Calculate total theatres from theatre_counts (Firestore) or schedules (legacy)
  const totalTheatres = data.movies.reduce((acc, movie) => {
    if (movie.theatre_counts) {
      return acc + Object.values(movie.theatre_counts).reduce((sum, count) => sum + count, 0);
    } else if (movie.schedules) {
      return acc + Object.values(movie.schedules).reduce((sum, theaters) => sum + theaters.length, 0);
    }
    return acc;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10 h-20">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎬</span>
            <div>
              <h1 className="text-xl font-bold text-white">CineRadar</h1>
              <p className="text-xs text-gray-400">Indonesia Movie Showtimes</p>
            </div>
          </div>

          {/* Stats in header */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{data.summary.total_movies}</p>
              <p className="text-xs text-gray-400">Movies</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{data.summary.total_cities}</p>
              <p className="text-xs text-gray-400">Cities</p>
            </div>
            {totalTheatres > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{totalTheatres}</p>
                <p className="text-xs text-gray-400">Theatres</p>
              </div>
            )}
            <div className="text-right text-sm border-l border-white/10 pl-6">
              <p className="text-gray-400">{data.date}</p>
              <p className="text-xs text-gray-500">{formatWIB(data.scraped_at)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Movie Browser */}
      <MovieBrowser movies={data.movies} />
    </div>
  );
}
