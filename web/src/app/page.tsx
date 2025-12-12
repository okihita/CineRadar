import { promises as fs } from 'fs';
import path from 'path';
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
    // Try public/data first (for Vercel), fallback to ../data (for local dev)
    let dataDir = path.join(process.cwd(), 'public', 'data');
    let files: string[] = [];

    try {
      files = await fs.readdir(dataDir);
    } catch {
      // Fallback to parent data dir for local development
      dataDir = path.join(process.cwd(), '..', 'data');
      files = await fs.readdir(dataDir);
    }
    const movieFiles = files.filter(f => f.startsWith('movies_') && f.endsWith('.json'));

    if (movieFiles.length === 0) return null;

    // Get most recent file
    movieFiles.sort().reverse();
    const latestFile = movieFiles[0];

    const filePath = path.join(dataDir, latestFile);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading movie data:', error);
    return null;
  }
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

  // Calculate total theatres
  const totalTheatres = data.movies.reduce((acc, movie) => {
    if (movie.schedules) {
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
              <p className="text-xs text-gray-500">{data.scraped_at}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Movie Browser */}
      <MovieBrowser movies={data.movies} />
    </div>
  );
}
