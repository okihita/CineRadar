'use client';

import { MovieSummaryCard } from './MovieSummaryCard';
import { MarketingMetadata } from '../types/social';

interface MovieSummary {
  id: string;
  movie_id: string;
  title: string;
  poster: string;
  last_updated: string;
  genres?: string;
  age_category?: string;
  director?: string;
  production_house?: string;
  marketing?: MarketingMetadata;
}

interface MovieSummaryCardWrapperProps {
  movie: MovieSummary;
}

export function MovieSummaryCardWrapper({ movie }: MovieSummaryCardWrapperProps) {
  return (
    <MovieSummaryCard 
      movie={movie} 
    />
  );
}
