'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import {
    Play, Eye, Heart, MessageSquare, Share2, ExternalLink,
    Search, Calendar, ChevronLeft, ChevronRight,
    Sparkles, Film, ThumbsUp, Activity, Copy, Check, FileCode,
    TrendingUp, ShieldCheck, CalendarX2, AlertCircle, ArrowRight,
    Trophy, Zap, AlertTriangle, Flame, PieChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { TikTokIcon } from '@/components/BrandIcons';
import { getDailyTikTokData, MULTI_DAY_TIKTOK_DATA, type DailyTikTokData } from '@/data/mockTikTokSlate';

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
                insight: `${sovPct}% of cinema views (${(sovLeader.dailyViews / 1000000).toFixed(1)}M impressions)`,
            },
            womWinner: {
                title: womWinner.title,
                hashtag: womWinner.hashtag,
                positivePct: womWinner.positivePct,
                topPraise: womWinner.topPraise,
                insight: `${womWinner.positivePct}% Positive sentiment • ${womWinner.topPraise}`,
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

    // Merge live scraped posts (if Harusnya Horror) with day-specific posts
    const allPosts = useMemo(() => {
        if (!dayData) return [];
        const realHarusnyaPosts = (liveDataset?.data?.posts || []).map((p: any) => ({
            id: p.id,
            movieTitle: 'HARUSNYA HORROR',
            hashtag: '#harusnyahorror',
            title: p.title,
            text: p.text,
            url: p.url,
            published_at: p.published_at,
            source_name: p.source_name,
            source_handle: p.source_handle,
            source_avatar: p.source_avatar,
            thumbnail: p.thumbnail,
            metrics: p.metrics,
            sentiment: (p.metrics.likes > 20000 ? 'positive' : 'mixed') as 'positive' | 'mixed',
            tiktok_sound: p.platform_data?.tiktok_sound,
        }));

        // Merge without duplicating IDs
        const existingIds = new Set(realHarusnyaPosts.map((p: any) => p.id));
        const combined = [...realHarusnyaPosts];

        for (const post of dayData.posts) {
            if (!existingIds.has(post.id)) {
                combined.push(post as any);
            }
        }

        return combined;
    }, [liveDataset, dayData]);

    // Filtered posts
    const filteredPosts = useMemo(() => {
        return allPosts.filter((p: any) => {
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
            executiveSummary: dayData.executiveSummary,
            slateSentiment: dayData.slate,
            topPosts: filteredPosts,
            sampleComments: filteredComments,
        };
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const pastDateOptions = ['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26'];

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header & Date Navigation Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <div className="p-2.5 bg-black text-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-md">
                            <TikTokIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">TikTok Radar</h1>
                            <p className="text-muted-foreground text-sm font-medium">
                                Daily audience sentiment, viral momentum, and box office buzz across active cinema releases
                            </p>
                        </div>
                    </div>
                </div>

                {/* Date Navigator Bar with Quick History Pills */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/50">
                        {pastDateOptions.map((dateStr) => {
                            const isCurrent = selectedDate === dateStr;
                            const label =
                                dateStr === '2026-08-26'
                                    ? 'Aug 26 (Today)'
                                    : dateStr === '2026-08-25'
                                    ? 'Aug 25 (Sun)'
                                    : dateStr === '2026-08-24'
                                    ? 'Aug 24 (Sat)'
                                    : 'Aug 23 (Fri)';
                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        isCurrent
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/50">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevDay}
                            className="h-7 w-7 rounded-xl"
                            title="Previous Day"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center gap-1.5 px-2 font-mono text-xs font-bold text-foreground">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-0 font-bold focus:outline-none cursor-pointer text-foreground text-xs"
                            />
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextDay}
                            className="h-7 w-7 rounded-xl"
                            title="Next Day"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* If no data exists for selected date, show honest empty state */}
            {!dayData || !actionableInsights ? (
                <Card className="border-border/60 bg-muted/20 text-center py-16 px-6">
                    <CardContent className="max-w-md mx-auto space-y-5">
                        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                            <CalendarX2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-foreground">
                                No Crawler Data Recorded for {selectedDate}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                Automated TikTok scraping and audience comment harvesting were not active on this date. Pilot crawl recordings started on <strong className="text-foreground">August 23, 2026</strong>.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                            <Button
                                onClick={() => setSelectedDate('2026-08-26')}
                                className="w-full sm:w-auto rounded-xl text-xs font-bold gap-1.5"
                            >
                                View Today (Aug 26)
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setSelectedDate('2026-08-23')}
                                className="w-full sm:w-auto rounded-xl text-xs font-medium"
                            >
                                View First Pilot Day (Aug 23)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* 4 Actionable Cinema Intelligence Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card 1: Share of Voice (SOV) Leader */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.sovLeader.title)}
                            className="bg-muted/30 hover:bg-muted/50 border-border/50 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Share of Voice (SOV) Leader
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </CardDescription>
                                <CardTitle className="text-xl font-black text-amber-500 truncate pt-0.5">
                                    {actionableInsights.sovLeader.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1 space-y-1">
                                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-500 bg-amber-500/10">
                                    {actionableInsights.sovLeader.sharePct}% Market Attention
                                </Badge>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.sovLeader.insight}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 2: Organic Word-of-Mouth Winner */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.womWinner.title)}
                            className="bg-muted/30 hover:bg-muted/50 border-border/50 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Top Organic WoM Conversion
                                    <ThumbsUp className="w-4 h-4 text-emerald-500" />
                                </CardDescription>
                                <CardTitle className="text-xl font-black text-emerald-500 truncate pt-0.5">
                                    {actionableInsights.womWinner.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1 space-y-1">
                                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                                    {actionableInsights.womWinner.positivePct}% Positive Praise
                                </Badge>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.womWinner.topPraise}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 3: Breakout Virality Velocity */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.viralityLeader.title)}
                            className="bg-muted/30 hover:bg-muted/50 border-border/50 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Top Virality Velocity
                                    <Zap className="w-4 h-4 text-cyan-500" />
                                </CardDescription>
                                <CardTitle className="text-xl font-black text-cyan-500 truncate pt-0.5">
                                    {actionableInsights.viralityLeader.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1 space-y-1">
                                <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/30 text-cyan-500 bg-cyan-500/10">
                                    {actionableInsights.viralityLeader.shareRate}% Forward Rate
                                </Badge>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.viralityLeader.shares.toLocaleString()} clip shares on trending sounds
                                </p>
                            </CardContent>
                        </Card>

                        {/* Card 4: Audience Friction Alert */}
                        <Card
                            onClick={() => setSelectedMovieFilter(actionableInsights.frictionTarget.title)}
                            className="bg-muted/30 hover:bg-muted/50 border-border/50 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                            <CardHeader className="p-4 pb-1">
                                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                    Critical Friction Alert
                                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                                </CardDescription>
                                <CardTitle className="text-xl font-black text-rose-500 truncate pt-0.5">
                                    {actionableInsights.frictionTarget.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1 space-y-1">
                                <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-500 bg-rose-500/10">
                                    {actionableInsights.frictionTarget.frictionPct}% Mixed/Friction
                                </Badge>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {actionableInsights.frictionTarget.topComplaint}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Daily AI Executive Summary Briefing */}
                    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
                        <CardHeader className="p-5 pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">
                                        Gemini Market Intelligence Briefing — {dayData.dayLabel}
                                    </CardTitle>
                                </div>
                                <Badge variant="outline" className="text-[10px] uppercase font-mono text-primary border-primary/20">
                                    AI Synthesis
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 pt-0">
                            <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                                {dayData.executiveSummary}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Movie Slate Sentiment & Virality Leaderboard */}
                    <Card className="border-border/60 bg-card overflow-hidden">
                        <CardHeader className="p-6 pb-3 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    Daily Movie Slate Sentiment & Virality Leaderboard ({selectedDate})
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Calculated campaign hashtags and audience sentiment distribution. Click a row to filter feeds.
                                </CardDescription>
                            </div>

                            {selectedMovieFilter !== 'all' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedMovieFilter('all')}
                                    className="rounded-xl text-xs text-primary font-bold"
                                >
                                    Reset Filter (Show All Movies)
                                </Button>
                            )}
                        </CardHeader>

                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground uppercase text-[10px] font-bold">
                                            <th className="p-4">Movie & Calculated Tag</th>
                                            <th className="p-4">24h Views</th>
                                            <th className="p-4">Virality Score</th>
                                            <th className="p-4 w-56">Sentiment Split</th>
                                            <th className="p-4">Top Audience Praise</th>
                                            <th className="p-4">Top Complaint / Friction</th>
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
                                                        isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/30'
                                                    }`}
                                                >
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <Film className="w-4 h-4 text-primary flex-shrink-0" />
                                                            <div>
                                                                <span className="font-bold text-sm text-foreground block">{movie.title}</span>
                                                                <span className="font-mono text-[11px] text-muted-foreground">{movie.hashtag} • {movie.distributor}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="p-4 font-mono font-bold text-foreground">
                                                        {movie.dailyViews.toLocaleString()}
                                                    </td>

                                                    <td className="p-4">
                                                        <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                                                            {movie.viralityScore}
                                                        </Badge>
                                                    </td>

                                                    {/* Sentiment Progress Bar */}
                                                    <td className="p-4">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                                                <span className="text-emerald-500 font-bold">{movie.positivePct}% Pos</span>
                                                                <span className="text-amber-500">{movie.mixedPct}% Mix</span>
                                                                <span className="text-rose-500">{movie.negativePct}% Neg</span>
                                                            </div>
                                                            <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                                                                <div style={{ width: `${movie.positivePct}%` }} className="bg-emerald-500 h-full" />
                                                                <div style={{ width: `${movie.mixedPct}%` }} className="bg-amber-500 h-full" />
                                                                <div style={{ width: `${movie.negativePct}%` }} className="bg-rose-500 h-full" />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="p-4 text-foreground/90">
                                                        <Badge variant="secondary" className="text-[11px] font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                                            {movie.topPraise}
                                                        </Badge>
                                                    </td>

                                                    <td className="p-4 text-muted-foreground">
                                                        <Badge variant="secondary" className="text-[11px] font-normal bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
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
                    <Tabs defaultValue="videos" className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <TabsList className="bg-muted/50 p-1 rounded-xl">
                                <TabsTrigger value="videos" className="gap-2 rounded-lg text-xs font-bold uppercase">
                                    <Play className="w-3.5 h-3.5" />
                                    Viral Videos ({filteredPosts.length})
                                </TabsTrigger>
                                <TabsTrigger value="comments" className="gap-2 rounded-lg text-xs font-bold uppercase">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Audience Comments Stream ({filteredComments.length})
                                </TabsTrigger>
                                <TabsTrigger value="raw" className="gap-2 rounded-lg text-xs font-bold uppercase">
                                    <FileCode className="w-3.5 h-3.5" />
                                    Daily Raw JSON
                                </TabsTrigger>
                            </TabsList>

                            {/* Movie Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                                <button
                                    onClick={() => setSelectedMovieFilter('all')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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
                                        className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
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
                        <TabsContent value="videos" className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search in captions or creators..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 rounded-xl bg-muted/20"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">
                                    Showing {filteredPosts.length} videos for {selectedDate}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPosts.map((post: any) => (
                                    <Card key={post.id} className="overflow-hidden bg-card/60 hover:bg-card border-border/50 transition-all flex flex-col justify-between group shadow-sm">
                                        <div>
                                            {/* Creator & Movie Tag Header */}
                                            <div className="p-4 pb-3 flex items-center justify-between gap-3 border-b border-border/30">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {post.source_avatar ? (
                                                        <Image
                                                            src={post.source_avatar}
                                                            alt={post.source_name}
                                                            width={36}
                                                            height={36}
                                                            className="w-9 h-9 rounded-full object-cover border border-border/40 flex-shrink-0"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0">
                                                            {post.source_name ? post.source_name.charAt(0) : 'T'}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold truncate leading-tight">{post.source_name}</h4>
                                                        <p className="text-xs text-muted-foreground truncate">{post.source_handle}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary">
                                                    {post.movieTitle}
                                                </Badge>
                                            </div>

                                            {/* Thumbnail Preview */}
                                            {post.thumbnail && (
                                                <div className="relative w-full h-48 bg-muted/40 overflow-hidden">
                                                    <Image
                                                        src={post.thumbnail}
                                                        alt={post.title}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        unoptimized
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                                                        <div className="flex items-center gap-4 text-white text-xs font-semibold">
                                                            <span className="flex items-center gap-1">
                                                                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                                                {(post.metrics?.views || 0).toLocaleString()}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                                                                {(post.metrics?.likes || 0).toLocaleString()}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                                                                {(post.metrics?.comments || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Caption */}
                                            <div className="p-4 space-y-2.5">
                                                <p className="text-sm line-clamp-3 leading-relaxed text-foreground/90 whitespace-pre-line">
                                                    {post.text}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer Link */}
                                        <div className="p-4 pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>{new Date(post.published_at).toLocaleDateString()}</span>
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-primary hover:underline flex items-center gap-1"
                                            >
                                                Watch on TikTok
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* TAB 2: AUDIENCE COMMENTS STREAM */}
                        <TabsContent value="comments" className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search in comments or topics (e.g. ending, baper, jump scare)..."
                                        value={commentSearch}
                                        onChange={(e) => setCommentSearch(e.target.value)}
                                        className="pl-9 rounded-xl bg-muted/20"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">
                                    {filteredComments.length} comments displayed for {selectedDate}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredComments.map((comment) => (
                                    <Card key={comment.id} className="bg-card/50 hover:bg-card border-border/40 p-4 transition-all space-y-2.5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-foreground">
                                                    @{comment.authorName}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] font-mono">
                                                    {comment.movieTitle}
                                                </Badge>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] ${
                                                    comment.sentiment === 'positive'
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                }`}
                                            >
                                                {comment.topic}
                                            </Badge>
                                        </div>

                                        <p className="text-sm text-foreground/90 leading-snug">
                                            "{comment.text}"
                                        </p>

                                        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/20">
                                            <span className="flex items-center gap-1 font-semibold text-rose-500">
                                                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                                                {comment.diggCount} likes
                                            </span>
                                            <span>Mined from Top Video</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* TAB 3: RAW JSON INSPECTOR */}
                        <TabsContent value="raw" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                    Full aggregated daily multi-movie dataset for <strong className="text-foreground">{selectedDate}</strong>
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyJson}
                                    className="rounded-xl gap-2 text-xs font-medium"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied' : 'Copy JSON'}
                                </Button>
                            </div>

                            <div className="bg-zinc-950 text-zinc-200 p-4 rounded-2xl border border-border/40 overflow-x-auto max-h-[600px] font-mono text-xs leading-relaxed">
                                <pre>{JSON.stringify({
                                    date: selectedDate,
                                    dayLabel: dayData.dayLabel,
                                    actionableInsights,
                                    executiveSummary: dayData.executiveSummary,
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
