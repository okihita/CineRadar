'use client';

import { MovieSummaryCard } from './MovieSummaryCard';
import { MovieSummary } from '../types/performance';

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
