'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import {
    Play, Eye, Heart, MessageSquare, ExternalLink,
    Search, Calendar, ChevronLeft, ChevronRight,
    Film, ThumbsUp, Activity, Copy, Check, FileCode,
    CalendarX2, ArrowRight,
    Trophy, Zap, AlertTriangle, Sun, Moon, Clock, User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { TikTokIcon } from '@/components/BrandIcons';
import { getDailyTikTokData, type DailyTikTokData } from '@/data/mockTikTokSlate';

interface PostMetrics {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
}

interface ExplorerPost {
    id: string;
    movieTitle: string;
    hashtag: string;
    title: string;
    text: string;
    url: string;
    published_at: string;
    source_name: string;
    source_handle: string;
    source_avatar: string;
    thumbnail: string;
    metrics?: PostMetrics;
    sentiment: 'positive' | 'mixed' | 'negative';
    tiktok_sound?: string;
    platform_data?: {
        tiktok_sound?: string;
        campaign_hashtag?: string;
    };
}

export default function TikTokExplorerPage() {
    const today = getTodayJakarta();
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [selectedMovieFilter, setSelectedMovieFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [commentSearch, setCommentSearch] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);

    // Fetch real local dataset for #harusnyahorror if present
    const { data: liveDataset } = useSWR('/api/socials/tiktok?hashtag=latest', fetcher, { revalidateOnFocus: false });

    // Retrieve full day package for the active selected date
    const dayData: DailyTikTokData | null = useMemo(() => {
        return getDailyTikTokData(selectedDate);
    }, [selectedDate]);

    // Date navigation helpers
    const handlePrevDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    // Calculate daily actionable market intelligence
    const actionableInsights = useMemo(() => {
        if (!dayData?.slate || dayData.slate.length === 0) return null;

        const totalViews = dayData.slate.reduce((acc, m) => acc + m.dailyViews, 0) || 1;

        // 1. Share of Voice Leader (highest dailyViews)
        const sovLeader = [...dayData.slate].sort((a, b) => b.dailyViews - a.dailyViews)[0];
        const sovPct = ((sovLeader.dailyViews / totalViews) * 100).toFixed(1);

        // 2. Organic WoM Winner (highest positivePct)
        const womWinner = [...dayData.slate].sort((a, b) => b.positivePct - a.positivePct)[0];

        // 3. Virality Velocity Leader (highest shares-to-views ratio)
        const viralityLeader = [...dayData.slate].sort(
            (a, b) => (b.dailyShares / b.dailyViews) - (a.dailyShares / a.dailyViews)
        )[0];
        const viralityRate = ((viralityLeader.dailyShares / viralityLeader.dailyViews) * 100).toFixed(2);

        // 4. Critical Friction Alert (highest negativePct + mixedPct)
        const frictionTarget = [...dayData.slate].sort(
            (a, b) => (b.negativePct + b.mixedPct) - (a.negativePct + a.mixedPct)
        )[0];
        const frictionPct = frictionTarget.negativePct + frictionTarget.mixedPct;

        return {
            totalViews,
            sovLeader: {
                title: sovLeader.title,
                hashtag: sovLeader.hashtag,
                views: sovLeader.dailyViews,
                sharePct: sovPct,
                insight: `${sovPct}% market attention (${(sovLeader.dailyViews / 1000000).toFixed(1)}M daily impressions)`,
            },
            womWinner: {
                title: womWinner.title,
                hashtag: womWinner.hashtag,
                positivePct: womWinner.positivePct,
                topPraise: womWinner.topPraise,
                insight: `${womWinner.positivePct}% Positive rating • ${womWinner.topPraise}`,
            },
            viralityLeader: {
                title: viralityLeader.title,
                hashtag: viralityLeader.hashtag,
                shares: viralityLeader.dailyShares,
                shareRate: viralityRate,
                insight: `${viralityLeader.dailyShares.toLocaleString()} clip shares (${viralityRate}% forward rate)`,
            },
            frictionTarget: {
                title: frictionTarget.title,
                hashtag: frictionTarget.hashtag,
                frictionPct,
                topComplaint: frictionTarget.topComplaint,
                insight: `${frictionPct}% Mixed/Critical • ${frictionTarget.topComplaint}`,
            },
        };
    }, [dayData]);

    // Merge live scraped multi-slate posts with day-specific posts
    const allPosts: ExplorerPost[] = useMemo(() => {
        if (!dayData) return [];
        const rawPosts = (liveDataset?.data?.posts || []) as ExplorerPost[];
        const tagToMovie: Record<string, string> = {
            harusnyahorror: 'HARUSNYA HORROR',
            kangmak: 'KANG MAK',
            agaklaen: 'AGAK LAEN',
            kakaboss: 'KAKA BOSS',
            lembayung: 'LEMBAYUNG',
            filmlaura: 'LAURA',
            homesweetloan: 'HOME SWEET LOAN',
            filmsumala: 'SUMALA',
            filmthaghut: 'THAGHUT',
            sekawanlimo: 'SEKAWAN LIMO',
        };

        const liveMappedPosts: ExplorerPost[] = rawPosts.map((p) => {
            const rawTag = (p.platform_data?.campaign_hashtag || 'harusnyahorror').toLowerCase().replace('#', '');
            const resolvedTitle = tagToMovie[rawTag] || rawTag.toUpperCase();
            return {
                id: p.id,
                movieTitle: resolvedTitle,
                hashtag: `#${rawTag}`,
                title: p.title,
                text: p.text,
                url: p.url,
                published_at: p.published_at,
                source_name: p.source_name,
                source_handle: p.source_handle,
                source_avatar: p.source_avatar,
                thumbnail: p.thumbnail,
                metrics: p.metrics,
                sentiment: ((p.metrics?.likes || 0) > 20000 ? 'positive' : 'mixed') as 'positive' | 'mixed',
                tiktok_sound: p.platform_data?.tiktok_sound,
            };
        });

        // Merge without duplicating IDs
        const existingIds = new Set(liveMappedPosts.map((p) => p.id));
        const combined: ExplorerPost[] = [...liveMappedPosts];

        for (const post of dayData.posts) {
            if (!existingIds.has(post.id)) {
                combined.push(post as ExplorerPost);
            }
        }

        return combined;
    }, [liveDataset, dayData]);

    // Filtered posts
    const filteredPosts = useMemo(() => {
        return allPosts.filter((p) => {
            const matchesMovie =
                selectedMovieFilter === 'all' ||
                p.movieTitle.toLowerCase() === selectedMovieFilter.toLowerCase() ||
                p.id.includes(selectedMovieFilter);
            const matchesQuery =
                !searchQuery.trim() ||
                p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.source_name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesMovie && matchesQuery;
        });
    }, [allPosts, selectedMovieFilter, searchQuery]);

    // Filtered comments
    const filteredComments = useMemo(() => {
        if (!dayData) return [];
        return dayData.comments.filter((c) => {
            const matchesMovie =
                selectedMovieFilter === 'all' ||
                c.movieTitle.toLowerCase() === selectedMovieFilter.toLowerCase();
            const matchesSearch =
                !commentSearch.trim() ||
                c.text.toLowerCase().includes(commentSearch.toLowerCase()) ||
                c.topic.toLowerCase().includes(commentSearch.toLowerCase());
            return matchesMovie && matchesSearch;
        });
    }, [dayData, selectedMovieFilter, commentSearch]);

    const handleCopyJson = () => {
        if (!dayData) return;
        const payload = {
            date: selectedDate,
            dayLabel: dayData.dayLabel,
            actionableInsights,
            briefings: dayData.briefings,
            slateSentiment: dayData.slate,
            topPosts: filteredPosts,
            sampleComments: filteredComments,
        };
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formattedHeaderDate = useMemo(() => {
        return new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }, [selectedDate]);

    return (
        <div className="p-6 space-y-5">
            {/* Page Header & Date Navigation Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center border border-border/40 shrink-0">
                        <TikTokIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">TikTok Radar</h1>
                        <p className="text-sm text-muted-foreground">
                            Daily audience sentiment, viral momentum, and box office buzz across active cinema releases
                        </p>
                    </div>
                </div>

                {/* Date Navigator Toolbar */}
                <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border/50 rounded-xl self-start lg:self-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevDay}
                        className="h-8 w-8 rounded-lg hover:bg-muted"
                        title="Previous Day"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg border border-border/40 bg-background text-sm font-medium">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-0 font-medium focus:outline-none cursor-pointer text-foreground text-sm"
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextDay}
                        className="h-8 w-8 rounded-lg hover:bg-muted"
                        title="Next Day"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>

                    <Button
                        variant={selectedDate === today ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedDate(today)}
                        className="h-8 text-sm px-3 font-medium rounded-lg border-border/50"
                    >
                        Today
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            {!dayData || !actionableInsights ? (
                <Card className="border-border/60 text-center py-12 px-6">
                    <CardContent className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                            <CalendarX2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">
                                No Crawler Data for {selectedDate}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                Automated TikTok scraping and audience comment harvesting were not active on this date. Pilot crawl recordings started on August 23, 2026.
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-1">
                            <Button
                                size="sm"
                                onClick={() => setSelectedDate('2026-08-26')}
                                className="text-sm font-medium"
                            >
                                View Today (Aug 26)
                                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDate('2026-08-23')}
                                className="text-sm font-medium"
                            >
                                View Aug 23
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Section Date Anchor */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                Daily Market Signals
                            </h2>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm font-medium text-foreground">
                                {formattedHeaderDate}
                            </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            24h Crawl Window (<span className="font-mono">{selectedDate}</span>)
                        </span>
                    </div>

                    {/* 4 Actionable Intelligence Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* Card 1: Share of Voice Leader */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.sovLeader.title)}
                            className="border-border/60 hover:border-border/90 cursor-pointer transition-colors"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Share of Voice Leader
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </CardDescription>
                                <CardTitle className="text-base font-bold text-foreground truncate pt-0.5">
                                    {actionableInsights.sovLeader.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-1">
                                <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    <span className="font-mono font-bold">{actionableInsights.sovLeader.sharePct}%</span> Market Attention
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.sovLeader.insight}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 2: Organic Word-of-Mouth Winner */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.womWinner.title)}
                            className="border-border/60 hover:border-border/90 cursor-pointer transition-colors"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Top Organic WoM
                                    <ThumbsUp className="w-4 h-4 text-emerald-500" />
                                </CardDescription>
                                <CardTitle className="text-base font-bold text-foreground truncate pt-0.5">
                                    {actionableInsights.womWinner.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-1">
                                <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    <span className="font-mono font-bold">{actionableInsights.womWinner.positivePct}%</span> Positive Praise
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.womWinner.topPraise}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 3: Breakout Virality Velocity */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.viralityLeader.title)}
                            className="border-border/60 hover:border-border/90 cursor-pointer transition-colors"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Top Virality Velocity
                                    <Zap className="w-4 h-4 text-cyan-500" />
                                </CardDescription>
                                <CardTitle className="text-base font-bold text-foreground truncate pt-0.5">
                                    {actionableInsights.viralityLeader.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-1">
                                <div className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                                    <span className="font-mono font-bold">{actionableInsights.viralityLeader.shareRate}%</span> Forward Rate
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    <span className="font-mono">{actionableInsights.viralityLeader.shares.toLocaleString()}</span> shares on trending sounds
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 4: Audience Friction Alert */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.frictionTarget.title)}
                            className="border-border/60 hover:border-border/90 cursor-pointer transition-colors"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Critical Friction Alert
                                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                                </CardDescription>
                                <CardTitle className="text-base font-bold text-foreground truncate pt-0.5">
                                    {actionableInsights.frictionTarget.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-1">
                                <div className="text-sm font-medium text-rose-600 dark:text-rose-400">
                                    <span className="font-mono font-bold">{actionableInsights.frictionTarget.frictionPct}%</span> Mixed/Friction
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.frictionTarget.topComplaint}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Dual-Column Gemini Intelligence Briefings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Morning Briefing */}
                        <Card className="border-border/60 bg-card">
                            <CardHeader className="p-4 pb-2.5 border-b border-border/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                                            <Sun className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-bold text-foreground">
                                                Morning Trajectory (11:00 WIB)
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Scraped at <span className="font-mono">{dayData.briefings.morning.runTimestamp}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-sm font-medium">
                                        Pre-Showtime
                                    </Badge>
                                </div>
                                <p className="text-sm font-semibold text-foreground/90 pt-1.5 leading-snug">
                                    {dayData.briefings.morning.headline}
                                </p>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2.5">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {dayData.briefings.morning.summary}
                                </p>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-sm">
                                    <strong className="text-foreground">Takeaway:</strong> {dayData.briefings.morning.keyTakeaway}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Night Recap */}
                        <Card className="border-border/60 bg-card">
                            <CardHeader className="p-4 pb-2.5 border-b border-border/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
                                            <Moon className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-bold text-foreground">
                                                Night Box Office Recap (23:00 WIB)
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Scraped at <span className="font-mono">{dayData.briefings.night.runTimestamp}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-sm font-medium">
                                        Post-Showtimes
                                    </Badge>
                                </div>
                                <p className="text-sm font-semibold text-foreground/90 pt-1.5 leading-snug">
                                    {dayData.briefings.night.headline}
                                </p>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2.5">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {dayData.briefings.night.summary}
                                </p>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-sm">
                                    <strong className="text-foreground">Takeaway:</strong> {dayData.briefings.night.keyTakeaway}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Movie Slate Sentiment & Virality Leaderboard */}
                    <Card className="border-border/60 bg-card overflow-hidden">
                        <CardHeader className="p-4 pb-2.5 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    Daily Movie Slate Sentiment & Virality Leaderboard ({selectedDate})
                                </CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">
                                    Calculated campaign hashtags and audience sentiment distribution. Click a row to filter feeds.
                                </CardDescription>
                            </div>

                            {selectedMovieFilter !== 'all' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedMovieFilter('all')}
                                    className="text-sm text-primary font-semibold h-7 px-2.5"
                                >
                                    Reset Filter (Show All Movies)
                                </Button>
                            )}
                        </CardHeader>

                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground uppercase text-sm font-semibold tracking-wider">
                                            <th className="px-5 py-2.5">Movie & Tag</th>
                                            <th className="px-5 py-2.5">24h Views</th>
                                            <th className="px-5 py-2.5">Virality Score</th>
                                            <th className="px-5 py-2.5 w-56">Sentiment Split</th>
                                            <th className="px-5 py-2.5">Top Audience Praise</th>
                                            <th className="px-5 py-2.5">Top Complaint</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {dayData.slate.map((movie) => {
                                            const isSelected =
                                                selectedMovieFilter.toLowerCase() === movie.title.toLowerCase() ||
                                                selectedMovieFilter === movie.id;
                                            return (
                                                <tr
                                                    key={movie.id}
                                                    onClick={() => setSelectedMovieFilter(isSelected ? 'all' : movie.title)}
                                                    className={`cursor-pointer transition-colors ${
                                                        isSelected ? 'bg-primary/5 font-medium' : 'hover:bg-muted/20'
                                                    }`}
                                                >
                                                    <td className="px-5 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                                                <Film className="w-3.5 h-3.5 flex-shrink-0" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-sm text-foreground block leading-tight">{movie.title}</span>
                                                                <span className="text-sm text-muted-foreground">{movie.hashtag} • {movie.distributor}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-2.5 font-mono font-medium text-foreground">
                                                        {movie.dailyViews.toLocaleString()}
                                                    </td>

                                                    <td className="px-5 py-2.5">
                                                        <Badge variant="outline" className="text-sm font-medium">
                                                            {movie.viralityScore}
                                                        </Badge>
                                                    </td>

                                                    {/* Sentiment Progress Bar */}
                                                    <td className="px-5 py-2.5">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-sm text-muted-foreground">
                                                                <span className="text-emerald-500 font-medium"><span className="font-mono">{movie.positivePct}%</span> Pos</span>
                                                                <span className="text-amber-500 font-medium"><span className="font-mono">{movie.mixedPct}%</span> Mix</span>
                                                                <span className="text-rose-500 font-medium"><span className="font-mono">{movie.negativePct}%</span> Neg</span>
                                                            </div>
                                                            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-muted">
                                                                <div style={{ width: `${movie.positivePct}%` }} className="bg-emerald-500 h-full" />
                                                                <div style={{ width: `${movie.mixedPct}%` }} className="bg-amber-500 h-full" />
                                                                <div style={{ width: `${movie.negativePct}%` }} className="bg-rose-500 h-full" />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-2.5 text-foreground/90">
                                                        <Badge variant="secondary" className="text-sm font-normal">
                                                            {movie.topPraise}
                                                        </Badge>
                                                    </td>

                                                    <td className="px-5 py-2.5 text-muted-foreground">
                                                        <Badge variant="secondary" className="text-sm font-normal">
                                                            {movie.topComplaint}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Main Tabs Feed Section */}
                    <Tabs defaultValue="videos" className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <TabsList className="bg-muted/40 p-0.5 rounded-lg border border-border/40 h-auto">
                                <TabsTrigger value="videos" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                                    <Play className="w-3.5 h-3.5" />
                                    Viral Videos ({filteredPosts.length})
                                </TabsTrigger>
                                <TabsTrigger value="comments" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Audience Comments ({filteredComments.length})
                                </TabsTrigger>
                                <TabsTrigger value="raw" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                                    <FileCode className="w-3.5 h-3.5" />
                                    Daily Raw JSON
                                </TabsTrigger>
                            </TabsList>

                            {/* Movie Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
                                <button
                                    onClick={() => setSelectedMovieFilter('all')}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                        selectedMovieFilter === 'all'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                                    }`}
                                >
                                    All Movies
                                </button>
                                {dayData.slate.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMovieFilter(m.title)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                                            selectedMovieFilter === m.title
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {m.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* TAB 1: VIDEOS FEED */}
                        <TabsContent value="videos" className="space-y-3.5">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search in captions or creators..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-muted/20 text-sm h-8"
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    Showing <span className="font-mono font-medium">{filteredPosts.length}</span> videos for {selectedDate}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredPosts.map((post: ExplorerPost) => (
                                    <Card key={post.id} className="overflow-hidden bg-card border-border/50 flex flex-col justify-between">
                                        <div>
                                            {/* Creator Header */}
                                            <div className="p-3 pb-2 flex items-center justify-between gap-3 border-b border-border/30">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {post.source_avatar ? (
                                                        <Image
                                                            src={post.source_avatar}
                                                            alt={post.source_name}
                                                            width={28}
                                                            height={28}
                                                            className="w-7 h-7 rounded-full object-cover border border-border/40 flex-shrink-0"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                                                            {post.source_name ? post.source_name.charAt(0) : 'T'}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold truncate leading-tight">{post.source_name}</h4>
                                                        <p className="text-sm text-muted-foreground truncate">{post.source_handle}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-sm font-normal">
                                                    {post.movieTitle}
                                                </Badge>
                                            </div>

                                            {/* Thumbnail */}
                                            {post.thumbnail && (
                                                <div className="relative w-full h-44 bg-muted overflow-hidden">
                                                    <Image
                                                        src={post.thumbnail}
                                                        alt={post.title}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                                                        <div className="flex items-center gap-3.5 text-white text-sm font-medium">
                                                            <span className="flex items-center gap-1">
                                                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                                                <span className="font-mono">{(post.metrics?.views || 0).toLocaleString()}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                                                                <span className="font-mono">{(post.metrics?.likes || 0).toLocaleString()}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                                                                <span className="font-mono">{(post.metrics?.comments || 0).toLocaleString()}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Caption */}
                                            <div className="p-3 space-y-1.5">
                                                <p className="text-sm line-clamp-3 leading-relaxed text-foreground/90 whitespace-pre-line">
                                                    {post.text}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="p-3 pt-2 border-t border-border/30 flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{new Date(post.published_at).toLocaleDateString()}</span>
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-primary hover:underline flex items-center gap-1"
                                            >
                                                Watch on TikTok
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* TAB 2: AUDIENCE COMMENTS STREAM */}
                        <TabsContent value="comments" className="space-y-3.5">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search in comments or topics..."
                                        value={commentSearch}
                                        onChange={(e) => setCommentSearch(e.target.value)}
                                        className="pl-9 bg-muted/20 text-sm h-8"
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    Showing <span className="font-mono font-medium">{filteredComments.length}</span> comments for {selectedDate}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {filteredComments.map((comment) => (
                                    <Card key={comment.id} className="bg-card border-border/40 p-3.5 space-y-2.5 flex flex-col justify-between">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                        <User className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-foreground truncate">
                                                        @{comment.authorName}
                                                    </span>
                                                </div>
                                                <Badge variant="outline" className="text-sm font-normal shrink-0">
                                                    {comment.movieTitle}
                                                </Badge>
                                            </div>

                                            <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                                                &ldquo;{comment.text}&rdquo;
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground border-t border-border/20">
                                            <span className="flex items-center gap-1 text-rose-500 font-medium">
                                                <Heart className="w-3.5 h-3.5 fill-rose-500" />
                                                <span className="font-mono">{comment.diggCount}</span> likes
                                            </span>
                                            <Badge variant="secondary" className="text-sm font-normal">
                                                {comment.topic}
                                            </Badge>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* TAB 3: RAW JSON INSPECTOR */}
                        <TabsContent value="raw" className="space-y-3.5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Full aggregated daily multi-movie dataset for <strong className="text-foreground">{selectedDate}</strong>
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyJson}
                                    className="gap-2 text-sm font-medium h-8"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied' : 'Copy JSON'}
                                </Button>
                            </div>

                            <div className="bg-zinc-950 text-zinc-200 p-4 rounded-xl border border-border/40 overflow-x-auto max-h-[600px] font-mono text-sm leading-relaxed">
                                <pre>{JSON.stringify({
                                    date: selectedDate,
                                    dayLabel: dayData.dayLabel,
                                    actionableInsights,
                                    briefings: dayData.briefings,
                                    slateSentiment: dayData.slate,
                                    topPosts: filteredPosts,
                                    sampleComments: filteredComments,
                                }, null, 2)}</pre>
                            </div>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
