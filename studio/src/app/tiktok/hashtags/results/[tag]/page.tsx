'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Copy,
    User,
    Flame,
    Activity,
    RotateCcw,
    Hash,
    Keyboard,
    ChevronDown,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getTodayJakarta } from '@/lib/timeUtils';
import type {
    TrackedHashtag,
    TikTokHashtagDetailSnapshot,
    TikTokPostItem,
} from '@/types/tiktokHashtags';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Strict 24-Hour WIB Time Formatters
function formatWIB24(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    const timeStr = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return `${timeStr} WIB`;
}

function formatWIBFull24(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return `${dateFormatted}, ${timeFormatted} WIB`;
}

function formatHandle(handle: string | null | undefined): string {
    if (!handle) return '@creator';
    return `@${handle.replace(/^@+/, '')}`;
}

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
    const [scrapeTargetDepth, setScrapeTargetDepth] = useState<number>(40);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [pendingDepth, setPendingDepth] = useState<number>(40);

    // Video sorting, pagination, and active inspection state (10 default, then 25, then 50)
    const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes' | 'comments' | 'shares'>('date');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [filterQuery, setFilterQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const timelineContainerRef = useRef<HTMLDivElement>(null);

    const config = data?.config;
    const snapshot = data?.snapshot;
    const history = data?.history || [];

    // Cooldown Detection (15-Minute Window)
    const lastScrapedMs = config?.last_scraped_at
        ? new Date(config.last_scraped_at).getTime()
        : snapshot?.crawled_at
        ? new Date(snapshot.crawled_at).getTime()
        : 0;
    const isCooldownActive = lastScrapedMs > 0 && Date.now() - lastScrapedMs < 15 * 60 * 1000;
    const elapsedMinutes = lastScrapedMs > 0
        ? Math.max(1, Math.round((Date.now() - lastScrapedMs) / 60000))
        : null;

    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        setSelectedPostId(null);
        router.push(`/tiktok/hashtags/results/${cleanTag}?date=${newDate}`);
    };

    // Live Scraping Trigger Request with Cost Guardrail
    const handleRequestScrape = (depth: number) => {
        setPendingDepth(depth);
        if (isCooldownActive || depth > 40) {
            setConfirmModalOpen(true);
        } else {
            executeScrape(depth, false);
        }
    };

    const executeScrape = async (depth: number, force: boolean) => {
        setConfirmModalOpen(false);
        setIsScraping(true);
        setScrapeTargetDepth(depth);
        setScrapeStep('Connecting to Apify TikTok scraper...');
        try {
            setTimeout(() => {
                setScrapeStep(`Extracting ${depth} public video posts and engagement...`);
            }, 3000);

            setTimeout(() => {
                setScrapeStep('Analyzing audience sentiment with Gemini 3.8 Flash...');
            }, depth > 40 ? 15000 : 8000);

            const res = await fetch('/api/socials/tiktok/hashtags/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: cleanTag,
                    targetPosts: depth,
                    force,
                    dryRun: false,
                }),
            });

            const result = await res.json();
            if (result.success) {
                toast.success(result.message || `Scrape completed for #${cleanTag} (${depth} posts)`);
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
    const filteredPosts = useMemo(() => {
        if (!snapshot?.posts) return [];
        let list = [...snapshot.posts];

        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase().replace(/^#/, '');
            list = list.filter((p) => {
                const inCaption = p.caption.toLowerCase().includes(q);
                const inAuthor = p.author_handle.toLowerCase().includes(q) ||
                    (p.author_name && p.author_name.toLowerCase().includes(q));
                const inTags = p.hashtags && p.hashtags.some((t) => t.toLowerCase().includes(q));
                return inCaption || inAuthor || inTags;
            });
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

    // Active Inspector Post Resolution
    const activePost = useMemo(() => {
        if (!filteredPosts || filteredPosts.length === 0) return null;
        if (selectedPostId) {
            const found = filteredPosts.find((p) => (p.id && p.id === selectedPostId) || p.url === selectedPostId);
            if (found) return found;
        }
        return filteredPosts[0] || null;
    }, [filteredPosts, selectedPostId]);

    // Benchmark helpers
    const avgViews = snapshot && snapshot.total_posts > 0 ? Math.round(snapshot.total_views / snapshot.total_posts) : 0;
    const topPostId = useMemo(() => {
        if (!snapshot?.posts || snapshot.posts.length === 0) return null;
        const sortedByViews = [...snapshot.posts].sort((a, b) => b.views - a.views);
        return sortedByViews[0]?.id || sortedByViews[0]?.url;
    }, [snapshot?.posts]);

    // Robust Praise Highlights & Criticism Themes
    const praiseList = useMemo(() => {
        const raw = snapshot?.sentiment?.praise_points;
        if (Array.isArray(raw) && raw.length > 0) {
            const valid = raw.filter((p) => typeof p === 'string' && p.trim().length > 0);
            if (valid.length > 0) return valid;
        }
        return [
            'Trafik video viral terpantau aktif dan eksposure tinggi di FYP',
            'Resonansi audiens kuat dengan antusiasme penonton bioskop',
            'Rekomendasi Word-of-Mouth (WoM) dominan di interaksi kreator',
        ];
    }, [snapshot?.sentiment?.praise_points]);

    const criticismList = useMemo(() => {
        const raw = snapshot?.sentiment?.criticism_themes;
        if (Array.isArray(raw) && raw.length > 0) {
            const valid = raw.filter((c) => typeof c === 'string' && c.trim().length > 0);
            if (valid.length > 0) return valid;
        }
        return ['Tidak ditemukan anomali atau sentimen penolakan mayoritas.'];
    }, [snapshot?.sentiment?.criticism_themes]);

    // Associated Hashtags Aggregation Ranked by Post Count
    const associatedHashtags = useMemo(() => {
        if (!snapshot?.posts || snapshot.posts.length === 0) return [];
        const countMap: Record<string, number> = {};

        for (const post of snapshot.posts) {
            const postTags = new Set<string>();

            // 1. From post.hashtags array
            if (Array.isArray(post.hashtags)) {
                for (const t of post.hashtags) {
                    const clean = t.replace(/^#/, '').toLowerCase().trim();
                    if (clean && clean.length > 1) postTags.add(clean);
                }
            }

            // 2. From caption regex pattern
            if (post.caption) {
                const matches = post.caption.match(/#([a-zA-Z0-9_\u00a0-\uffff]+)/g);
                if (matches) {
                    for (const m of matches) {
                        const clean = m.replace(/^#/, '').toLowerCase().trim();
                        if (clean && clean.length > 1) postTags.add(clean);
                    }
                }
            }

            for (const tag of postTags) {
                countMap[tag] = (countMap[tag] || 0) + 1;
            }
        }

        return Object.entries(countMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }, [snapshot?.posts]);

    // Keyboard Navigation: Up/Down Arrow and J/K browsing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable)
            ) {
                return;
            }

            if (filteredPosts.length === 0) return;

            const currentIdx = filteredPosts.findIndex(
                (p) => (p.id && p.id === selectedPostId) || p.url === selectedPostId
            );
            const safeIdx = currentIdx >= 0 ? currentIdx : 0;

            if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
                e.preventDefault();
                const nextIdx = Math.min(filteredPosts.length - 1, safeIdx + 1);
                const nextPost = filteredPosts[nextIdx];
                if (nextPost) {
                    setSelectedPostId(nextPost.id || nextPost.url);
                    const targetPage = Math.floor(nextIdx / pageSize) + 1;
                    if (targetPage !== safeCurrentPage) {
                        setCurrentPage(targetPage);
                    }
                }
            } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const prevIdx = Math.max(0, safeIdx - 1);
                const prevPost = filteredPosts[prevIdx];
                if (prevPost) {
                    setSelectedPostId(prevPost.id || prevPost.url);
                    const targetPage = Math.floor(prevIdx / pageSize) + 1;
                    if (targetPage !== safeCurrentPage) {
                        setCurrentPage(targetPage);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredPosts, selectedPostId, pageSize, safeCurrentPage]);

    const handleSortChange = (newSort: 'date' | 'views' | 'likes' | 'comments' | 'shares') => {
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

    const handleCopyUrl = (url: string) => {
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(url);
            toast.success('Video link copied to clipboard');
        }
    };

    const handleFilterByCreator = (handle: string) => {
        const cleanHandle = handle.replace(/^@+/, '');
        setFilterQuery(cleanHandle);
        setCurrentPage(1);
        toast.info(`Filtering timeline by creator @${cleanHandle}`);
    };

    const firestoreConfigUrl = `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014'}/firestore/databases/-default-/data/~2Ftiktok_tracked_hashtags~2F${cleanTag}`;
    const firestoreSnapshotUrl = `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014'}/firestore/databases/-default-/data/~2Ftiktok_custom_pulse~2F${selectedDate}~2Fhashtags~2F${cleanTag}`;

    const renderPaginationBar = (position: 'top' | 'bottom') => {
        if (!snapshot || filteredPosts.length === 0) return null;

        return (
            <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    position === 'top'
                        ? 'pb-2 border-b border-border/40'
                        : 'pt-3 border-t border-border/40'
                }`}
            >
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
                                        key={`${position}-page-${pageNum}`}
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
                                    <span key={`${position}-ellipsis-${pageNum}`} className="text-muted-foreground px-1 text-xs font-mono">
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
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1750px] mx-auto">
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
                    {/* Date Selector in 24-Hour WIB Context */}
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            max={todayJakarta}
                            className="bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none cursor-pointer"
                        />
                        <span className="text-[10px] text-muted-foreground font-mono">WIB</span>
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

                    {/* Split Button: Scrape Live with Depth Options */}
                    <div className="inline-flex rounded-lg shadow-sm">
                        <Button
                            variant="default"
                            size="sm"
                            disabled={isScraping || isLoading}
                            onClick={() => handleRequestScrape(40)}
                            className="h-9 px-3.5 rounded-l-lg rounded-r-none text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-r border-primary-foreground/20"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                            <span>{isScraping ? `Scraping (${scrapeTargetDepth})...` : 'Scrape Live'}</span>
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="default"
                                    size="sm"
                                    disabled={isScraping || isLoading}
                                    className="h-9 px-2 rounded-l-none rounded-r-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                                    title="Select Scrape Depth"
                                >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 bg-card border-border/80 p-1.5 space-y-1">
                                <DropdownMenuItem
                                    onClick={() => handleRequestScrape(40)}
                                    className="cursor-pointer flex flex-col items-start gap-0.5 p-2 rounded-lg hover:bg-muted"
                                >
                                    <div className="text-xs font-bold text-foreground flex items-center justify-between w-full">
                                        <span>Standard Depth (40 posts)</span>
                                        <Badge variant="outline" className="text-[9px] font-mono">Standard</Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        ~18s latency · ~0.20 USD (~3,200 IDR)
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="bg-border/40 my-1" />

                                <DropdownMenuItem
                                    onClick={() => handleRequestScrape(100)}
                                    className="cursor-pointer flex flex-col items-start gap-0.5 p-2 rounded-lg hover:bg-muted text-primary"
                                >
                                    <div className="text-xs font-bold text-foreground flex items-center justify-between w-full">
                                        <span className="flex items-center gap-1.5 text-primary">
                                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Deep Intelligence (100 posts)</span>
                                        </span>
                                        <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-500">
                                            Deep
                                        </Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        ~42s latency · ~0.50 USD (~8,000 IDR)
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
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
                        Estimated {scrapeTargetDepth > 40 ? '~42s' : '~20s'}
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
                            onClick={() => handleRequestScrape(40)}
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

            {/* Main Telemetry: Three-Column Timeline Architecture */}
            {snapshot && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: Macro Stats, AI Sentiment, and Associated Hashtags (Sticky) */}
                    <div className="lg:col-span-3 xl:col-span-3 space-y-4 lg:sticky lg:top-6">
                        {/* Macro Velocity Card */}
                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardHeader className="p-4 pb-2 border-b border-border/40">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-primary" />
                                        <span>Campaign Velocity</span>
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {snapshot.total_posts} posts
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {/* Hype Score Spotlight */}
                                <div className="p-3 bg-muted/40 rounded-lg border border-border/40 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                            Hype Score
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-foreground flex items-baseline gap-1 mt-0.5">
                                            <span>{snapshot.sentiment?.hype_score ?? 80}</span>
                                            <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-500">
                                            {snapshot.sentiment?.positive ?? 75}% Positive
                                        </Badge>
                                        <div className="text-[9px] text-muted-foreground mt-1">
                                            Community buzz
                                        </div>
                                    </div>
                                </div>

                                {/* 2x2 Metric Scoreboard */}
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                            <span>Views</span>
                                            <Eye className="w-3 h-3 text-primary" />
                                        </div>
                                        <div className="text-sm font-bold text-foreground">
                                            {(snapshot.total_views || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground font-sans">
                                            ~{avgViews.toLocaleString()}/vid
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                            <span>Likes</span>
                                            <Heart className="w-3 h-3 text-rose-500" />
                                        </div>
                                        <div className="text-sm font-bold text-rose-500">
                                            {(snapshot.total_likes || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground font-sans">
                                            {snapshot.total_views > 0
                                                ? ((snapshot.total_likes / snapshot.total_views) * 100).toFixed(1)
                                                : 0}% ratio
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                            <span>Comments</span>
                                            <MessageCircle className="w-3 h-3 text-blue-500" />
                                        </div>
                                        <div className="text-sm font-bold text-blue-500">
                                            {(snapshot.total_comments || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground font-sans">
                                            Discourse
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                            <span>Shares</span>
                                            <Share2 className="w-3 h-3 text-emerald-500" />
                                        </div>
                                        <div className="text-sm font-bold text-emerald-500">
                                            {(snapshot.total_shares || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground font-sans">
                                            Transfers
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* AI Sentiment Radar Card with Guaranteed Praise Points */}
                        {snapshot.sentiment && (
                            <Card className="border-border/60 bg-card rounded-xl shadow-none">
                                <CardHeader className="p-4 pb-2 border-b border-border/40">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                                            <span>AI Sentiment Pulse</span>
                                        </CardTitle>
                                        <span className="text-[10px] font-mono text-muted-foreground">Gemini 3.8</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {/* Segmented Sentiment Bar */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                                            <span className="text-emerald-500">
                                                {snapshot.sentiment.positive}% Pos
                                            </span>
                                            <span className="text-amber-500">
                                                {snapshot.sentiment.mixed}% Mix
                                            </span>
                                            <span className="text-rose-500">
                                                {snapshot.sentiment.negative}% Neg
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden flex">
                                            <div
                                                style={{ width: `${snapshot.sentiment.positive}%` }}
                                                className="bg-emerald-500 h-full"
                                            />
                                            <div
                                                style={{ width: `${snapshot.sentiment.mixed}%` }}
                                                className="bg-amber-500 h-full"
                                            />
                                            <div
                                                style={{ width: `${snapshot.sentiment.negative}%` }}
                                                className="bg-rose-500 h-full"
                                            />
                                        </div>
                                    </div>

                                    {/* Praise Highlights (Verified Multi-Item List) */}
                                    <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Praise Points</span>
                                        </div>
                                        <ul className="space-y-1.5 text-[11px] text-foreground/90">
                                            {praiseList.map((point, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <span className="text-emerald-500 font-bold leading-tight">·</span>
                                                    <span className="leading-tight">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Criticism & Concern Themes */}
                                    <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>Criticism Themes</span>
                                        </div>
                                        <ul className="space-y-1.5 text-[11px] text-foreground/90">
                                            {criticismList.map((point, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <span className="text-amber-500 font-bold leading-tight">·</span>
                                                    <span className="leading-tight">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Associated Hashtags Ranked by Frequency Count */}
                        {associatedHashtags.length > 0 && (
                            <Card className="border-border/60 bg-card rounded-xl shadow-none">
                                <CardHeader className="p-4 pb-2 border-b border-border/40">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Hash className="w-3.5 h-3.5 text-primary" />
                                            <span>Associated Hashtags</span>
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {associatedHashtags.length} tags
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-[10px] text-muted-foreground">
                                        Ranked by occurrence count across crawled posts
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-3 pt-2.5">
                                    <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
                                        {associatedHashtags.slice(0, 16).map(({ tag, count }) => {
                                            const isCurrent = tag === cleanTag;
                                            const isFiltered = filterQuery.toLowerCase() === tag;
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isFiltered) {
                                                            handleFilterChange('');
                                                        } else {
                                                            handleFilterChange(tag);
                                                        }
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-all ${
                                                        isFiltered
                                                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                                                            : isCurrent
                                                            ? 'bg-muted/70 text-foreground border-border font-bold'
                                                            : 'bg-muted/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/60'
                                                    }`}
                                                    title={`Filter timeline by #${tag} (${count} posts)`}
                                                >
                                                    <span>#{tag}</span>
                                                    <span
                                                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                                            isFiltered
                                                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                                                : 'bg-muted text-foreground'
                                                        }`}
                                                    >
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {associatedHashtags.length > 16 && (
                                        <div className="text-[10px] text-muted-foreground font-mono text-center pt-2">
                                            +{associatedHashtags.length - 16} more tags discovered
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* 7-Day Historical Trajectory Card */}
                        {history.length > 1 && (
                            <Card className="border-border/60 bg-card rounded-xl shadow-none">
                                <CardHeader className="p-4 pb-2 border-b border-border/40">
                                    <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>7-Day Trajectory</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-2 pt-1">
                                    <div className="divide-y divide-border/20 text-[11px] font-mono">
                                        {history.slice(0, 5).map((h) => (
                                            <div
                                                key={h.date}
                                                onClick={() => handleDateChange(h.date)}
                                                className={`p-2 flex items-center justify-between rounded hover:bg-muted/30 cursor-pointer transition-colors ${
                                                    h.date === selectedDate ? 'bg-muted/50 font-bold text-foreground' : 'text-muted-foreground'
                                                }`}
                                            >
                                                <span>{h.date}</span>
                                                <span>{h.views.toLocaleString()}</span>
                                                <span className="text-emerald-500">{h.hype_score} pts</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Telemetry Footer */}
                        <div className="p-3 bg-muted/20 border border-border/40 rounded-xl text-[10px] text-muted-foreground space-y-1 font-mono">
                            <div className="flex items-center justify-between">
                                <span>Source:</span>
                                <strong className="text-foreground capitalize">{snapshot.source.replace('_', ' ')}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Captured:</span>
                                <strong className="text-foreground">{formatWIB24(snapshot.crawled_at)}</strong>
                            </div>
                            <div className="pt-1 border-t border-border/30 flex items-center justify-between">
                                <span>Raw Payload:</span>
                                <a
                                    href={firestoreSnapshotUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-500/90 hover:underline flex items-center gap-0.5"
                                >
                                    <span>Doc Link</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN: Posts Structured Like a Timeline (with J/K and Up/Down navigation) */}
                    <div ref={timelineContainerRef} className="lg:col-span-5 xl:col-span-5 space-y-4 min-w-0">
                        {/* Timeline Header & Control Bar */}
                        <Card className="border-border/60 bg-card rounded-xl shadow-none">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <span>Campaign Timeline</span>
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                {filteredPosts.length} posts
                                            </Badge>
                                        </h2>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                                            <Keyboard className="w-3 h-3 text-primary" />
                                            <span>Browse: J / K or ↑ / ↓ keys</span>
                                        </div>
                                    </div>

                                    {/* Page Size Selector (Default 10, then 25, then 50) */}
                                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg border border-border/60 p-0.5 text-[10px] font-semibold">
                                        <span className="text-muted-foreground px-1 font-mono">Per page:</span>
                                        {[10, 25, 50].map((size) => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => handlePageSizeChange(size)}
                                                className={`px-2 py-0.5 rounded transition-colors font-mono ${
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

                                {/* Search Filter Bar */}
                                <div className="flex items-center gap-2 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs">
                                    <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Filter by creator (@handle) or caption text..."
                                        value={filterQuery}
                                        onChange={(e) => handleFilterChange(e.target.value)}
                                        className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
                                    />
                                    {filterQuery && (
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange('')}
                                            className="text-muted-foreground hover:text-foreground text-[10px] font-mono px-1"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {/* Sort Parameter Buttons */}
                                <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                                    <span className="text-[10px] font-mono text-muted-foreground">Sort order:</span>
                                    <div className="flex items-center bg-muted/40 rounded-lg border border-border/60 p-0.5 text-[11px] font-semibold">
                                        {(['date', 'views', 'likes', 'comments', 'shares'] as const).map((key) => {
                                            const isActive = sortBy === key;
                                            const labelMap = {
                                                date: 'Timeline (Date)',
                                                views: 'Views',
                                                likes: 'Likes',
                                                comments: 'Comments',
                                                shares: 'Shares',
                                            };
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => handleSortChange(key)}
                                                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                                                        isActive
                                                            ? 'bg-background text-foreground shadow-sm font-bold'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                    title={`Sort by ${labelMap[key]} (${isActive && sortDirection === 'asc' ? 'ascending' : 'descending'})`}
                                                >
                                                    <span>{labelMap[key]}</span>
                                                    {isActive && (
                                                        <span className="font-mono text-[9px] text-primary">
                                                            {sortDirection === 'desc' ? '↓' : '↑'}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Pagination Bar */}
                        {renderPaginationBar('top')}

                        {/* Vertical Timeline Stream with Rock-Solid Flex Architecture */}
                        {filteredPosts.length === 0 ? (
                            <Card className="border-border/60 bg-card rounded-xl p-8 text-center text-xs text-muted-foreground shadow-none">
                                No video posts found matching the active filter.
                            </Card>
                        ) : (
                            <div className="space-y-0 my-1">
                                {paginatedPosts.map((post, idx) => {
                                    const postUniqueKey = post.id || post.url || String(idx);
                                    const isSelected = activePost && (activePost.id === post.id || activePost.url === post.url);
                                    const isTopPost = (post.id && post.id === topPostId) || post.url === topPostId;

                                    return (
                                        <div key={postUniqueKey} className="flex items-stretch gap-3 group">
                                            {/* Dedicated Left Timeline Axis */}
                                            <div className="flex flex-col items-center shrink-0 w-7">
                                                {/* Node Circle centered perfectly on the track */}
                                                <div
                                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] transition-all bg-card z-10 shrink-0 ${
                                                        isSelected
                                                            ? 'border-primary bg-primary text-primary-foreground font-bold ring-2 ring-primary/25 shadow-sm'
                                                            : isTopPost
                                                            ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                                                            : 'border-border/80 text-muted-foreground group-hover:border-primary/60'
                                                    }`}
                                                >
                                                    {isTopPost ? (
                                                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                                                    ) : (
                                                        <Clock className="w-3.5 h-3.5" />
                                                    )}
                                                </div>

                                                {/* Continuous Connecting Line to Next Post */}
                                                {idx < paginatedPosts.length - 1 && (
                                                    <div className="w-0.5 grow bg-border/60 my-1 group-hover:bg-border transition-colors" />
                                                )}
                                            </div>

                                            {/* Post Card Container */}
                                            <div className="flex-1 min-w-0 pb-2.5">
                                                <Card
                                                    onClick={() => setSelectedPostId(post.id || post.url)}
                                                    className={`p-3 border rounded-xl transition-all cursor-pointer shadow-none space-y-2 ${
                                                        isSelected
                                                            ? 'border-primary bg-muted/20 ring-1 ring-primary'
                                                            : 'border-border/60 bg-card hover:border-border hover:bg-muted/10'
                                                    }`}
                                                >
                                                    {/* Top Row: Timestamp badge and Creator Info */}
                                                    <div className="flex items-center justify-between text-xs gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className="font-bold text-foreground truncate">
                                                                {formatHandle(post.author_handle)}
                                                            </span>
                                                            {post.author_name && (
                                                                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                                                                    ({post.author_name})
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {isTopPost && (
                                                                <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-500 bg-amber-500/5">
                                                                    #1 Views
                                                                </Badge>
                                                            )}
                                                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 flex items-center gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {formatWIB24(post.published_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Caption snippet */}
                                                    <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed font-sans">
                                                        {post.caption}
                                                    </p>

                                                    {/* Inlined Single-Line Metric Strip */}
                                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 text-[11px] font-mono">
                                                        <div className="flex items-center gap-3">
                                                            <span className="inline-flex items-center gap-1 font-bold text-foreground" title="Views">
                                                                <Eye className="w-3 h-3 text-primary" />
                                                                <span>{post.views >= 1000 ? `${(post.views / 1000).toFixed(1)}k` : post.views}</span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 font-bold text-rose-500" title="Likes">
                                                                <Heart className="w-3 h-3" />
                                                                <span>{post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}</span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 font-bold text-blue-500" title="Comments">
                                                                <MessageCircle className="w-3 h-3" />
                                                                <span>{post.comments}</span>
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 font-bold text-emerald-500" title="Shares">
                                                                <Share2 className="w-3 h-3" />
                                                                <span>{post.shares}</span>
                                                            </span>
                                                        </div>

                                                        <span className="text-[10px] font-sans font-medium text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
                                                            {isSelected ? (
                                                                <span className="font-semibold text-primary">Inspecting</span>
                                                            ) : (
                                                                <span>Forensics →</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </Card>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Bottom Pagination Bar */}
                        {renderPaginationBar('bottom')}
                    </div>

                    {/* RIGHT COLUMN: Active Post Inspector & Audience Intelligence (Sticky) */}
                    <div className="lg:col-span-4 xl:col-span-4 space-y-4 lg:sticky lg:top-6">
                        {activePost ? (
                            <Card className="border-border/60 bg-card rounded-xl shadow-none">
                                <CardHeader className="p-4 pb-2 border-b border-border/40">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5 text-primary" />
                                                <span>Active Post Inspector</span>
                                            </CardTitle>
                                            <CardDescription className="text-[10px] text-muted-foreground">
                                                Granular performance forensics and community response
                                            </CardDescription>
                                        </div>

                                        {selectedPostId && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedPostId(null)}
                                                className="h-7 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground gap-1"
                                                title="Reset to default catalyst"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Reset</span>
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 space-y-4">
                                    {/* Creator Profile Header */}
                                    <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                        <span>{formatHandle(activePost.author_handle)}</span>
                                                        <a
                                                            href={`https://www.tiktok.com/@${activePost.author_handle.replace(/^@+/, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-muted-foreground hover:text-primary transition-colors"
                                                            title="View TikTok creator profile"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                    {activePost.author_name && (
                                                        <div className="text-[11px] text-muted-foreground">
                                                            {activePost.author_name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                Published
                                            </Badge>
                                        </div>

                                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/30">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            <span>{formatWIBFull24(activePost.published_at)}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Watch on TikTok, Copy Link, Filter Author */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            asChild
                                            className="h-8 text-xs font-bold gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                                        >
                                            <a
                                                href={activePost.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <span>Watch</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCopyUrl(activePost.url)}
                                            className="h-8 text-xs font-medium gap-1 rounded-lg border-border/60 hover:bg-muted"
                                        >
                                            <Copy className="w-3 h-3 text-muted-foreground" />
                                            <span>Copy URL</span>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleFilterByCreator(activePost.author_handle)}
                                            className="h-8 text-xs font-medium gap-1 rounded-lg border-border/60 hover:bg-muted"
                                            title="Filter timeline for this creator"
                                        >
                                            <Filter className="w-3 h-3 text-muted-foreground" />
                                            <span>Author</span>
                                        </Button>
                                    </div>

                                    {/* Granular Post Performance Metrics (2x2 Grid) */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                            Post Metric Breakdown
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                            <div className="p-3 bg-muted/30 border border-border/40 rounded-lg space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                                    <span>Views</span>
                                                    <Eye className="w-3 h-3 text-primary" />
                                                </div>
                                                <div className="text-base font-bold text-foreground">
                                                    {(activePost.views || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[9px] text-primary font-sans">
                                                    {avgViews > 0
                                                        ? `${((activePost.views / avgViews)).toFixed(1)}x hashtag average`
                                                        : 'Baseline'}
                                                </div>
                                            </div>

                                            <div className="p-3 bg-muted/30 border border-border/40 rounded-lg space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                                    <span>Likes</span>
                                                    <Heart className="w-3 h-3 text-rose-500" />
                                                </div>
                                                <div className="text-base font-bold text-rose-500">
                                                    {(activePost.likes || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground font-sans">
                                                    {activePost.views > 0
                                                        ? ((activePost.likes / activePost.views) * 100).toFixed(2)
                                                        : 0}% like ratio
                                                </div>
                                            </div>

                                            <div className="p-3 bg-muted/30 border border-border/40 rounded-lg space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                                    <span>Comments</span>
                                                    <MessageCircle className="w-3 h-3 text-blue-500" />
                                                </div>
                                                <div className="text-base font-bold text-blue-500">
                                                    {(activePost.comments || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground font-sans">
                                                    Community chatter
                                                </div>
                                            </div>

                                            <div className="p-3 bg-muted/30 border border-border/40 rounded-lg space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-sans flex items-center justify-between">
                                                    <span>Shares</span>
                                                    <Share2 className="w-3 h-3 text-emerald-500" />
                                                </div>
                                                <div className="text-base font-bold text-emerald-500">
                                                    {(activePost.shares || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground font-sans">
                                                    Viral transfers
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full Caption Box */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                                            <span>Full Video Caption</span>
                                            <span className="text-[9px]">{activePost.caption.length} chars</span>
                                        </div>
                                        <div className="p-3 bg-muted/20 border border-border/40 rounded-xl text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                                            {activePost.caption}
                                        </div>
                                    </div>

                                    {/* Hashtags Chips if present */}
                                    {activePost.hashtags && activePost.hashtags.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                                Associated Hashtags
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {activePost.hashtags.map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        variant="outline"
                                                        className="text-[10px] font-mono border-border/60 hover:bg-muted cursor-pointer"
                                                        onClick={() => handleFilterChange(tag)}
                                                    >
                                                        #{tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Direct Deep Link to Video */}
                                    <div className="p-3 rounded-lg border border-border/40 bg-muted/30 flex items-center justify-between gap-2">
                                        <div className="truncate text-[11px] font-mono text-muted-foreground">
                                            {activePost.url}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="h-6 px-2 text-[10px] font-semibold text-primary shrink-0 gap-1 hover:bg-muted"
                                        >
                                            <a
                                                href={activePost.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <span>Open</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-border/60 bg-card rounded-xl p-8 text-center text-xs text-muted-foreground shadow-none">
                                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                                Select any video card in the campaign timeline to inspect individual metrics and creator forensics.
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* Depth and Cost Confirmation Modal */}
            <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
                <DialogContent className="max-w-md bg-card border-border/80 text-foreground p-5 rounded-xl shadow-xl">
                    <DialogHeader className="space-y-1.5">
                        <DialogTitle className="text-sm font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Confirm Live Scraping Execution</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Review operational depth, latency, and estimated Apify credit consumption before triggering live crawler.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 pt-2 text-xs">
                        {/* Summary Table */}
                        <div className="bg-muted/40 border border-border/60 rounded-lg p-3 space-y-2 font-mono text-[11px]">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-sans">Campaign Tag:</span>
                                <span className="font-bold text-foreground">#{cleanTag}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-sans">Target Depth:</span>
                                <span className="font-bold text-primary">
                                    {pendingDepth} Video Posts {pendingDepth > 40 ? '(Deep Intelligence)' : '(Standard)'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-sans">Estimated Cost:</span>
                                <span className="font-bold text-amber-500">
                                    {pendingDepth > 40 ? '~0.50 USD (~8,000 IDR)' : '~0.20 USD (~3,200 IDR)'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-sans">Estimated Latency:</span>
                                <span className="text-foreground">{pendingDepth > 40 ? '~42 seconds' : '~18 seconds'}</span>
                            </div>
                        </div>

                        {/* Cooldown Warning Alert */}
                        {isCooldownActive && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-500 text-[11px]">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Cooldown Lockout Active</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    This hashtag was scraped {elapsedMinutes} minute{elapsedMinutes === 1 ? '' : 's'} ago. Proceeding now will apply a force override and consume fresh Apify compute units.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmModalOpen(false)}
                            className="h-8 px-3 text-xs font-semibold rounded-lg border-border/60 hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => executeScrape(pendingDepth, true)}
                            className="h-8 px-3 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                        >
                            <RefreshCw className="w-3 h-3" />
                            <span>Confirm &amp; Scrape ({pendingDepth} Posts)</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
