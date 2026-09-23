'use client';

import React, { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import {
    ArrowLeft,
    ExternalLink,
    Clock,
    Calendar,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    RefreshCw,
    Database,
    TrendingUp,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Filter,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { getTodayJakarta, formatWIB } from '@/lib/timeUtils';
import type {
    TrackedHashtag,
    TikTokHashtagDetailSnapshot,
    TikTokPostItem,
} from '@/types/tiktokHashtags';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TikTokHashtagResultDetailPage() {
    const params = useParams<{ tag: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();

    const rawTag = params?.tag || '';
    const cleanTag = decodeURIComponent(rawTag).replace(/^#/, '').toLowerCase().trim();

    const todayJakarta = getTodayJakarta();
    const queryDate = searchParams.get('date') || todayJakarta;
    const [selectedDate, setSelectedDate] = useState<string>(queryDate);

    // Fetch snapshot and configuration
    const apiUrl = `/api/socials/tiktok/hashtags/results?tag=${encodeURIComponent(cleanTag)}&date=${selectedDate}`;
    const { data, error, isLoading, mutate } = useSWR<{
        success: boolean;
        tag: string;
        targetDate: string;
        config: TrackedHashtag | null;
        snapshot: TikTokHashtagDetailSnapshot | null;
        history: Array<{
            date: string;
            views: number;
            likes: number;
            comments: number;
            hype_score: number;
        }>;
    }>(cleanTag ? apiUrl : null, fetcher, {
        revalidateOnFocus: false,
    });

    // Scraping Execution State
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeStep, setScrapeStep] = useState<string | null>(null);

    // Video sorting and pagination state
    const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'shares' | 'date'>('views');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [filterQuery, setFilterQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(6);

    const config = data?.config;
    const snapshot = data?.snapshot;
    const history = data?.history || [];

    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        router.push(`/tiktok/hashtags/results/${cleanTag}?date=${newDate}`);
    };

    // Live Scraping Trigger
    const handleTriggerScrape = async (force: boolean = false) => {
        setIsScraping(true);
        setScrapeStep('Connecting to Apify TikTok scraper...');
        try {
            setTimeout(() => {
                setScrapeStep('Extracting public video posts and engagement...');
            }, 3000);

            setTimeout(() => {
                setScrapeStep('Analyzing audience sentiment with Gemini 3.8 Flash...');
            }, 8000);

            const res = await fetch('/api/socials/tiktok/hashtags/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: cleanTag,
                    force,
                    dryRun: false,
                }),
            });

            const result = await res.json();
            if (result.success) {
                toast.success(result.message || `Scrape completed for #${cleanTag}`);
                mutate();
            } else if (result.cooldown) {
                toast.error(result.error);
            } else {
                toast.error(result.error || 'Scrape operation failed');
            }
        } catch {
            toast.error('Network error during on-demand scrape');
        } finally {
            setIsScraping(false);
            setScrapeStep(null);
        }
    };

    // Filter and Sort Video Posts
    const filteredPosts = React.useMemo(() => {
        if (!snapshot?.posts) return [];
        let list = [...snapshot.posts];

        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase();
            list = list.filter(
                (p) =>
                    p.caption.toLowerCase().includes(q) ||
                    p.author_handle.toLowerCase().includes(q) ||
                    (p.author_name && p.author_name.toLowerCase().includes(q))
            );
        }

        list.sort((a, b) => {
            let diff = 0;
            if (sortBy === 'views') {
                diff = b.views - a.views;
            } else if (sortBy === 'likes') {
                diff = b.likes - a.likes;
            } else if (sortBy === 'comments') {
                diff = b.comments - a.comments;
            } else if (sortBy === 'shares') {
                diff = b.shares - a.shares;
            } else if (sortBy === 'date') {
                diff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
            }
            return sortDirection === 'asc' ? -diff : diff;
        });

        return list;
    }, [snapshot?.posts, filterQuery, sortBy, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + pageSize);

    const handleSortChange = (newSort: 'views' | 'likes' | 'comments' | 'shares' | 'date') => {
        if (sortBy === newSort) {
            setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortBy(newSort);
            setSortDirection('desc');
        }
        setCurrentPage(1);
    };

    const handleFilterChange = (val: string) => {
        setFilterQuery(val);
        setCurrentPage(1);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const firestoreConfigUrl = `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014'}/firestore/databases/-default-/data/~2Ftiktok_tracked_hashtags~2F${cleanTag}`;
    const firestoreSnapshotUrl = `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014'}/firestore/databases/-default-/data/~2Ftiktok_custom_pulse~2F${selectedDate}~2Fhashtags~2F${cleanTag}`;

    return (
        <div className="p-6 space-y-6 w-full">
            {/* Top Navigation Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-9 px-3 rounded-lg border-border/60 hover:bg-muted gap-2 text-xs font-semibold"
                    >
                        <Link href="/tiktok/hashtags">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Hashtag Roster
                        </Link>
                    </Button>

                    <div className="h-4 w-px bg-border/60" />

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                                #{cleanTag}
                            </h1>
                            {config?.category && (
                                <Badge variant="secondary" className="text-[10px] font-semibold capitalize">
                                    {config.category}
                                </Badge>
                            )}
                            <Badge
                                variant={config?.active ? 'default' : 'outline'}
                                className={`text-[10px] font-bold uppercase ${
                                    config?.active
                                        ? 'bg-emerald-500 hover:bg-emerald-600'
                                        : 'text-muted-foreground border-muted-foreground/40'
                                }`}
                            >
                                {config?.active ? 'Active' : 'Paused'}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs font-medium mt-0.5">
                            {config?.label || cleanTag} · Target depth: {config?.target_posts || 40} posts · {config?.cadence || 1}x/hari at {(config?.start_hour || 18).toString().padStart(2, '0')}:00 WIB
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Date Selector */}
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            max={todayJakarta}
                            className="bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none cursor-pointer"
                        />
                        <span className="text-[10px] text-muted-foreground">WIB</span>
                    </div>

                    {/* External TikTok Link */}
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-9 px-3 rounded-lg border-border/60 hover:bg-muted text-xs font-semibold gap-1.5"
                    >
                        <a
                            href={`https://www.tiktok.com/tag/${cleanTag}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span>TikTok</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                    </Button>

                    {/* Admin Firestore Deep Link */}
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-9 px-3 rounded-lg border-border/60 hover:bg-muted text-xs font-mono text-amber-500/90 gap-1.5"
                        title="View Firestore configuration"
                    >
                        <a href={firestoreConfigUrl} target="_blank" rel="noopener noreferrer">
                            <Database className="w-3 h-3" />
                            <span>Firestore</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                    </Button>

                    {/* On-Demand Scrape Live Button */}
                    <Button
                        variant="default"
                        size="sm"
                        disabled={isScraping || isLoading}
                        onClick={() => handleTriggerScrape(false)}
                        className="h-9 px-3.5 rounded-lg text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                        {isScraping ? 'Scraping Live...' : 'Scrape Live Now'}
                    </Button>
                </div>
            </div>

            {/* Multi-Stage Scraping Progress Alert */}
            {isScraping && (
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-xl flex items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-foreground">
                                Live Scraping in Progress
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                                {scrapeStep || 'Executing pipeline...'}
                            </div>
                        </div>
                    </div>
                    <div className="text-xs font-mono text-primary font-bold">
                        Estimated ~20s
                    </div>
                </div>
            )}

            {/* Cold Start / Empty State */}
            {!isLoading && !snapshot && (
                <Card className="border-border/60 bg-card rounded-xl text-center py-12 px-4 shadow-none">
                    <CardHeader className="max-w-md mx-auto space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/60">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <CardTitle className="text-lg font-bold text-foreground">
                            No Crawl Telemetry for {selectedDate}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Hashtag #{cleanTag} has not been crawled for this date window. You can trigger an on-demand scrape right now or wait for the standing 18:00 WIB daily pulse.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center gap-3 pt-2">
                        <Button
                            variant="default"
                            size="sm"
                            disabled={isScraping}
                            onClick={() => handleTriggerScrape(false)}
                            className="rounded-lg text-xs font-bold gap-2"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Trigger First Scrape Now
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDateChange(todayJakarta)}
                            className="rounded-lg text-xs font-medium"
                        >
                            Jump to Today
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Main Telemetry & Intelligence View */}
            {snapshot && (
                <>
                    {/* Execution Stamp Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground bg-muted/30 border border-border/50 px-4 py-2 rounded-lg gap-2">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                            <span>
                                Ingestion Mode: <strong className="text-foreground capitalize">{snapshot.source.replace('_', ' ')}</strong>
                            </span>
                            <span>·</span>
                            <span>
                                Captured: <strong className="text-foreground">{formatWIB(snapshot.crawled_at)}</strong>
                            </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span>Analyzed: {snapshot.total_posts} video posts</span>
                            <a
                                href={firestoreSnapshotUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-500/80 hover:text-amber-500 hover:underline flex items-center gap-1"
                            >
                                <span>Doc Payload</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        </div>
                    </div>

                    {/* KPI Metric Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardContent className="p-4 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                    <span>Total Views</span>
                                    <Eye className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="text-2xl font-bold font-mono text-foreground">
                                    {(snapshot.total_views || 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Avg ~{snapshot.total_posts > 0 ? Math.round(snapshot.total_views / snapshot.total_posts).toLocaleString() : 0} / video
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardContent className="p-4 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                    <span>Total Likes</span>
                                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                                </div>
                                <div className="text-2xl font-bold font-mono text-foreground">
                                    {(snapshot.total_likes || 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {snapshot.total_views > 0
                                        ? ((snapshot.total_likes / snapshot.total_views) * 100).toFixed(2)
                                        : 0}% like ratio
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardContent className="p-4 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                    <span>Total Comments</span>
                                    <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                <div className="text-2xl font-bold font-mono text-foreground">
                                    {(snapshot.total_comments || 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Discussion volume
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardContent className="p-4 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                    <span>Total Shares</span>
                                    <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <div className="text-2xl font-bold font-mono text-foreground">
                                    {(snapshot.total_shares || 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Viral transmission rate
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card rounded-xl shadow-none col-span-2 md:col-span-1">
                            <CardContent className="p-4 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                    <span>Hype Score</span>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                </div>
                                <div className="text-2xl font-bold font-mono text-foreground flex items-baseline gap-1.5">
                                    <span>{snapshot.sentiment?.hype_score ?? 80}</span>
                                    <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                                </div>
                                <div className="text-[10px] font-semibold text-emerald-500">
                                    {snapshot.sentiment?.positive ?? 75}% positive buzz
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI Sentiment Radar & Analysis */}
                    {snapshot.sentiment && (
                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardHeader className="pb-3 border-b border-border/40">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            Gemini 3.8 Flash Audience Sentiment Analysis
                                        </CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground">
                                            Extracted directly from top viral comment threads and discussion velocity
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                                        AI Pulse
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {/* Segmented Progress Bar */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-mono font-semibold">
                                        <span className="text-emerald-500">
                                            Positive: {snapshot.sentiment.positive}%
                                        </span>
                                        <span className="text-amber-500">
                                            Mixed: {snapshot.sentiment.mixed}%
                                        </span>
                                        <span className="text-rose-500">
                                            Negative: {snapshot.sentiment.negative}%
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden flex">
                                        <div
                                            style={{ width: `${snapshot.sentiment.positive}%` }}
                                            className="bg-emerald-500 h-full"
                                            title={`Positive: ${snapshot.sentiment.positive}%`}
                                        />
                                        <div
                                            style={{ width: `${snapshot.sentiment.mixed}%` }}
                                            className="bg-amber-500 h-full"
                                            title={`Mixed: ${snapshot.sentiment.mixed}%`}
                                        />
                                        <div
                                            style={{ width: `${snapshot.sentiment.negative}%` }}
                                            className="bg-rose-500 h-full"
                                            title={`Negative: ${snapshot.sentiment.negative}%`}
                                        />
                                    </div>
                                </div>

                                {/* Dual-Column Insights Deck */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Audience Praise Highlights</span>
                                        </div>
                                        <ul className="space-y-1 text-xs text-foreground/90">
                                            {(snapshot.sentiment.praise_points || [
                                                'Viral traction and solid brand association in TikTok comments',
                                            ]).map((point, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <span className="text-emerald-500 font-bold">·</span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span>Criticism &amp; Concern Themes</span>
                                        </div>
                                        <ul className="space-y-1 text-xs text-foreground/90">
                                            {(snapshot.sentiment.criticism_themes && snapshot.sentiment.criticism_themes.length > 0
                                                ? snapshot.sentiment.criticism_themes
                                                : ['Tidak ditemukan anomali atau sentimen penolakan mayoritas.']
                                            ).map((point, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <span className="text-amber-500 font-bold">·</span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Historical Velocity Mini-Table */}
                    {history.length > 1 && (
                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardHeader className="pb-3 border-b border-border/40">
                                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    7-Day Historical Trajectory
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="border-b border-border/40 text-muted-foreground text-[11px]">
                                                <th className="py-2 px-3 font-semibold">Date (WIB)</th>
                                                <th className="py-2 px-3 font-semibold">Total Views</th>
                                                <th className="py-2 px-3 font-semibold">Total Likes</th>
                                                <th className="py-2 px-3 font-semibold">Comments</th>
                                                <th className="py-2 px-3 font-semibold">Hype Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20 font-mono">
                                            {history.map((h) => (
                                                <tr
                                                    key={h.date}
                                                    onClick={() => handleDateChange(h.date)}
                                                    className={`hover:bg-muted/20 cursor-pointer transition-colors ${
                                                        h.date === selectedDate ? 'bg-muted/40 font-bold' : ''
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 text-foreground">{h.date}</td>
                                                    <td className="py-2 px-3">{h.views.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-rose-500">{h.likes.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-blue-500">{h.comments.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-emerald-500">{h.hype_score} / 100</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Viral Video Leaderboard */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <span>Top Viral Videos</span>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {filteredPosts.length} posts
                                    </Badge>
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Ranked by TikTok play count and user engagement
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Search Filter */}
                                <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60 text-xs">
                                    <Filter className="w-3 h-3 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Filter creator or caption..."
                                        value={filterQuery}
                                        onChange={(e) => handleFilterChange(e.target.value)}
                                        className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-40 sm:w-48"
                                    />
                                </div>

                                {/* Multi-Dimension Sorting Buttons */}
                                <div className="flex items-center bg-muted/40 rounded-lg border border-border/60 p-0.5 text-xs font-semibold">
                                    {(['views', 'likes', 'comments', 'shares', 'date'] as const).map((key) => {
                                        const isActive = sortBy === key;
                                        const labelMap = {
                                            views: 'Views',
                                            likes: 'Likes',
                                            comments: 'Comments',
                                            shares: 'Shares',
                                            date: 'Date',
                                        };
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleSortChange(key)}
                                                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                                                    isActive
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                                title={`Sort by ${labelMap[key]} (${isActive && sortDirection === 'asc' ? 'ascending' : 'descending'})`}
                                            >
                                                <span>{labelMap[key]}</span>
                                                {isActive && (
                                                    <span className="font-mono text-[10px] text-primary">
                                                        {sortDirection === 'desc' ? '↓' : '↑'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Page Size Selector */}
                                <div className="flex items-center gap-1 bg-muted/40 rounded-lg border border-border/60 p-0.5 text-[11px] font-semibold">
                                    <span className="text-muted-foreground px-1.5 text-[10px] font-mono">Per page:</span>
                                    {[6, 12, 24].map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => handlePageSizeChange(size)}
                                            className={`px-2 py-0.5 rounded-md transition-colors font-mono ${
                                                pageSize === size
                                                    ? 'bg-background text-foreground shadow-sm font-bold'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Video Posts Grid */}
                        {filteredPosts.length === 0 ? (
                            <Card className="border-border/60 bg-card rounded-xl p-8 text-center text-xs text-muted-foreground shadow-none">
                                No video posts found matching the active filter.
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {paginatedPosts.map((post, idx) => (
                                    <Card
                                        key={post.id || idx}
                                        className="border-border/60 bg-card rounded-xl shadow-none hover:border-border transition-all flex flex-col justify-between"
                                    >
                                        <CardHeader className="p-4 pb-2 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="font-bold text-foreground truncate">
                                                        {post.author_handle}
                                                    </span>
                                                    {post.author_name && (
                                                        <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                                                            ({post.author_name})
                                                        </span>
                                                    )}
                                                </div>
                                                <a
                                                    href={post.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                                    title="Open video on TikTok"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                            <p className="text-xs text-foreground/90 line-clamp-3 leading-relaxed">
                                                {post.caption}
                                            </p>
                                        </CardHeader>

                                        <CardContent className="p-4 pt-2 space-y-3">
                                            {/* Metrics Row */}
                                            <div className="grid grid-cols-4 gap-1 py-2 px-2.5 bg-muted/40 rounded-lg border border-border/40 text-center font-mono text-[11px]">
                                                <div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                        <Eye className="w-2.5 h-2.5 text-primary" />
                                                        <span>Views</span>
                                                    </div>
                                                    <div className="font-bold text-foreground">
                                                        {post.views >= 1000
                                                            ? `${(post.views / 1000).toFixed(1)}k`
                                                            : post.views}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                        <Heart className="w-2.5 h-2.5 text-rose-500" />
                                                        <span>Likes</span>
                                                    </div>
                                                    <div className="font-bold text-rose-500">
                                                        {post.likes >= 1000
                                                            ? `${(post.likes / 1000).toFixed(1)}k`
                                                            : post.likes}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                        <MessageCircle className="w-2.5 h-2.5 text-blue-500" />
                                                        <span>Comments</span>
                                                    </div>
                                                    <div className="font-bold text-blue-500">
                                                        {post.comments}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                        <Share2 className="w-2.5 h-2.5 text-emerald-500" />
                                                        <span>Shares</span>
                                                    </div>
                                                    <div className="font-bold text-emerald-500">
                                                        {post.shares}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Published timestamp */}
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatWIB(post.published_at)}
                                                </span>
                                                <a
                                                    href={post.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-semibold text-primary hover:underline"
                                                >
                                                    Watch on TikTok →
                                                </a>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Pagination Bar */}
                        {filteredPosts.length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
                                <div className="text-xs text-muted-foreground font-mono">
                                    Showing <strong className="text-foreground">{startIndex + 1}</strong>–<strong className="text-foreground">{Math.min(startIndex + pageSize, filteredPosts.length)}</strong> of <strong className="text-foreground">{filteredPosts.length}</strong> videos
                                    {filteredPosts.length !== snapshot.posts.length && ` (filtered from ${snapshot.posts.length})`}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safeCurrentPage === 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="h-8 px-2.5 text-xs font-semibold rounded-lg border-border/60 hover:bg-muted gap-1"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Prev</span>
                                    </Button>

                                    {/* Page number buttons */}
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                                            if (
                                                totalPages <= 7 ||
                                                pageNum === 1 ||
                                                pageNum === totalPages ||
                                                Math.abs(pageNum - safeCurrentPage) <= 1
                                            ) {
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={safeCurrentPage === pageNum ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`h-8 w-8 p-0 text-xs font-mono font-bold rounded-lg ${
                                                            safeCurrentPage === pageNum
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            }
                                            if (
                                                (pageNum === 2 && safeCurrentPage > 3) ||
                                                (pageNum === totalPages - 1 && safeCurrentPage < totalPages - 2)
                                            ) {
                                                return (
                                                    <span key={pageNum} className="text-muted-foreground px-1 text-xs font-mono">
                                                        …
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safeCurrentPage === totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="h-8 px-2.5 text-xs font-semibold rounded-lg border-border/60 hover:bg-muted gap-1"
                                    >
                                        <span>Next</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
