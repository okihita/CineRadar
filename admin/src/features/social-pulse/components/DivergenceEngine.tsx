'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MovieBuzz } from '../types';
import { cn } from '@/lib/utils';

interface DivergenceEngineProps {
    movies: MovieBuzz[];
}

export function DivergenceEngine({ movies }: DivergenceEngineProps) {
    const top5 = movies.slice(0, 5);

    const getInsightConfig = (insight: MovieBuzz['insight']) => {
        switch (insight) {
            case 'pent-up': return { label: 'Pent-up Demand', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', desc: 'Social interest > Ticket sales. Expect a spike.' };
            case 'over-hyped': return { label: 'Marketing Only', icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', desc: 'High buzz but low conversion to sales.' };
            case 'fading': return { label: 'Fading Interest', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', desc: 'Buzz and sales are dropping together.' };
            default: return { label: 'Synced', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', desc: 'Social buzz matches box office performance.' };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">The Divergence Engine</h3>
                    <div className="px-2 py-0.5 bg-primary/10 rounded text-[10px] font-black text-primary uppercase tracking-tight">Top 5 Momentum</div>
                </div>
            </div>

            <div className="border border-border/40 rounded-[2.5rem] overflow-hidden bg-background/50 backdrop-blur-md shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border/40 bg-muted/20">
                            <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Movie Intelligence</th>
                            <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Pulse (Buzz)</th>
                            <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Perf (Sales)</th>
                            <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">The Gap (Insight)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {top5.map((movie) => {
                            const config = getInsightConfig(movie.insight);
                            const Icon = config.icon;
                            
                            return (
                                <tr key={movie.metadata_id} className="group hover:bg-muted/30 transition-all duration-500">
                                    <td className="py-6 px-6">
                                        <div className="flex items-center gap-4">
                                            {movie.poster && (
                                                <div className="w-10 h-14 rounded-xl bg-muted overflow-hidden flex-shrink-0 border border-border/20 shadow-xl group-hover:scale-105 transition-transform duration-500">
                                                    <img src={movie.poster} alt="" className="w-full h-full object-cover" />
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
                                    
                                    <td className="py-6 px-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xl font-black font-mono text-foreground">{movie.buzz_score}</span>
                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary rounded-full transition-all duration-1000"
                                                    style={{ width: `${movie.buzz_score}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-6 px-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xl font-black font-mono text-muted-foreground/80">{movie.sales_score}</span>
                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-muted-foreground/40 rounded-full transition-all duration-1000"
                                                    style={{ width: `${movie.sales_score}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-6 px-6">
                                        <div className={cn(
                                            "p-4 rounded-2xl border transition-all duration-500 group-hover:shadow-md",
                                            config.bg, config.border
                                        )}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className={cn("w-4 h-4", config.color)} />
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest", config.color)}>
                                                    {config.label}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium leading-tight text-foreground/70">
                                                {config.desc}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 px-6 py-4 bg-blue-500/5 rounded-3xl border border-blue-500/10">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Opportunity Zone</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Movies with high social gravity but untapped seating capacity.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4 bg-primary/5 rounded-3xl border border-primary/10">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Calculation Logic</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Divergence = (Normalized Buzz Score) - (Normalized Sales Velocity).</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
