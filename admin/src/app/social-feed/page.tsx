/**
 * Industry Feed — YouTube-only MVP
 * 
 * Curated timeline from Indonesian cinema ecosystem YouTube channels.
 * Real data from YouTube Data API v3, organized by content type.
 */
'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    Filter,
    CheckCircle2,
    Film,
    Star,
    Clapperboard,
    Users,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/api';
import {
    ACCOUNTS,
    detectContentType,
    CONTENT_TYPE_LABELS,
    type SocialAccount,
    type AccountCategory,
    type ContentType,
} from '@/features/social-pulse/data/mockSocialFeed';
import { YouTubeIcon } from '@/components/BrandIcons';

// ─── Category labels (kept in page, UI-only) ──────────

const CATEGORY_LABELS: Record<AccountCategory, { label: string; color: string }> = {
    critic: { label: 'Critics', color: 'text-amber-500' },
    cinema_chain: { label: 'Cinema Chains', color: 'text-green-500' },
    distributor: { label: 'Distributors', color: 'text-blue-500' },
    community: { label: 'Community', color: 'text-purple-500' },
};

// ─── Content type icon mapping ────────────────────────

const CONTENT_ICONS: Record<ContentType, typeof Film> = {
    trailer: Film,
    review: Star,
    short: Zap,
    promo: Clapperboard,
    community: Users,
};

// ─── Helper: relative time ────────────────────────────

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formatNumber(n: number | string): string {
    const num = typeof n === 'string' ? parseInt(n) : n;
    if (isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ─── YouTube API response type ────────────────────────

interface YouTubePost {
    id: string;
    account_id: string;
    content: string;
    description: string;
    timestamp: string;
    video_id: string;
    video_url: string;
    thumbnail?: string;
    channel_avatar?: string;
    channel_stats: { subscriber_count: string; video_count: string; view_count: string } | null;
}

interface EnrichedPost extends YouTubePost {
    contentType: ContentType;
}

// ─── Post Card ────────────────────────────────────────

function PostCard({ post, account }: { post: EnrichedPost; account: SocialAccount }) {
    const typeConfig = CONTENT_TYPE_LABELS[post.contentType];
    const TypeIcon = CONTENT_ICONS[post.contentType];

    return (
        <a
            href={post.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-background/50 border border-border/40 rounded-2xl hover:bg-muted/30 hover:border-border/60 transition-all duration-300 overflow-hidden"
        >
            {/* Thumbnail — full width, no crop */}
            {post.thumbnail && (
                <div className="relative">
                    <img src={post.thumbnail} alt="" className="w-full h-auto object-cover" loading="lazy" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <YouTubeIcon className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    {/* Content type badge — overlaid on thumbnail */}
                    <div className={cn("absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[8px] font-bold uppercase tracking-wider", typeConfig.color)}>
                        <TypeIcon className="w-2.5 h-2.5" />
                        <span>{post.contentType}</span>
                    </div>
                    {/* Timestamp — overlaid on thumbnail */}
                    <span className="absolute bottom-2 right-2 text-[9px] text-white/80 font-mono tabular-nums bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">{timeAgo(post.timestamp)}</span>
                </div>
            )}

            {/* Content below thumbnail */}
            <div className="p-3 space-y-2">
                {/* Account header — compact */}
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {post.channel_avatar ? (
                            <img src={post.channel_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <YouTubeIcon className="w-3 h-3 text-red-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[11px] font-bold truncate">{account.display_name}</span>
                        {account.verified && <CheckCircle2 className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                        <span className="text-[9px] text-muted-foreground/50 font-mono flex-shrink-0">{account.follower_count}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/40 font-mono flex-shrink-0">{post.channel_stats?.view_count ? formatNumber(post.channel_stats.view_count) + ' views' : ''}</span>
                </div>

                {/* Title */}
                <p className="text-[12px] font-semibold leading-snug text-foreground line-clamp-2">
                    {post.content}
                </p>
            </div>
        </a>
    );
}

// ─── Account Card (right sidebar) ────────────────────

function AccountCard({ account, postCount }: { account: SocialAccount; postCount: number }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/20 hover:bg-muted/20 transition-colors">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                {account.avatar_url ? (
                    <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <YouTubeIcon className="w-4 h-4 text-red-500" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate">{account.display_name}</span>
                    {account.verified && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{account.follower_count} subs</span>
                    <span className="text-xs text-muted-foreground/30">•</span>
                    <span className="text-xs font-mono text-muted-foreground">{postCount} videos</span>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────

type FilterType = 'all' | ContentType;

export default function SocialFeedPage() {
    const [filter, setFilter] = useState<FilterType>('all');

    // Fetch real YouTube data
    const { data: ytData, isLoading } = useSWR<{ success: boolean; data: { posts: YouTubePost[] } }>(
        '/api/social-feed/youtube?maxResults=5',
        fetcher
    );

    // Enrich posts with content type detection
    const enrichedPosts = useMemo<EnrichedPost[]>(() => {
        const posts = ytData?.data?.posts || [];
        return posts.map(post => {
            const account = ACCOUNTS.find(a => a.id === post.account_id);
            const contentType = detectContentType(post.content, account?.category || 'community');
            return { ...post, contentType };
        });
    }, [ytData]);

    // Update accounts with real data from API
    const enrichedAccounts = useMemo(() => {
        const seen = new Map<string, { subscriber_count: string; avatar_url?: string }>();
        for (const yt of ytData?.data?.posts || []) {
            if (!seen.has(yt.account_id) && yt.channel_stats) {
                seen.set(yt.account_id, {
                    subscriber_count: yt.channel_stats.subscriber_count,
                    avatar_url: yt.channel_avatar,
                });
            }
        }

        return ACCOUNTS.map(a => {
            const data = seen.get(a.id);
            if (data) {
                return {
                    ...a,
                    follower_count: formatNumber(data.subscriber_count),
                    avatar_url: data.avatar_url,
                };
            }
            return a;
        });
    }, [ytData]);

    // Filter posts
    const filteredPosts = useMemo(() => {
        if (filter === 'all') return enrichedPosts;
        return enrichedPosts.filter(p => p.contentType === filter);
    }, [filter, enrichedPosts]);

    const accountsByCategory = useMemo(() => {
        const grouped: Record<AccountCategory, SocialAccount[]> = {
            critic: [], cinema_chain: [], distributor: [], community: [],
        };
        enrichedAccounts.forEach(a => grouped[a.category].push(a));
        return grouped;
    }, [enrichedAccounts]);

    const getPostCount = (accountId: string) => enrichedPosts.filter(p => p.account_id === accountId).length;
    const getAccount = (id: string) => enrichedAccounts.find(a => a.id === id)!;

    // Count posts per content type
    const contentTypeCounts = useMemo(() => {
        const counts: Record<ContentType, number> = { trailer: 0, review: 0, short: 0, promo: 0, community: 0 };
        enrichedPosts.forEach(p => { counts[p.contentType]++; });
        return counts;
    }, [enrichedPosts]);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                        <YouTubeIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black uppercase tracking-tighter">Industry Feed</h1>
                            <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-black text-muted-foreground uppercase tracking-tight">YouTube</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-foreground font-bold">{enrichedAccounts.length} channels</span> • {enrichedPosts.length} videos • YouTube Data API v3
                        </p>
                    </div>
                </div>
            </div>

            {/* Content type filter tabs */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/40" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter('all')}
                    className={cn(
                        "h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        filter === 'all' ? "bg-red-500 text-white hover:bg-red-600" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    All ({enrichedPosts.length})
                </Button>
                {(Object.entries(CONTENT_TYPE_LABELS) as [ContentType, typeof CONTENT_TYPE_LABELS[ContentType]][]).map(([key, cfg]) => {
                    const count = contentTypeCounts[key];
                    if (count === 0) return null;
                    const Icon = CONTENT_ICONS[key];
                    return (
                        <Button
                            key={key}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(key)}
                            className={cn(
                                "h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5",
                                filter === key ? "bg-red-500 text-white hover:bg-red-600" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="w-3 h-3" />
                            {cfg.label} ({count})
                        </Button>
                    );
                })}
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                    <YouTubeIcon className="w-6 h-6 text-red-500 animate-pulse" />
                    <span className="text-sm font-bold uppercase tracking-widest">Fetching latest uploads...</span>
                </div>
            )}

            {/* ─── 3-Zone Layout ────────────────────────────── */}
            {!isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* ZONE 1: AI Pulse (left, ~20%) */}
                    <aside className="lg:col-span-2 space-y-4">
                        <div className="sticky top-6 space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Pulse</h2>
                            
                            {/* Hourly signal summary */}
                            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                                <p className="text-xs font-bold text-foreground leading-relaxed">
                                    {enrichedPosts.length > 0
                                        ? `${enrichedPosts.filter(p => p.contentType === 'trailer').length} new trailers and ${enrichedPosts.filter(p => p.contentType === 'review').length} reviews detected in the latest fetch.`
                                        : 'No new uploads detected. Next scan in 60 minutes.'
                                    }
                                </p>
                                {enrichedPosts.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-border/20">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Top Signal</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {(() => {
                                                const topPost = enrichedPosts[0];
                                                const acct = getAccount(topPost.account_id);
                                                return `${acct.display_name} posted "${topPost.content.slice(0, 40)}..." — ${timeAgo(topPost.timestamp)}`;
                                            })()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Content breakdown */}
                            <div className="p-4 bg-muted/20 rounded-2xl border border-border/20 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Content Mix</p>
                                {(Object.entries(contentTypeCounts) as [ContentType, number][]).filter(([, count]) => count > 0).map(([type, count]) => {
                                    const total = Math.max(enrichedPosts.length, 1);
                                    return (
                                        <div key={type} className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", CONTENT_TYPE_LABELS[type].color.replace('text-', 'bg-'))} />
                                            <span className="text-xs text-muted-foreground flex-1">{CONTENT_TYPE_LABELS[type].label}</span>
                                            <span className="text-xs font-mono font-bold">{Math.round((count / total) * 100)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* ZONE 2: Visual Grid (center, ~58%) */}
                    <main className="lg:col-span-7">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPosts.map(post => (
                                <PostCard key={post.id} post={post} account={getAccount(post.account_id)} />
                            ))}
                        </div>
                        {filteredPosts.length === 0 && (
                            <div className="py-20 text-center border border-dashed rounded-3xl border-border/40">
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No videos for this filter.</p>
                            </div>
                        )}
                    </main>

                    {/* ZONE 3: Account Directory (right, ~22%) */}
                    <aside className="lg:col-span-3 space-y-6">
                        <div className="sticky top-6 space-y-6">
                            {(Object.entries(accountsByCategory) as [AccountCategory, SocialAccount[]][]).map(([category, accounts]) => (
                                accounts.length > 0 && (
                                    <div key={category}>
                                        <h3 className={cn("text-xs font-black uppercase tracking-widest mb-3", CATEGORY_LABELS[category].color)}>
                                            {CATEGORY_LABELS[category].label}
                                        </h3>
                                        <div className="space-y-2">
                                            {accounts.map(account => (
                                                <AccountCard key={account.id} account={account} postCount={getPostCount(account.id)} />
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
