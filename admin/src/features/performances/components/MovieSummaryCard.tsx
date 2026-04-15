/**
 * Movie Summary Card Component
 * 
 * Displays movie poster, title, metadata, and social marketing badges.
 * Extended in Phase 1 of the Social Marketing Integration Plan.
 */
'use client';

import { Target, Film, User, Link as LinkIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { MovieSummary } from '../types/performance';

interface MovieSummaryCardProps {
    movie: MovieSummary;
}

export function MovieSummaryCard({ movie }: MovieSummaryCardProps) {
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
                            priority
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Target className="w-6 h-6" />
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">{movie.title}</h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <Link href={`/movies/${movie.id}`} target="_blank" rel="noopener noreferrer">
                                    <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                                    View in Database
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground/80 mt-1 flex items-center gap-2 divide-x">
                        <span className="pr-2">{movie.genres || 'N/A'}</span>
                        <span className="px-2">{movie.age_category || 'N/A'}</span>
                    </div>

                    {/* Enriched Metadata */}
                    <div className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                            <Film className="w-3.5 h-3.5 text-muted-foreground/70" />
                            <span className="font-semibold text-muted-foreground">Production:</span>
                            <span className="font-bold">{movie.production_house || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground/70" />
                            <span className="font-semibold text-muted-foreground">Director:</span>
                            <span className="font-bold">{movie.director || 'N/A'}</span>
                        </div>
                        {movie.actors && movie.actors.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span className="font-semibold text-muted-foreground">Stars:</span>
                                <span className="font-bold truncate max-w-[200px]">
                                    {movie.actors.slice(0, 3).join(", ")}
                                    {movie.actors.length > 3 && "..."}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Social Handle Badges - Stabilized container removed as they are moved to banner */}
                </div>
            </div>
        </>
    );
}
