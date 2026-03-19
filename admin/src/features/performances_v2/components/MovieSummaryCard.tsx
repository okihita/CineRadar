/**
 * Movie Summary Card Component
 * 
 * Displays movie poster, title, metadata, and social marketing badges.
 * Extended in Phase 1 of the Social Marketing Integration Plan.
 */
'use client';

import { useState } from 'react';
import { Target, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { SocialHandleBadges, EditMarketingModal } from './social';
import { MarketingMetadata } from '../types/social';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
    marketing?: MarketingMetadata;
}

interface MovieSummaryCardProps {
    movie: MovieSummary;
    /** Callback when marketing data is updated */
    onMarketingUpdate?: () => void;
}

export function MovieSummaryCard({ movie, onMarketingUpdate }: MovieSummaryCardProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    return (
        <>
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
                <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">{movie.title}</h1>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditModalOpen(true)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit Marketing
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground/80 mt-1 max-w-xl">
                        {movie.genres || 'Genre N/A'} • {movie.age_category || 'Rating N/A'}
                    </p>
                    
                    {/* Social Handle Badges */}
                    {movie.marketing && (
                        <div className="mt-3">
                            <SocialHandleBadges marketing={movie.marketing} />
                        </div>
                    )}
                    
                    {/* Last Updated Badge */}
                    <div className="flex gap-2 mt-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                            Updated: {new Date(movie.last_updated).toLocaleDateString()}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Edit Marketing Modal */}
            <EditMarketingModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                movieId={movie.id}
                movieTitle={movie.title}
                initialData={movie.marketing}
                onSuccess={() => {
                    onMarketingUpdate?.();
                }}
            />
        </>
    );
}
