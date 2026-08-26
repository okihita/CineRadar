'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Building2,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    ExternalLink,
    Clock,
    RefreshCw,
    Film,
    Sparkles,
} from 'lucide-react';
import { fetcher } from '@/lib/api';

interface CircuitPost {
    id: string;
    url: string;
    author: string;
    caption: string;
    hashtags: string[];
    views: number;
    likes: number;
    comments: number;
    shares: number;
    published_at: string;
}

interface ChainGroup {
    name: string;
    handle: string;
    posts: CircuitPost[];
}

interface CircuitTimelineResponse {
    success: boolean;
    data?: {
        date: string;
        crawled_at: string;
        total_posts: number;
        chains: {
            cinema_21: ChainGroup;
            cgv_id: ChainGroup;
            cinepolis_id: ChainGroup;
            studios: ChainGroup;
        };
    };
}

export default function TikTokChainMonitoringPage() {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate] = useState<string>(today);
    const [selectedChain, setSelectedChain] = useState<'all' | 'cinema_21' | 'cgv_id' | 'cinepolis_id' | 'studios'>('all');

    const { data: timelineResponse, isLoading, mutate } = useSWR<CircuitTimelineResponse>(
        `/api/socials/tiktok/chains?date=${selectedDate}`,
        fetcher,
        { revalidateOnFocus: false }
    );

    const timeline = timelineResponse?.data;
    const chains = timeline?.chains;

    const allPosts: CircuitPost[] = useMemo(() => {
        if (!chains) return [];
        if (selectedChain !== 'all') {
            return chains[selectedChain]?.posts || [];
        }
        return [
            ...(chains.cinema_21?.posts || []),
            ...(chains.cgv_id?.posts || []),
            ...(chains.cinepolis_id?.posts || []),
            ...(chains.studios?.posts || []),
        ].sort((a, b) => b.views - a.views);
    }, [chains, selectedChain]);

    const totalViews = useMemo(() => {
        return allPosts.reduce((acc, p) => acc + (p.views || 0), 0);
    }, [allPosts]);

    const totalLikes = useMemo(() => {
        return allPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
    }, [allPosts]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Top Navigation & Header */}
            <div>
                <Link
                    href="/tiktok/explorer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to TikTok Radar Explorer
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <PageHeader
                        title="Cinema Chain Promotion Monitoring"
                        subtitle="Real-time promotional timeline & social intelligence across Cinema XXI, CGV, and Cinépolis TikTok channels."
                    />

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => mutate()}
                            disabled={isLoading}
                            className="gap-1.5 text-sm font-semibold h-8 px-3 rounded-lg border-border/60"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh Feed
                        </Button>
                    </div>
                </div>
            </div>

            {/* Circuit Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Cinema XXI */}
                <Card
                    onClick={() => setSelectedChain(selectedChain === 'cinema_21' ? 'all' : 'cinema_21')}
                    className={`cursor-pointer transition-all border p-4 space-y-2 ${
                        selectedChain === 'cinema_21' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/60 bg-card hover:bg-muted/10'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-amber-500" />
                            Cinema XXI
                        </span>
                        <Badge variant="outline" className="text-sm font-mono">
                            @cinema.21
                        </Badge>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                        <div>
                            <span className="text-2xl font-black font-mono text-foreground">
                                {chains?.cinema_21?.posts?.length || 0}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1.5">active promos</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {((chains?.cinema_21?.posts?.reduce((s, p) => s + p.views, 0) || 0) / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </Card>

                {/* CGV Cinemas */}
                <Card
                    onClick={() => setSelectedChain(selectedChain === 'cgv_id' ? 'all' : 'cgv_id')}
                    className={`cursor-pointer transition-all border p-4 space-y-2 ${
                        selectedChain === 'cgv_id' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/60 bg-card hover:bg-muted/10'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-rose-500" />
                            CGV Cinemas
                        </span>
                        <Badge variant="outline" className="text-sm font-mono">
                            @cgv.id
                        </Badge>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                        <div>
                            <span className="text-2xl font-black font-mono text-foreground">
                                {chains?.cgv_id?.posts?.length || 0}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1.5">active promos</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {((chains?.cgv_id?.posts?.reduce((s, p) => s + p.views, 0) || 0) / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </Card>

                {/* Cinépolis */}
                <Card
                    onClick={() => setSelectedChain(selectedChain === 'cinepolis_id' ? 'all' : 'cinepolis_id')}
                    className={`cursor-pointer transition-all border p-4 space-y-2 ${
                        selectedChain === 'cinepolis_id' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/60 bg-card hover:bg-muted/10'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-blue-500" />
                            Cinépolis
                        </span>
                        <Badge variant="outline" className="text-sm font-mono">
                            @cinepolisid
                        </Badge>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                        <div>
                            <span className="text-2xl font-black font-mono text-foreground">
                                {chains?.cinepolis_id?.posts?.length || 0}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1.5">active promos</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {((chains?.cinepolis_id?.posts?.reduce((s, p) => s + p.views, 0) || 0) / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </Card>

                {/* Production Studios & Combined Engagement */}
                <Card className="border border-border/60 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            Total Circuit Reach
                        </span>
                        <Badge variant="outline" className="text-sm bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                            Live 08:00 WIB
                        </Badge>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                        <div>
                            <span className="text-2xl font-black font-mono text-foreground">
                                {(totalViews / 1000000).toFixed(1)}M
                            </span>
                            <span className="text-sm text-muted-foreground ml-1.5">total impressions</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-rose-500" />
                            {(totalLikes / 1000).toFixed(0)}K
                        </span>
                    </div>
                </Card>
            </div>

            {/* Filter Tabs & Content Feed */}
            <Card className="border-border/60 bg-card overflow-hidden">
                <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Film className="w-4 h-4 text-primary" />
                            Exhibitor Promotional Timeline ({allPosts.length} Videos)
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                            Inspecting recent video captions, audio tags, and campaign hashtags used by theatrical circuits.
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                        {(['all', 'cinema_21', 'cgv_id', 'cinepolis_id'] as const).map((chainKey) => (
                            <button
                                key={chainKey}
                                onClick={() => setSelectedChain(chainKey)}
                                className={`px-2.5 py-1 text-sm font-semibold rounded-md transition-all ${
                                    selectedChain === chainKey
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {chainKey === 'all' ? 'All Circuits' : chainKey === 'cinema_21' ? 'XXI' : chainKey === 'cgv_id' ? 'CGV' : 'Cinépolis'}
                            </button>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {allPosts.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                            <Clock className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
                            <p className="text-sm font-bold text-foreground">No Circuit Posts Recorded Yet</p>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                The morning 08:00 WIB discovery scan will populate the complete promotional timeline for {selectedDate}.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {allPosts.map((post) => (
                                <div
                                    key={`circuit-post-${post.id}`}
                                    className="p-4 rounded-xl border border-border/40 bg-muted/10 flex flex-col justify-between space-y-3 hover:border-border/80 transition-colors"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-foreground">
                                                {post.author}
                                            </span>
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                                            >
                                                Open on TikTok
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                            {post.caption || 'No caption text'}
                                        </p>
                                    </div>

                                    <div className="space-y-2.5 pt-2 border-t border-border/30">
                                        {/* Hashtags */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {post.hashtags.map((tag) => (
                                                <a
                                                    key={tag}
                                                    href={`https://www.tiktok.com/tag/${tag}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-sm font-mono font-medium bg-primary/5 hover:bg-primary/15 text-primary border border-primary/20 rounded px-1.5 py-0.5 transition-colors"
                                                >
                                                    #{tag}
                                                </a>
                                            ))}
                                        </div>

                                        {/* Metrics */}
                                        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground pt-1">
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-3.5 h-3.5" />
                                                {(post.views || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Heart className="w-3.5 h-3.5" />
                                                {(post.likes || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                {(post.comments || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Share2 className="w-3.5 h-3.5" />
                                                {(post.shares || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
