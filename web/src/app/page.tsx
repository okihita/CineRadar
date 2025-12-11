import { promises as fs } from 'fs';
import path from 'path';
import MovieGrid from '@/components/MovieGrid';
import CityFilter from '@/components/CityFilter';
import StatsCard from '@/components/StatsCard';

interface Movie {
  id: string;
  title: string;
  genres: string[];
  poster: string;
  age_category: string;
  country: string;
  merchants: string[];
  cities: string[];
  schedules?: Record<string, any[]>;
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
    const dataDir = path.join(process.cwd(), '..', 'data');
    const files = await fs.readdir(dataDir);
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
            python tix_api.py
          </code>
        </div>
      </div>
    );
  }

  // Get unique cities from all movies
  const allCities = [...new Set(data.movies.flatMap(m => m.cities))].sort();

  // Sort cities by movie count
  const sortedCities = Object.entries(data.city_stats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎬</span>
            <div>
              <h1 className="text-2xl font-bold text-white">CineRadar</h1>
              <p className="text-xs text-gray-400">Indonesia Movie Tracker</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            <p>Last updated</p>
            <p className="text-white font-medium">{data.scraped_at}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            icon="🎬"
            label="Movies"
            value={data.summary.total_movies}
            color="from-pink-500 to-rose-500"
          />
          <StatsCard
            icon="🏙️"
            label="Cities"
            value={data.summary.total_cities}
            color="from-blue-500 to-cyan-500"
          />
          <StatsCard
            icon="🎭"
            label="Top City"
            value={sortedCities[0]?.[0] || '-'}
            subValue={`${sortedCities[0]?.[1] || 0} movies`}
            color="from-amber-500 to-orange-500"
          />
          <StatsCard
            icon="📅"
            label="Date"
            value={data.date}
            color="from-emerald-500 to-teal-500"
          />
        </div>

        {/* City Filter */}
        <CityFilter cities={allCities} />

        {/* Movie Grid */}
        <MovieGrid movies={data.movies} />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>Data scraped from TIX.id • Not affiliated with TIX</p>
        </div>
      </footer>
    </div>
  );
}
