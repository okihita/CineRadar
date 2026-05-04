'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { MovieBuzz } from '../types';
import { cn } from '@/lib/utils';

interface BuzzRankingTableProps {
    movies: MovieBuzz[];
}

export function BuzzRankingTable({ movies }: BuzzRankingTableProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Movie Buzz Ranking</h3>
                    <div className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Today</div>
                </div>
            </div>

            <div className="border border-border/40 rounded-3xl overflow-hidden bg-background/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border/40 bg-muted/20">
                            <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-16 text-center">Rank</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Movie Title</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Buzz Score</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Momentum</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Search Trend (7d)</th>
                            <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Top Keyword</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {movies.map((movie, i) => (
                            <tr key={movie.metadata_id} className="group hover:bg-muted/30 transition-colors">
                                <td className="py-4 px-6 text-center font-mono text-base font-black text-muted-foreground/30">{i + 1}</td>
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-3">
                                        {movie.poster && (
                                            <div className="w-8 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0 border border-border/20 shadow-sm">
                                                <img src={movie.poster} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <span className="font-bold text-sm tracking-tight">{movie.title}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <div className="inline-flex flex-col items-center">
                                        <span className={cn(
                                            "text-lg font-black font-mono",
                                            movie.buzz_score > 80 ? "text-green-500" : movie.buzz_score > 50 ? "text-amber-500" : "text-muted-foreground"
                                        )}>
                                            {movie.buzz_score}
                                        </span>
                                        <div className="w-12 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                            <div 
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-1000",
                                                    movie.buzz_score > 80 ? "bg-green-500" : movie.buzz_score > 50 ? "bg-amber-500" : "bg-muted-foreground/40"
                                                )}
                                                style={{ width: `${movie.buzz_score}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-center text-xs">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border/50 shadow-sm">
                                        {movie.momentum === 'rising' ? (
                                            <><TrendingUp className="w-3 h-3 text-green-500" /><span className="font-bold text-[10px] uppercase text-green-600">Rising</span></>
                                        ) : movie.momentum === 'falling' ? (
                                            <><TrendingDown className="w-3 h-3 text-red-500" /><span className="font-bold text-[10px] uppercase text-red-600">Falling</span></>
                                        ) : (
                                            <><Minus className="w-3 h-3 text-muted-foreground" /><span className="font-bold text-[10px] uppercase text-muted-foreground">Stable</span></>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex items-end gap-[2px] h-6 w-24">
                                        {movie.trends_7d.map((val, idx) => (
                                            <div 
                                                key={idx} 
                                                className={cn(
                                                    "flex-1 rounded-t-sm transition-all duration-1000",
                                                    movie.momentum === 'rising' ? "bg-primary/40 group-hover:bg-primary" : "bg-muted-foreground/20 group-hover:bg-muted-foreground/40"
                                                )}
                                                style={{ height: `${val}%` }}
                                            />
                                        ))}
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
                                        #{movie.top_keywords[0]}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
                <Info className="w-3.5 h-3.5 text-primary" />
                <p className="text-[10px] font-bold text-primary/70 uppercase tracking-tight">
                    Buzz Score is a composite index of Google Trends (50%), YouTube View Velocity (40%), and TMDB Popularity (10%).
                </p>
            </div>
        </div>
    );
}
