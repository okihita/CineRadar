'use client';

import React from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MovieCastSectionProps {
    movie: Record<string, unknown>;
}

export function MovieCastSection({ movie }: MovieCastSectionProps) {
    if (!Array.isArray(movie.casts) && typeof movie.actor !== 'string') return null;

    return (
        <Card className="rounded border-border shadow-none">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-sm font-semibold tracking-tight">Cast & Crew</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                {Array.isArray(movie.casts) && movie.casts.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {(movie.casts as Record<string, unknown>[]).map((cast, idx: number) => {
                            const actorName = (cast.name as string) || (cast.actor_name as string) || 'Unknown';
                            const characterName = (cast.character as string) || (cast.role as string) || '';
                            const castType = (cast.cast_type as string) || '';
                            let profilePath = (cast.profile_photo as string) || '';

                            // Determine correct image URL
                            if (profilePath && profilePath.startsWith('/')) {
                                profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
                            }

                            return (
                                <div key={idx} className="flex-shrink-0 w-28 group">
                                    <div className="aspect-[2/3] relative rounded overflow-hidden bg-muted/30 border border-border/50 mb-2.5 transition-colors group-hover:border-primary/30">
                                        {profilePath ? (
                                            <Image
                                                src={profilePath}
                                                alt={actorName}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                sizes="112px"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                                <Film className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="font-semibold text-sm leading-tight line-clamp-2 mb-1 text-foreground/90 group-hover:text-primary transition-colors" title={actorName}>
                                        {actorName}
                                    </p>
                                    {(characterName || castType) && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug" title={characterName || castType}>
                                            {characterName || castType}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {movie.actor as string}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
