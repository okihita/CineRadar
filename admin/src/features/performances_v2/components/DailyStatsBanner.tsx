'use client';

import { Target, Users, Armchair, MapPin, Camera, MessageCircle, Hash, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
    marketing?: {
        instagram?: string;
        twitter?: string;
        hashtag?: string;
        trends_score?: number;
    };
}

interface DailyStatsBannerProps {
    stats: DailyPerformance;
}

export function DailyStatsBanner({ stats }: DailyStatsBannerProps) {
    return (
        <div className="w-full bg-muted/30 border border-border/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row items-stretch">
                
                {/* LEFT: MARKETING INTELLIGENCE (The "Why") */}
                <div className="flex-1 p-4 lg:p-6 bg-zinc-900/5 dark:bg-white/5">
                    <div className="flex items-center gap-2 mb-4 opacity-70">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marketing Intelligence</span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Instagram Slot */}
                        <div className="flex items-center gap-2.5 group cursor-help" title="Official Instagram Campaign">
                            <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-600 border border-pink-500/10 transition-colors group-hover:bg-pink-500/20">
                                <Camera className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 tracking-tighter">Instagram</span>
                                <span className="text-xs font-black truncate max-w-[100px]">{stats.marketing?.instagram || "@cine_radar"}</span>
                            </div>
                        </div>

                        {/* X / Twitter Slot */}
                        <div className="flex items-center gap-2.5 group cursor-help" title="X (Twitter) Buzz">
                            <div className="w-8 h-8 rounded-full bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center text-foreground border border-foreground/10 transition-colors group-hover:bg-foreground/10">
                                <MessageCircle className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 tracking-tighter">X / Twitter</span>
                                <span className="text-xs font-black truncate max-w-[100px]">{stats.marketing?.twitter || "Pending..."}</span>
                            </div>
                        </div>

                        {/* Hashtag Slot */}
                        <div className="flex items-center gap-2.5 group cursor-help" title="Primary Campaign Hashtag">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                                <Hash className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 tracking-tighter">Campaign</span>
                                <span className="text-xs font-black truncate max-w-[100px]">{stats.marketing?.hashtag || "#CineRadar"}</span>
                            </div>
                        </div>

                        {/* Trends Slot */}
                        <div className="flex items-center gap-2.5 group cursor-help" title="Google Trends Score">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 tracking-tighter">Google Trend</span>
                                <span className="text-xs font-black flex items-baseline gap-1">
                                    {stats.marketing?.trends_score || "84"} 
                                    <span className="text-[8px] font-bold text-green-500">+12%</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DIVIDER */}
                <div className="hidden lg:block w-px bg-border/50 my-6" />

                {/* RIGHT: PERFORMANCE RESULTS (The "What") */}
                <div className="flex-[0.8] p-4 lg:p-6 flex items-center">
                    <div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-2">
                        {/* Occupancy */}
                        <div className="flex flex-col px-4 border-r border-border/30 last:border-0">
                            <div className="flex items-center gap-1.5 text-muted-foreground/60 mb-1">
                                <Target className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">True OCR</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className={cn(
                                    "text-2xl font-black font-mono tracking-tighter",
                                    stats.avg_occupancy_pct >= 50 ? "text-green-600" : 
                                    stats.avg_occupancy_pct >= 20 ? "text-amber-600" : "text-red-600"
                                )}>
                                    {stats.avg_occupancy_pct.toFixed(1)}
                                </span>
                                <span className="text-[10px] font-bold opacity-40 uppercase">%</span>
                            </div>
                        </div>

                        {/* Total Seats */}
                        <div className="flex flex-col px-4 border-r border-border/30 last:border-0">
                            <div className="flex items-center gap-1.5 text-muted-foreground/60 mb-1">
                                <Armchair className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
                            </div>
                            <span className="text-2xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                                {(stats.total_seats / 1000).toFixed(1)}
                                <span className="text-[10px] font-bold opacity-40 uppercase ml-0.5">k</span>
                            </span>
                        </div>

                        {/* Sold */}
                        <div className="flex flex-col px-4 border-r border-border/30 last:border-0">
                            <div className="flex items-center gap-1.5 text-muted-foreground/60 mb-1">
                                <Users className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Audience</span>
                            </div>
                            <span className="text-2xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                                {(stats.total_sold / 1000).toFixed(1)}
                                <span className="text-[10px] font-bold opacity-40 uppercase ml-0.5">k</span>
                            </span>
                        </div>

                        {/* Cities */}
                        <div className="flex flex-col px-4">
                            <div className="flex items-center gap-1.5 text-muted-foreground/60 mb-1">
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Markets</span>
                            </div>
                            <span className="text-2xl font-black font-mono tracking-tighter text-foreground">
                                {stats.cities?.length || 0}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
