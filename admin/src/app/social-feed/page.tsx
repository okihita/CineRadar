/**
 * Industry Feed — Curated timeline from Indonesian cinema ecosystem accounts.
 * 
 * Shows latest posts from critics, cinema chains, distributors, and community
 * accounts across Twitter, Instagram, YouTube, and TikTok.
 */
'use client';

import React, { useMemo, useState } from 'react';
import {
    Rss,
    MessageCircle,
    Heart,
    Repeat2,
    Eye,
    ExternalLink,
    Filter,
    CheckCircle2,
    Search,
    Megaphone,
    Tv,
    Video,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ACCOUNTS,
    POSTS,
    type SocialPost,
    type SocialAccount,
    type AccountCategory,
    type SocialPlatform,
} from '@/features/social-pulse/data/mockSocialFeed';

// ─── Platform icon/color mapping ─────────────────────

const PLATFORM_CONFIG: Record<SocialPlatform, { icon: typeof Tv; color: string; bg: string }> = {
    twitter: { icon: Megaphone, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    instagram: { icon: Tv, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    youtube: { icon: Video, color: 'text-red-500', bg: 'bg-red-500/10' },
    tiktok: { icon: MessageCircle, color: 'text-white', bg: 'bg-white/10' },
};

const CATEGORY_LABELS: Record<AccountCategory, { label: string; color: string }> = {
    critic: { label: 'Critics & Reviewers', color: 'text-amber-500' },
    cinema_chain: { label: 'Cinema Chains', color: 'text-green-500' },
    distributor: { label: 'Distributors', color: 'text-blue-500' },
    community: { label: 'Community', color: 'text-purple-500' },
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

function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

// ─── Post Card ────────────────────────────────────────

function PostCard({ post, account }: { post: SocialPost; account: SocialAccount }) {
    const platform = PLATFORM_CONFIG[account.platform];
    const PlatformIcon = platform.icon;

    return (
        <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-5 bg-background/50 border border-border/40 rounded-2xl hover:bg-muted/30 hover:border-border/60 transition-all duration-300"
        >
            {/* Account header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", platform.bg)}>
                    <PlatformIcon className={cn("w-4 h-4", platform.color)} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold truncate">{account.display_name}</span>
                        {account.verified && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{account.handle}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">{timeAgo(post.timestamp)}</span>
            </div>

            {/* Content */}
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line mb-3">
                {post.content}
            </p>

            {/* Hashtags */}
            {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {post.hashtags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-primary/70">#{tag}</span>
                    ))}
                </div>
            )}

            {/* Metrics */}
            <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                {post.metrics.likes > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground/50">
                        <Heart className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-mono">{formatNumber(post.metrics.likes)}</span>
                    </div>
                )}
                {post.metrics.retweets != null && post.metrics.retweets > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground/50">
                        <Repeat2 className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-mono">{formatNumber(post.metrics.retweets)}</span>
                    </div>
                )}
                {post.metrics.comments > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground/50">
                        <MessageCircle className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-mono">{formatNumber(post.metrics.comments)}</span>
                    </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground/50">
                    <Eye className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">{post.metrics.views}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground/30 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </a>
    );
}

// ─── Account Card ─────────────────────────────────────

function AccountCard({ account, postCount }: { account: SocialAccount; postCount: number }) {
    const platform = PLATFORM_CONFIG[account.platform];
    const PlatformIcon = platform.icon;

    return (
        <div className="flex items-center gap-3 p-3 bg-background/30 rounded-xl border border-border/20">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", platform.bg)}>
                <PlatformIcon className={cn("w-3.5 h-3.5", platform.color)} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate">{account.display_name}</span>
                    {account.verified && <CheckCircle2 className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground/50">{account.follower_count}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/30">•</span>
                    <span className="text-[9px] font-mono text-muted-foreground/50">{postCount} posts</span>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────

type FilterType = 'all' | AccountCategory;

export default function SocialFeedPage() {
    const [filter, setFilter] = useState<FilterType>('all');

    const filteredPosts = useMemo(() => {
        if (filter === 'all') return POSTS;
        const accountIds = new Set(ACCOUNTS.filter(a => a.category === filter).map(a => a.id));
        return POSTS.filter(p => accountIds.has(p.account_id));
    }, [filter]);

    const accountsByCategory = useMemo(() => {
        const grouped: Record<AccountCategory, SocialAccount[]> = {
            critic: [], cinema_chain: [], distributor: [], community: [],
        };
        ACCOUNTS.forEach(a => grouped[a.category].push(a));
        return grouped;
    }, []);

    const getPostCount = (accountId: string) => POSTS.filter(p => p.account_id === accountId).length;

    const getAccount = (id: string) => ACCOUNTS.find(a => a.id === id)!;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Rss className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Industry Feed</h1>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                        Curated timeline from <span className="text-foreground font-bold">{ACCOUNTS.length} accounts</span> across the Indonesian cinema ecosystem
                    </p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-xl border border-border/40">
                        <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">Search coming soon</span>
                    </div>
                </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-6 px-5 py-3 bg-muted/10 rounded-xl border border-border/20">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Sources</span>
                    <span className="text-sm font-black font-mono">{ACCOUNTS.length}</span>
                </div>
                <div className="w-px h-4 bg-border/20" />
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Posts Today</span>
                    <span className="text-sm font-black font-mono">{POSTS.length}</span>
                </div>
                <div className="w-px h-4 bg-border/20" />
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Platforms</span>
                    <div className="flex items-center gap-1.5">
                        <Megaphone className="w-3 h-3 text-sky-400" />
                        <Tv className="w-3 h-3 text-pink-400" />
                        <Video className="w-3 h-3 text-red-500" />
                    </div>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/40" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter('all')}
                    className={cn(
                        "h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        filter === 'all' ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    All ({POSTS.length})
                </Button>
                {(Object.entries(CATEGORY_LABELS) as [AccountCategory, typeof CATEGORY_LABELS[AccountCategory]][]).map(([key, cfg]) => {
                    const count = POSTS.filter(p => ACCOUNTS.find(a => a.id === p.account_id)?.category === key).length;
                    return (
                        <Button
                            key={key}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(key)}
                            className={cn(
                                "h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                filter === key ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {cfg.label} ({count})
                        </Button>
                    );
                })}
            </div>

            {/* Main content: Feed + Account sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Feed column */}
                <div className="lg:col-span-2 space-y-4">
                    {filteredPosts.map(post => (
                        <PostCard key={post.id} post={post} account={getAccount(post.account_id)} />
                    ))}
                    {filteredPosts.length === 0 && (
                        <div className="py-20 text-center border border-dashed rounded-3xl border-border/40">
                            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No posts for this filter.</p>
                        </div>
                    )}
                </div>

                {/* Accounts sidebar */}
                <div className="space-y-6">
                    {(Object.entries(accountsByCategory) as [AccountCategory, SocialAccount[]][]).map(([category, accounts]) => (
                        accounts.length > 0 && (
                            <div key={category}>
                                <h3 className={cn("text-[10px] font-black uppercase tracking-widest mb-3", CATEGORY_LABELS[category].color)}>
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
            </div>
        </div>
    );
}
