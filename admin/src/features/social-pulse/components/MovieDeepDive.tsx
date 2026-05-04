'use client';

import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
} from '@/components/ui/dialog';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend
} from 'recharts';
import { 
    Play, 
    Globe, 
    ArrowUpRight, 
    MessageSquare,
    ChevronRight,
    BarChart3
} from 'lucide-react';
import { MovieBuzz } from '../types';
import { cn } from '@/lib/utils';
import { getInsightConfig } from '../utils/insightConfig';
import Link from 'next/link';

interface MovieDeepDiveProps {
    movie: MovieBuzz | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MovieDeepDive({ movie, open, onOpenChange }: MovieDeepDiveProps) {
    if (!movie) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="left-auto top-0 right-0 bottom-0 translate-x-0 translate-y-0 sm:max-w-[700px] rounded-none border-l border-primary/20 p-0 shadow-2xl overflow-y-auto custom-scrollbar flex flex-col gap-0 transition-transform duration-500 bg-background/95 backdrop-blur-xl">
                {/* 1. Forensic Header */}
                <div className="p-8 border-b border-border/40 bg-muted/5">
                    <DialogHeader>
                        <div className="flex items-start gap-6">
                            {movie.poster && (
                                <div className="w-20 h-28 rounded-2xl bg-muted overflow-hidden flex-shrink-0 border border-border/20 shadow-2xl">
                                    <img src={movie.poster} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-black uppercase tracking-widest border border-primary/10">
                                        Forensic Analysis
                                    </span>
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border",
                                        ...(() => {
                                            const cfg = getInsightConfig(movie.insight);
                                            return [cfg.bg, cfg.color, cfg.border];
                                        })()
                                    )}>
                                        {movie.insight}
                                    </div>
                                </div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">
                                    {movie.title}
                                </DialogTitle>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Buzz Score</span>
                                        <span className="text-xl font-black font-mono text-primary leading-none">{movie.buzz_score}</span>
                                    </div>
                                    <div className="w-px h-6 bg-border/40" />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Perf Score</span>
                                        <span className="text-xl font-black font-mono text-foreground leading-none">{movie.sales_score}</span>
                                    </div>
                                    <Link 
                                        href={`/performances/${movie.metadata_id}`}
                                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-transform"
                                    >
                                        View Full Perf <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-10">
                    {/* 2. 14-Day Correlation Chart */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                14-Day Correlation Velocity
                            </h4>
                        </div>
                        <div className="h-64 w-full bg-muted/10 rounded-[2rem] border border-border/30 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={movie.history_14d}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis 
                                        dataKey="date" 
                                        fontSize={10} 
                                        fontWeight="bold"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'rgba(255,255,255,0.4)' }}
                                    />
                                    <YAxis hide domain={[0, 100]} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }}
                                        itemStyle={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                                    />
                                    <Legend iconType="circle" />
                                    <Line 
                                        name="Social Buzz" 
                                        type="monotone" 
                                        dataKey="buzz" 
                                        stroke="#f97316" 
                                        strokeWidth={3} 
                                        dot={false} 
                                        animationDuration={1500}
                                    />
                                    <Line 
                                        name="Market Sales" 
                                        type="monotone" 
                                        dataKey="sales" 
                                        stroke="#10b981" 
                                        strokeWidth={3} 
                                        dot={false} 
                                        animationDuration={1500}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic text-center">
                            Divergence is most visible at D-7 breakout points.
                        </p>
                    </section>

                    {/* 3. Platform Telemetry Grid */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500">
                                <Globe className="w-3.5 h-3.5" />
                                Google Trends
                            </div>
                            <div className="space-y-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                {movie.telemetry.google.top_provinces.map(p => (
                                    <div key={p.name} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                                            <span>{p.name}</span>
                                            <span className="text-blue-500 font-mono">{p.pct}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full opacity-60" style={{ width: `${p.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500">
                                <Play className="w-3.5 h-3.5" />
                                YouTube Pulse
                            </div>
                            <div className="space-y-4 p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase">View Velocity</span>
                                    <span className="text-lg font-black font-mono text-red-600">{movie.telemetry.youtube.view_velocity}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Engage Ratio</span>
                                    <span className="text-lg font-black font-mono text-foreground">{(movie.telemetry.youtube.like_ratio * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                TMDB Signal
                            </div>
                            <div className="space-y-4 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Global Rank</span>
                                    <span className="text-lg font-black font-mono text-amber-600">#{movie.telemetry.tmdb.global_rank}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Local Interest</span>
                                    <span className="text-lg font-black font-mono text-foreground">{movie.telemetry.tmdb.local_popularity_delta}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 4. Audience Narrative (AI) */}
                    <section className="space-y-4 pt-6 border-t border-border/40">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                            <MessageSquare className="w-4 h-4" />
                            Audience Narrative (Forensic AI)
                        </div>
                        <div className="bg-primary/5 rounded-[2rem] p-6 border border-primary/10 shadow-inner">
                            <p className="text-sm font-medium leading-relaxed italic text-foreground/80 first-letter:text-3xl first-letter:font-black first-letter:mr-2 first-letter:float-left first-letter:text-primary">
                                &quot;{movie.ai_analysis}&quot;
                            </p>
                        </div>
                    </section>
                </div>
                
                {/* 5. Footer Metadata */}
                <div className="mt-auto p-6 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Total Sales</span>
                            <span className="text-xs font-mono font-black">{movie.metrics.raw_sold.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Occupancy</span>
                            <span className="text-xs font-mono font-black">{movie.metrics.ocr_pct}%</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground/40 uppercase">
                        Ref:MP-{movie.metadata_id.slice(0, 8)}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
