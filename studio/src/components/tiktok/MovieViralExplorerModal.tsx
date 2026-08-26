'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Play,
    Heart,
    MessageSquare,
    Share2,
    ExternalLink,
    Sparkles,
    TrendingUp,
    Film,
    ThumbsUp,
    AlertCircle,
} from 'lucide-react';

interface ViralPost {
    id: string;
    url: string;
    author_name: string;
    author_handle: string;
    caption: string;
    hashtags: string[];
    views: number;
    likes: number;
    comments: number;
    shares: number;
    published_at: string;
}

interface SentimentData {
    positive: number;
    mixed: number;
    negative: number;
    hype_score?: number;
    praise_points?: string[];
    criticism_themes?: string[];
}

interface MoviePulseResponse {
    success: boolean;
    data?: {
        movie_id: string;
        title: string;
        date: string;
        tier: string;
        total_posts: number;
        total_views: number;
        total_likes: number;
        total_comments: number;
        total_shares: number;
        campaign_hashtags: string[];
        sentiment?: SentimentData;
        posts: ViralPost[];
    };
}

interface Props {
    movieId: string | null;
    movieTitle: string;
    date: string;
    isOpen: boolean;
    onClose: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MovieViralExplorerModal({
    movieId,
    movieTitle,
    date,
    isOpen,
    onClose,
}: Props) {
    const [sortMode, setSortMode] = useState<'views' | 'likes' | 'comments' | 'recent'>('views');

    const { data: response, isLoading } = useSWR<MoviePulseResponse>(
        isOpen && movieId ? `/api/socials/tiktok/pulse?date=${date}&movie_id=${movieId}` : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    const pulseData = response?.data;
    const posts = pulseData?.posts || [];

    const sortedPosts = React.useMemo(() => {
        const list = [...posts];
        if (sortMode === 'views') list.sort((a, b) => (b.views || 0) - (a.views || 0));
        else if (sortMode === 'likes') list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        else if (sortMode === 'comments') list.sort((a, b) => (b.comments || 0) - (a.comments || 0));
        else if (sortMode === 'recent') {
            list.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
        }
        return list;
    }, [posts, sortMode]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl">
                {/* Header */}
                <DialogHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                                    <Film className="w-5 h-5 text-primary" />
                                    {movieTitle}
                                </DialogTitle>
                                {pulseData?.tier && (
                                    <Badge variant="secondary" className="text-xs uppercase font-bold tracking-wider">
                                        {pulseData.tier.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                            <DialogDescription className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>📅 Date: <strong className="text-foreground">{date}</strong></span>
                                <span>•</span>
                                <span>🎬 <strong className="text-foreground">{posts.length}</strong> top viral posts captured</span>
                            </DialogDescription>
                        </div>

                        {/* Quick Hashtags */}
                        {pulseData?.campaign_hashtags && pulseData.campaign_hashtags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {pulseData.campaign_hashtags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="font-mono text-xs bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Executive KPIs banner */}
                    {pulseData && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                            <div className="bg-background/80 p-2.5 rounded-lg border border-border/40 text-center">
                                <p className="text-xs text-muted-foreground font-medium">Total Viral Views</p>
                                <p className="text-base sm:text-lg font-black font-mono text-foreground">
                                    {(pulseData.total_views || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-background/80 p-2.5 rounded-lg border border-border/40 text-center">
                                <p className="text-xs text-muted-foreground font-medium">Total Likes</p>
                                <p className="text-base sm:text-lg font-black font-mono text-rose-500">
                                    {(pulseData.total_likes || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-background/80 p-2.5 rounded-lg border border-border/40 text-center">
                                <p className="text-xs text-muted-foreground font-medium">Total Comments</p>
                                <p className="text-base sm:text-lg font-black font-mono text-cyan-500">
                                    {(pulseData.total_comments || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-background/80 p-2.5 rounded-lg border border-border/40 text-center">
                                <p className="text-xs text-muted-foreground font-medium">Virality Shares</p>
                                <p className="text-base sm:text-lg font-black font-mono text-amber-500">
                                    {(pulseData.total_shares || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Gemini AI Sentiment Highlights */}
                    {pulseData?.sentiment && (
                        <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-primary">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Gemini 2.5 Flash Audience Sentiment</span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <span className="text-emerald-500 font-semibold">{pulseData.sentiment.positive}% Positive</span>
                                    <span>{pulseData.sentiment.mixed}% Mixed</span>
                                    <span className="text-rose-500">{pulseData.sentiment.negative}% Critical</span>
                                    <span>•</span>
                                    <span className="font-semibold text-foreground">Hype Score: {pulseData.sentiment.hype_score || 85}/100</span>
                                </div>
                            </div>

                            {pulseData.sentiment.praise_points && pulseData.sentiment.praise_points.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {pulseData.sentiment.praise_points.slice(0, 2).map((point, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-background/80 text-foreground border-emerald-500/30 gap-1">
                                            <ThumbsUp className="w-2.5 h-2.5 text-emerald-500" />
                                            {point}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogHeader>

                {/* Sort Bar */}
                <div className="p-3 sm:px-5 border-b border-border/30 bg-muted/10 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">Sort By:</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant={sortMode === 'views' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSortMode('views')}
                            className="h-7 text-xs font-semibold px-2.5"
                        >
                            Views
                        </Button>
                        <Button
                            variant={sortMode === 'likes' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSortMode('likes')}
                            className="h-7 text-xs font-semibold px-2.5"
                        >
                            Likes
                        </Button>
                        <Button
                            variant={sortMode === 'comments' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSortMode('comments')}
                            className="h-7 text-xs font-semibold px-2.5"
                        >
                            Comments
                        </Button>
                        <Button
                            variant={sortMode === 'recent' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSortMode('recent')}
                            className="h-7 text-xs font-semibold px-2.5"
                        >
                            Recent
                        </Button>
                    </div>
                </div>

                {/* Body / Viral Video Grid */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} className="h-32 rounded-xl" />
                            ))}
                        </div>
                    ) : sortedPosts.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                            <p className="text-sm font-semibold text-foreground">No viral posts recorded for this movie yet</p>
                            <p className="text-xs text-muted-foreground">The 18:00 WIB daily crawler monitors the top theatrical releases.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sortedPosts.map((post, idx) => (
                                <div
                                    key={post.id || idx}
                                    className="p-3.5 rounded-xl border border-border/60 bg-card hover:border-primary/50 transition-all space-y-2 flex flex-col justify-between"
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <span className="text-xs font-bold text-foreground font-mono">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-xs font-semibold text-primary truncate">
                                                    {post.author_handle || post.author_name}
                                                </span>
                                            </div>

                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 rounded bg-muted/40 hover:bg-muted transition-colors shrink-0"
                                            >
                                                <Play className="w-3 h-3 text-rose-500 fill-rose-500" />
                                                Watch
                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                            </a>
                                        </div>

                                        <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">
                                            {post.caption || 'No caption provided.'}
                                        </p>
                                    </div>

                                    {/* Metrics Footer */}
                                    <div className="pt-2 border-t border-border/20 flex items-center justify-between text-xs text-muted-foreground font-mono">
                                        <span className="flex items-center gap-1 font-bold text-foreground">
                                            <Play className="w-3 h-3 text-muted-foreground" />
                                            {(post.views || 0).toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1 text-rose-500">
                                            <Heart className="w-3 h-3 fill-rose-500" />
                                            {(post.likes || 0).toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1 text-cyan-500">
                                            <MessageSquare className="w-3 h-3" />
                                            {(post.comments || 0).toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-500">
                                            <Share2 className="w-3 h-3" />
                                            {(post.shares || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
