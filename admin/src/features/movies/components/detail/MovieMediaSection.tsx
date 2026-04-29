'use client';

import React from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MovieMediaSectionProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie: Record<string, any>;
}

export function MovieMediaSection({ movie }: MovieMediaSectionProps) {
    if (!Array.isArray(movie.videos) || movie.videos.length === 0) return null;

    return (
        <Card className="rounded border-border shadow-none">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-sm font-semibold tracking-tight">Media & Videos</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(movie.videos as Record<string, unknown>[]).map((video, idx: number) => {
                        const path = (video.path as string) || '';
                        const title = (video.title as string) || 'Video';
                        const thumbnail = (video.thumbnail as string) || '';

                        if (!path) return null;

                        return (
                            <a 
                                key={idx} 
                                href={path} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="group block border border-border rounded overflow-hidden hover:border-primary/50 transition-colors"
                            >
                                <div className="aspect-video relative bg-muted flex items-center justify-center">
                                    {thumbnail ? (
                                        <Image 
                                            src={thumbnail} 
                                            alt={title} 
                                            fill 
                                            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                            unoptimized 
                                        />
                                    ) : (
                                        <Film className="w-8 h-8 opacity-20" />
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            ▶
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-card border-t border-border group-hover:bg-muted/30 transition-colors">
                                    <p className="text-xs font-medium line-clamp-2 text-foreground/80 leading-tight">{title}</p>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
