'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, MessageCircle, Hash, TrendingUp, Music, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditMarketingModal } from './social';
import { DailyPerformanceWithMeta } from '../types/performance';

interface DailyStatsBannerProps {
    stats: DailyPerformanceWithMeta;
    onMarketingUpdate?: () => void;
}

/**
 * Marketing DNA Strip
 * 
 * A focused horizontal strip showing marketing intelligence (the "Why").
 * Performance Results (the "What") have been moved to the Header HUD.
 */
export function DailyStatsBanner({ stats, onMarketingUpdate }: DailyStatsBannerProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const router = useRouter();

    return (
        <div className="w-full bg-muted/20 border border-border/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row items-stretch">
                
                {/* LEFT: LABEL */}
                <div className="flex flex-col justify-center gap-1.5 px-6 py-3 bg-zinc-900/5 dark:bg-white/5 border-r border-border/30 min-w-[160px]">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground opacity-70" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">
                            Marketing DNA
                        </span>
                    </div>
                    <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditModalOpen(true)}
                        className="h-6 gap-1 px-1 text-[8px] font-black uppercase text-primary hover:text-primary hover:bg-primary/5 transition-all ml-4"
                    >
                        <Pencil className="w-2.5 h-2.5" />
                        Edit Info
                    </Button>
                </div>

                {/* RIGHT: SLOTS */}
                <div className="flex-1 p-3 lg:px-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {/* Instagram Slot */}
                        {stats.marketing?.official_accounts?.instagram ? (
                            <a 
                                href={`https://instagram.com/${stats.marketing.official_accounts.instagram.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 group cursor-pointer" 
                                title={`Visit Instagram: @${stats.marketing.official_accounts.instagram.replace(/^@/, '')}`}
                            >
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-600 border border-pink-500/10 transition-all group-hover:bg-pink-500/20 group-hover:scale-110">
                                    <Camera className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">Instagram</span>
                                    <span className="text-[11px] font-black truncate group-hover:text-pink-600 transition-colors">@{stats.marketing.official_accounts.instagram.replace(/^@/, '')}</span>
                                </div>
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 opacity-40 grayscale">
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                    <Camera className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">Instagram</span>
                                    <span className="text-[11px] font-black truncate">—</span>
                                </div>
                            </div>
                        )}

                        {/* X / Twitter Slot */}
                        {stats.marketing?.official_accounts?.x ? (
                            <a 
                                href={`https://x.com/${stats.marketing.official_accounts.x.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 group cursor-pointer" 
                                title={`Visit X (Twitter): @${stats.marketing.official_accounts.x.replace(/^@/, '')}`}
                            >
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center text-foreground border border-foreground/10 transition-all group-hover:bg-foreground/20 group-hover:scale-110">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">X / Twitter</span>
                                    <span className="text-[11px] font-black truncate group-hover:text-primary transition-colors">@{stats.marketing.official_accounts.x.replace(/^@/, '')}</span>
                                </div>
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 opacity-40 grayscale">
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">X / Twitter</span>
                                    <span className="text-[11px] font-black truncate">—</span>
                                </div>
                            </div>
                        )}

                        {/* TikTok Slot */}
                        {stats.marketing?.official_accounts?.tiktok ? (
                            <a 
                                href={`https://tiktok.com/@${stats.marketing.official_accounts.tiktok.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 group cursor-pointer" 
                                title={`Visit TikTok: @${stats.marketing.official_accounts.tiktok.replace(/^@/, '')}`}
                            >
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-600 border border-cyan-500/10 transition-all group-hover:bg-cyan-500/20 group-hover:scale-110">
                                    <Music className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">TikTok</span>
                                    <span className="text-[11px] font-black truncate group-hover:text-cyan-600 transition-colors">@{stats.marketing.official_accounts.tiktok.replace(/^@/, '')}</span>
                                </div>
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 opacity-40 grayscale">
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                    <Music className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">TikTok</span>
                                    <span className="text-[11px] font-black truncate">—</span>
                                </div>
                            </div>
                        )}

                        {/* Hashtag Slot */}
                        {stats.marketing?.primary_hashtag ? (
                            <a 
                                href={`https://www.google.com/search?q=${encodeURIComponent(stats.marketing.primary_hashtag)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 group cursor-pointer h-10 min-w-0" 
                                title={`Search: ${stats.marketing.primary_hashtag}`}
                            >
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/10 transition-all group-hover:bg-blue-500/20 group-hover:scale-110">
                                    <Hash className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0 justify-center h-full">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">Hashtag</span>
                                    <div className="flex flex-col min-h-[14px] justify-center">
                                        <span className="text-[11px] font-black truncate leading-tight group-hover:text-blue-600 transition-colors">{stats.marketing.primary_hashtag}</span>
                                        {stats.marketing.secondary_hashtags && stats.marketing.secondary_hashtags.length > 0 && (
                                            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                                                {stats.marketing.secondary_hashtags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[7px] font-bold text-muted-foreground/50 whitespace-nowrap">
                                                        {tag}
                                                    </span>
                                                ))}
                                                {stats.marketing.secondary_hashtags.length > 2 && (
                                                    <span className="text-[7px] font-bold text-muted-foreground/30">+{stats.marketing.secondary_hashtags.length - 2}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 opacity-40 grayscale h-8">
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                    <Hash className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0 justify-center">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">Hashtag</span>
                                    <span className="text-[11px] font-black truncate">—</span>
                                </div>
                            </div>
                        )}

                        {/* Trends Slot */}
                        <div className="flex items-center gap-2 group cursor-help" title="Google Trends Score">
                            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                                <TrendingUp className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5 tracking-tighter">Google Trend</span>
                                <span className="text-[11px] font-black flex items-baseline gap-1">
                                    {stats.marketing?.trends_score || "—"} 
                                    {stats.marketing?.trends_score && <span className="text-[7px] font-bold text-green-500">+12%</span>}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Edit Marketing Modal */}
            <EditMarketingModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                movieId={stats.id || stats.movie_id}
                movieTitle={stats.title}
                initialData={stats.marketing}
                onSuccess={() => {
                    router.refresh();
                    onMarketingUpdate?.();
                }}
            />
        </div>
    );
}
