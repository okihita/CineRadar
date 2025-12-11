'use client';

import { useState } from 'react';
import Image from 'next/image';

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

interface MovieSidebarProps {
  movies: Movie[];
  selectedMovie: Movie | null;
  onSelectMovie: (movie: Movie) => void;
}

export default function MovieSidebar({ movies, selectedMovie, onSelectMovie }: MovieSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = movies.filter(movie =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-white/10">
        <input
          type="text"
          placeholder="Search movies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Movie List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMovies.map((movie, index) => (
          <button
            key={movie.id}
            onClick={() => onSelectMovie(movie)}
            className={`w-full flex items-center gap-3 p-3 border-b border-white/5 transition-all hover:bg-white/10 ${
              selectedMovie?.id === movie.id ? 'bg-purple-500/30 border-l-4 border-l-purple-500' : ''
            }`}
          >
            {/* Index */}
            <span className="text-gray-500 text-sm w-6 flex-shrink-0">{index + 1}</span>

            {/* Poster Thumbnail */}
            <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-800">
              <Image
                src={movie.poster}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>

            {/* Movie Info */}
            <div className="flex-1 text-left min-w-0">
              <h3 className={`font-medium truncate text-sm ${
                selectedMovie?.id === movie.id ? 'text-white' : 'text-gray-200'
              }`}>
                {movie.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {movie.cities.length} cities
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  movie.age_category === 'SU' ? 'bg-green-500/20 text-green-400' :
                  movie.age_category === 'R' ? 'bg-yellow-500/20 text-yellow-400' :
                  movie.age_category === 'D' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {movie.age_category}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 text-center text-xs text-gray-500">
        {filteredMovies.length} movies
      </div>
    </div>
  );
}
