'use client';

import React from 'react';
import Image from 'next/image';
import { Users, Armchair, Calendar } from 'lucide-react';
import { MovieBuzz } from '../types';
import { cn } from '@/lib/utils';
import { MethodologyModal } from './MethodologyModal';
import { getInsightConfig } from '../utils/insightConfig';
import { formatCompactNumber, formatOccupancy } from '../../performances/utils/format';

interface DivergenceEngineProps {
    movies: MovieBuzz[];
    onMovieClick: (id: string) => void;
}

export function DivergenceEngine({ movies, onMovieClick }: DivergenceEngineProps) {
    const topMovies = movies.slice(0, 8);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">The Divergence Engine</h3>
                    <div className="px-2 py-0.5 bg-primary/10 rounded text-[10px] font-black text-primary uppercase tracking-tight">Top 8 Momentum</div>
                </div>
                <MethodologyModal />
            </div>

            <div className="border border-border/40 rounded-[2.5rem] overflow-hidden bg-background/50 backdrop-blur-md shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="border-b border-border/40 bg-muted/20">
                            <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[22%]">Movie Intelligence</th>
                            <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center w-[10%]">Pulse</th>
                            <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center w-[15%]">Perf &amp; Raw</th>
                            <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[18%]">Gap</th>
                            <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[35%]">AI Forensic Analysis</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {topMovies.map((movie) => {
                            const config = getInsightConfig(movie.insight);
                            
                            return (
                                <tr 
                                    key={movie.metadata_id} 
                                    className="group hover:bg-muted/30 transition-all duration-500 cursor-pointer"
                                    onClick={() => onMovieClick(movie.metadata_id)}
                                >
                                    <td className="py-5 px-6">
                                        <div className="flex items-center gap-4">
                                            {movie.poster && (
                                                <div className="w-10 h-14 rounded-xl bg-muted overflow-hidden flex-shrink-0 border border-border/20 shadow-xl group-hover:scale-105 transition-transform duration-500 relative">
                                                    <Image 
                                                        src={movie.poster} 
                                                        alt={movie.title} 
                                                        fill 
                                                        className="object-cover"
                                                        sizes="40px"
                                                    />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <span className="font-black text-base tracking-tighter uppercase truncate block">{movie.title}</span>
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {movie.top_keywords.map(kw => (
                                                        <span key={kw} className="text-[9px] font-bold text-muted-foreground/60 uppercase">#{kw}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="py-5 px-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-black font-mono text-foreground leading-none">{movie.buzz_score}</span>
                                        </div>
                                    </td>

                                    <td className="py-5 px-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-black font-mono text-muted-foreground/80 leading-none mb-2">{movie.sales_score}</span>
                                            
                                            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-background/50 border border-border/40 shadow-inner">
                                                <div className="flex items-center gap-1" title="Total Admissions">
                                                    <Users className="w-2.5 h-2.5 text-primary opacity-50" />
                                                    <span className="text-[10px] font-black font-mono">{formatCompactNumber(movie.metrics.raw_sold)}</span>
                                                </div>
                                                <div className="w-px h-2 bg-border" />
                                                <div className="flex items-center gap-1" title="Average Occupancy">
                                                    <Armchair className="w-2.5 h-2.5 text-green-500 opacity-50" />
                                                    <span className="text-[10px] font-black font-mono text-green-600">{formatOccupancy(movie.metrics.ocr_pct)}%</span>
                                                </div>
                                                <div className="w-px h-2 bg-border" />
                                                <div className="flex items-center gap-1" title="Total Showtimes">
                                                    <Calendar className="w-2.5 h-2.5 text-amber-500 opacity-50" />
                                                    <span className="text-[10px] font-black font-mono">{movie.metrics.raw_shows}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-5 px-6">
                                        <div className="flex items-center gap-2">
                                            <config.icon className={cn("w-4 h-4", config.color)} />
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", config.color)}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="py-5 px-6">
                                        <p className="text-xs leading-relaxed text-muted-foreground font-medium italic">
                                            &quot;{movie.ai_analysis}&quot;
                                        </p>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
