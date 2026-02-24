import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
}

interface MovieSummaryCardProps {
    movie: MovieSummary;
}

export function MovieSummaryCard({ movie }: MovieSummaryCardProps) {
    return (
        <div className="flex gap-4">
            <div className="relative w-24 aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-sm">
                {movie.poster ? (
                    <Image
                        src={movie.poster}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="100px"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Target className="w-6 h-6" />
                    </div>
                )}
            </div>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{movie.title}</h1>
                <p className="text-sm text-muted-foreground/80 mt-1 max-w-xl">
                    {movie.genres || 'Genre N/A'} • {movie.age_category || 'Rating N/A'}
                </p>
                <div className="flex gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs font-normal">
                        Updated: {new Date(movie.last_updated).toLocaleDateString()}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
