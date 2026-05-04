/**
 * Industry Feed — Multi-Platform + AI Hourly Analysis
 *
 * Date-navigable timeline with backfill support.
 * Loads persisted data from Firestore (via /api/social-feed/data).
 * Backfill trigger via /api/social-feed/backfill.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useParams } from 'next/navigation';
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Film,
    Star,
    Clapperboard,
    Users,
    Zap,
    Calendar,
    Download,
    Loader2,
    Sparkles,
    Trash2,
    Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/api';
import {
    CONTENT_TYPE_LABELS,
    type ContentType,
} from '@/features/social-pulse/data/mockSocialFeed';
import { YouTubeIcon } from '@/components/BrandIcons';
import {
    type FirestoreSocialPost,
    type FirestoreSocialAnalysis,
    formatHour,
    groupPostsByHour,
} from '@/lib/firestore-social';

const CONTENT_ICONS: Record<ContentType, typeof Film> = {
    trailer: Film,
    review: Star,
    short: Zap,
    promo: Clapperboard,
    community: Users,
};

// ─── Helpers (Jakarta timezone) ────────────────────────

const TZ = 'Asia/Jakarta';

function getJakartaToday(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function getJakartaDate(date: Date): string {
    return date.toLocaleDateString('sv-SE', { timeZone: TZ });
}

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

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00+07:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
}

function isToday(dateStr: string): boolean {
    return dateStr === getJakartaToday();
}

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00+07:00');
    d.setDate(d.getDate() + days);
    return getJakartaDate(d);
}

// ─── API response types ────────────────────────────────

interface DataResponse {
    success: boolean;
    data: {
        date: string;
        has_data: boolean;
        posts: FirestoreSocialPost[];
        analyses: FirestoreSocialAnalysis[];
        // Backward compat — API also returns these keys
        videos: FirestoreSocialPost[];
        video_count: number;
        analysis_count: number;
    };
}

// ─── Post Card ─────────────────────────────────────────

function PostCard({ post }: { post: FirestoreSocialPost }) {
    const [expanded, setExpanded] = useState(false);
    const typeConfig = CONTENT_TYPE_LABELS[post.content_type as ContentType] || CONTENT_TYPE_LABELS.community;
    const TypeIcon = CONTENT_ICONS[post.content_type as ContentType] || CONTENT_ICONS.community;
    const description = post.text || post.full_description || post.description;
    const hasDescription = description && description.length > 0;
    const views = post.metrics?.views || post.view_count || 0;
    const avatar = post.source_avatar || post.channel_avatar || '';
    const name = post.source_name || post.channel_title || '';
    const postUrl = post.url || post.video_url || '#';

    return (
        <div className="group bg-background/50 border border-border/40 rounded-2xl hover:bg-muted/30 hover:border-border/60 transition-all duration-300 overflow-hidden">
            <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
            >
                {post.thumbnail && (
                    <div className="relative">
                        <img src={post.thumbnail} alt="" className="w-full h-auto object-cover" loading="lazy" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                <YouTubeIcon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div className={cn("absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[8px] font-bold uppercase tracking-wider", typeConfig.color)}>
                            <TypeIcon className="w-2.5 h-2.5" />
                            <span>{post.content_type}</span>
                        </div>
                        <span className="absolute bottom-2 right-2 text-[9px] text-white/80 font-mono tabular-nums bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">{timeAgo(post.published_at)}</span>
                        {views > 0 && (
                            <span className="absolute top-2 right-2 text-[8px] text-white/70 font-mono bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md">{formatNumber(views)} views</span>
                        )}
                    </div>
                )}

                <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            {avatar ? (
                                <img src={avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <YouTubeIcon className="w-3 h-3 text-red-500" />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold truncate">{name}</span>
                        </div>
                    </div>
                    <p className="text-[12px] font-semibold leading-snug text-foreground line-clamp-2">
                        {post.title}
                    </p>
                </div>
            </a>

            {/* Expandable description */}
            {hasDescription && (
                <div className="px-3 pb-3">
                    <button
                        onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
                        className="w-full text-left"
                    >
                        <p className={cn(
                            "text-[11px] text-muted-foreground/70 leading-relaxed whitespace-pre-line",
                            !expanded && "line-clamp-2",
                        )}>
                            {description}
                        </p>
                        {description.length > 100 && (
                            <span className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
                                {expanded ? '← Show less' : 'Show more ▾'}
                            </span>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Account Card ──────────────────────────────────────

function AccountCard({ name, avatar, postCount }: { name: string; avatar: string; postCount: number }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/20 hover:bg-muted/20 transition-colors">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <YouTubeIcon className="w-4 h-4 text-red-500" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate">{name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{postCount} posts</span>
                </div>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────

export default function SocialFeedPage() {
    const router = useRouter();
    const params = useParams();
    const today = useMemo(() => getJakartaToday(), []);
    const selectedDate = (params.date as string) || today;
    const [backfilling, setBackfilling] = useState(false);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const hourRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const sidebarButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
    const feedContainerRef = useRef<HTMLDivElement>(null);
    const isScrollingTo = useRef<number | null>(null);

    // Navigate to a new date (updates URL)
    const setSelectedDate = useCallback((date: string) => {
        router.push(`/social-feed/${date}`);
    }, [router]);

    // SSE progress state
    const [progress, setProgress] = useState<{
        phase: string;
        message: string;
        channel?: string;
        channelIndex?: number;
        totalChannels?: number;
        totalVideos?: number;
        completedHours?: number;
        totalHours?: number;
        percent?: number;
        lastSummary?: string;
        completedSummaries?: { hour: string; hourNum: number; postCount: number; summary: string; hashtags: string[] }[];
        done?: boolean;
        error?: string;
        videos_written?: number;
        analyses_written?: number;
        retryInfo?: {
            hour: string;
            attempt: number;
            maxRetries: number;
            retryDelaySeconds: number;
        };
    } | null>(null);

    const updateProgress = (update: Partial<NonNullable<typeof progress>> & { phase: string; message: string }) => {
        setProgress(prev => prev ? { ...prev, ...update } : { completedSummaries: [], ...update } as NonNullable<typeof progress>);
    };

    // Reset progress when navigating to a different date
    useEffect(() => {
        setProgress(null);
        setBackfilling(false);
    }, [selectedDate]);

    // Countdown timer for retry state
    const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
    const retryStartTime = useRef<number>(0);
    const retryDelayTotal = useRef<number>(0);

    useEffect(() => {
        if (progress?.phase === 'retrying' && progress.retryInfo) {
            retryStartTime.current = Date.now();
            retryDelayTotal.current = progress.retryInfo.retryDelaySeconds;
            setRetryCountdown(progress.retryInfo.retryDelaySeconds);

            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - retryStartTime.current) / 1000);
                const remaining = Math.max(0, retryDelayTotal.current - elapsed);
                setRetryCountdown(remaining);
                if (remaining <= 0) clearInterval(interval);
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setRetryCountdown(null);
        }
    }, [progress?.phase, progress?.retryInfo?.attempt, progress?.retryInfo?.retryDelaySeconds]);

    // Fetch persisted data for selected date
    const { data: responseData, isLoading, mutate } = useSWR<DataResponse>(
        `/api/social-feed/data?date=${selectedDate}`,
        fetcher,
    );

    // Fetch sources list (for backfill panel when no data)
    const { data: sourcesData } = useSWR<{ success: boolean; data: { sources: { id: string; display_name: string; category: string; avatar_url: string; handle: string; active: boolean }[] } }>(
        '/api/social-feed/sources',
        fetcher,
    );
    const activeSources = (sourcesData?.data?.sources || []).filter(s => s.active);

    const data = responseData?.data;
    // Support both new "posts" key and backward-compat "videos" key
    const posts = data?.posts || data?.videos || [];
    const analyses = data?.analyses || [];
    const hasData = data?.has_data || false;

    // Group posts by hour
    const hourGroups = useMemo(() => groupPostsByHour(posts), [posts]);

    // Build analysis map for quick lookup (sorted by hour ascending)
    const analysisMap = useMemo(() => {
        const map = new Map<number, FirestoreSocialAnalysis>();
        [...analyses].sort((a, b) => a.hour - b.hour).forEach(a => map.set(a.hour, a));
        return map;
    }, [analyses]);

    // Derive accounts from post data
    interface DerivedAccount {
        id: string;
        display_name: string;
        avatar_url: string;
        category: string;
        post_count: number;
    }

    const derivedAccounts = useMemo(() => {
        const seen = new Map<string, DerivedAccount>();
        for (const p of posts) {
            const accountId = p.source_id || p.channel_id;
            if (!seen.has(accountId)) {
                seen.set(accountId, {
                    id: accountId,
                    display_name: p.source_name || p.channel_title || '',
                    avatar_url: p.source_avatar || p.channel_avatar || '',
                    category: p.source_category || 'unknown',
                    post_count: 0,
                });
            }
            seen.get(accountId)!.post_count++;
        }
        return [...seen.values()];
    }, [posts]);

    // ─── Scroll spy: sync sidebar highlight with feed scroll position ───
    useEffect(() => {
        if (!hasData || posts.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Don't update during programmatic scroll from sidebar click
                if (isScrollingTo.current !== null) return;

                // Find the topmost visible hour section
                const visible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length > 0) {
                    const el = visible[0].target;
                    const hour = [...hourRefs.current.entries()].find(([, v]) => v === el)?.[0];
                    if (hour !== undefined) {
                        setSelectedHour(prev => prev !== hour ? hour : prev);
                    }
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
        );

        // Observe all hour sections
        for (const [, el] of hourRefs.current) {
            observer.observe(el);
        }

        return () => observer.disconnect();
    }, [hasData, posts.length]);

    // ─── Sync sidebar scroll with selected hour ────────────
    useEffect(() => {
        if (selectedHour === null) return;
        // Only auto-scroll sidebar when triggered by scroll spy (not by click)
        if (isScrollingTo.current !== null) return;

        const btn = sidebarButtonRefs.current.get(selectedHour);
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedHour]);

    // Backfill handler — consumes SSE stream
    const handleBackfill = useCallback(async () => {
        setBackfilling(true);
        setProgress({ phase: 'starting', message: 'Connecting...', completedSummaries: [] });

        try {
            const res = await fetch('/api/social-feed/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate }),
            });

            if (!res.ok || !res.body) {
                setProgress({ phase: 'error', message: `Request failed: ${res.status}`, error: 'Request failed' });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7);
                    } else if (line.startsWith('data: ') && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (eventType === 'phase') {
                                updateProgress({ phase: data.phase, message: data.message, totalVideos: data.totalVideos });
                            } else if (eventType === 'progress') {
                                updateProgress({ phase: 'fetching', message: data.message, channel: data.channel, channelIndex: data.channelIndex, totalChannels: data.totalChannels });
                            } else if (eventType === 'channel_done') {
                                updateProgress({ phase: 'fetching', message: progress?.message || 'Fetching...', totalVideos: data.totalVideosSoFar });
                            } else if (eventType === 'hour_done') {
                                updateProgress({
                                    phase: 'analyzing',
                                    message: `Analyzing hour ${data.hourFormatted}...`,
                                    completedHours: data.completedHours,
                                    totalHours: data.totalHours,
                                    percent: data.progress,
                                    lastSummary: data.fullSummary || data.summary,
                                    retryInfo: undefined,
                                    completedSummaries: [
                                        ...(progress?.completedSummaries || []),
                                        {
                                            hour: data.hourFormatted,
                                            hourNum: data.hour,
                                            postCount: data.videoCount,
                                            summary: data.fullSummary || data.summary,
                                            hashtags: data.hashtags || [],
                                        },
                                    ],
                                });
                            } else if (eventType === 'retry') {
                                updateProgress({
                                    phase: 'retrying',
                                    message: `Rate limited at ${data.hourFormatted}. Retrying in ${data.retryDelaySeconds}s (attempt ${data.attempt}/${data.maxRetries})...`,
                                    retryInfo: {
                                        hour: data.hourFormatted,
                                        attempt: data.attempt,
                                        maxRetries: data.maxRetries,
                                        retryDelaySeconds: data.retryDelaySeconds,
                                    },
                                });
                            } else if (eventType === 'done') {
                                updateProgress({
                                    phase: 'done',
                                    message: 'Complete!',
                                    done: true,
                                    videos_written: data.videos_written,
                                    analyses_written: data.analyses_written,
                                    percent: 100,
                                });
                                mutate();
                            } else if (eventType === 'error') {
                                updateProgress({ phase: 'error', message: data.message, error: data.message });
                            }
                        } catch { /* ignore parse errors */ }
                        eventType = '';
                    }
                }
            }
        } catch (err) {
            setProgress({ phase: 'error', message: 'Connection failed', error: String(err) });
        } finally {
            setBackfilling(false);
        }
    }, [selectedDate, mutate]);

    // Delete handler
    const [deleting, setDeleting] = useState(false);
    const handleDelete = useCallback(async () => {
        if (!confirm(`Delete all data for ${formatDate(selectedDate)}?\n\nThis removes ${posts.length} posts and ${analyses.length} analyses from Firestore.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/social-feed/data?date=${selectedDate}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                mutate();
            } else {
                console.error('Delete failed:', result.error);
            }
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setDeleting(false);
        }
    }, [selectedDate, posts.length, analyses.length, mutate]);

    // Date navigation
    const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
    const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
    const canGoForward = addDays(selectedDate, 1) <= today;

    // Content type counts
    const contentTypeCounts = useMemo(() => {
        const counts: Record<ContentType, number> = { trailer: 0, review: 0, short: 0, promo: 0, community: 0 };
        posts.forEach(p => {
            const ct = p.content_type as ContentType;
            if (ct in counts) counts[ct]++;
        });
        return counts;
    }, [posts]);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-6 animate-in fade-in duration-700">
            {/* ─── Header + Date Navigation ─────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black uppercase tracking-tighter">Industry Feed</h1>
                            <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-black text-muted-foreground uppercase tracking-tight">Social + AI</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {hasData
                                ? <><span className="text-foreground font-bold">{posts.length}</span> posts • <span className="text-foreground font-bold">{analyses.length}</span> hourly analyses</>
                                : 'No data for this date'
                            }
                        </p>
                    </div>
                </div>

                {/* Date picker */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={goToPrevDay} className="h-8 w-8">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-xl border border-border/40">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className={cn("text-sm font-bold tabular-nums", isToday(selectedDate) && "text-primary")}>
                            {formatDate(selectedDate)}
                        </span>
                        {isToday(selectedDate) && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[8px] font-black uppercase">Today</span>
                        )}
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            min="2026-01-01"
                            onChange={e => setSelectedDate(e.target.value)}
                            className="ml-1 text-xs bg-transparent border border-border/40 rounded px-2 py-1 text-muted-foreground cursor-pointer"
                        />
                    </div>

                    <Button variant="ghost" size="icon" onClick={goToNextDay} disabled={!canGoForward} className="h-8 w-8">
                        <ChevronRight className="w-4 h-4" />
                    </Button>

                    {/* Delete button — only when data exists */}
                    {hasData && !isLoading && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            disabled={deleting || backfilling}
                            className="h-8 px-3 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                        >
                            {deleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <><Trash2 className="w-3.5 h-3.5 mr-1.5" /><span className="text-[10px] font-bold uppercase">Delete</span></>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* ─── Backfill Panel (shown when no data) ──────────── */}
            {!hasData && !isLoading && !backfilling && !progress?.done && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 pb-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                <Download className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold">No data for {formatDate(selectedDate)}</p>
                                <p className="text-xs text-muted-foreground">
                                    Backfill will fetch YouTube uploads from <span className="text-foreground font-semibold">{activeSources.length}</span> monitored accounts and generate per-hour AI analysis.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><YouTubeIcon className="w-3 h-3 text-red-500" /> activities.list + videos.list</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> Gemini hourly summaries</span>
                            <span>•</span>
                            <span>~90-140 API quota units</span>
                        </div>
                    </div>

                    {/* Source list grouped by category */}
                    <div className="border-t border-amber-500/10 px-5 py-4 space-y-4">
                        {(() => {
                            const CATEGORY_ORDER: { key: string; label: string }[] = [
                                { key: 'distributor', label: 'Distributors & Studios' },
                                { key: 'streaming', label: 'Streaming' },
                                { key: 'cinema_chain', label: 'Cinema Chains' },
                                { key: 'critic', label: 'Critics & Reviewers' },
                                { key: 'community', label: 'Community & Fandom' },
                                { key: 'news', label: 'News & Trade' },
                            ];
                            const grouped = new Map<string, typeof activeSources>();
                            for (const s of activeSources) {
                                if (!grouped.has(s.category)) grouped.set(s.category, []);
                                grouped.get(s.category)!.push(s);
                            }
                            return CATEGORY_ORDER
                                .filter(c => grouped.has(c.key))
                                .map(({ key, label }) => (
                                    <div key={key}>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                            {(grouped.get(key) || []).map(source => (
                                                <div key={source.id} className="flex items-center gap-2.5 px-3 py-2 bg-background/40 rounded-lg border border-border/10">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                                        {source.avatar_url ? (
                                                            <img src={source.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <YouTubeIcon className="w-3.5 h-3.5 text-red-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-medium truncate">{source.display_name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                        })()}
                    </div>

                    {/* Action button — at the bottom */}
                    <div className="border-t border-amber-500/10 p-5 pt-4">
                        <Button
                            onClick={handleBackfill}
                            disabled={backfilling}
                            className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                        >
                            <><Download className="w-4 h-4 mr-2" />Backfill {formatDate(selectedDate)}</>
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── Live Progress Panel ────────────────────────── */}
            {(backfilling || (progress && !hasData)) && progress && (
                <div className="p-5 bg-background border border-border/40 rounded-2xl space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        {progress.done ? (
                            <div className="p-2 bg-green-500/10 rounded-xl text-green-500">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        ) : progress.error ? (
                            <div className="p-2 bg-destructive/10 rounded-xl text-destructive">
                                <Loader2 className="w-5 h-5" />
                            </div>
                        ) : (
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        )}
                        <div className="flex-1">
                            <p className="text-sm font-bold">{progress.message}</p>
                            {progress.phase === 'fetching' && progress.channel && (
                                <p className="text-xs text-muted-foreground">
                                    Source {progress.channelIndex}/{progress.totalChannels}: {progress.channel}
                                </p>
                            )}
                            {progress.phase === 'analyzing' && (
                                <p className="text-xs text-muted-foreground">
                                    Hour {progress.completedHours}/{progress.totalHours}
                                    {progress.totalVideos !== undefined && ` • ${progress.totalVideos} posts found`}
                                </p>
                            )}
                        </div>
                        {progress.percent !== undefined && (
                            <span className="text-sm font-mono font-bold text-primary tabular-nums">{progress.percent}%</span>
                        )}
                    </div>

                    {/* Progress bar */}
                    {!progress.done && !progress.error && (
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress.percent || 0}%` }}
                            />
                        </div>
                    )}

                    {/* Retry countdown */}
                    {progress.phase === 'retrying' && progress.retryInfo && (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-amber-600">
                                    ⚡ Gemini rate limit — retrying {progress.retryInfo.hour}
                                </p>
                                <span className="text-lg font-mono font-black text-amber-500 tabular-nums">
                                    {retryCountdown !== null ? `${retryCountdown}s` : '...'}
                                </span>
                            </div>
                            <div className="h-1 bg-amber-500/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500/50 rounded-full transition-all duration-1000"
                                    style={{
                                        width: retryCountdown !== null && retryDelayTotal.current > 0
                                            ? `${Math.max(0, (1 - retryCountdown / retryDelayTotal.current) * 100)}%`
                                            : '0%',
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Attempt {progress.retryInfo.attempt} of {progress.retryInfo.maxRetries}
                            </p>
                        </div>
                    )}

                    {/* Completed summaries — readable while waiting */}
                    {(progress.completedSummaries ?? []).length > 0 && progress.phase === 'analyzing' && (
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 sticky top-0 bg-background py-1">Summaries generated ({(progress.completedSummaries ?? []).length})</p>
                            {(progress.completedSummaries ?? []).map((s, i) => (
                                <div key={i} className="p-3 bg-muted/20 rounded-xl border border-border/20">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-xs font-mono font-bold tabular-nums text-primary">{s.hour}</span>
                                        <span className="text-[10px] text-muted-foreground">{s.postCount} posts</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{s.summary}</p>
                                    {s.hashtags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {s.hashtags.map((tag: string) => (
                                                <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary/70 rounded-full text-[8px] font-bold">
                                                    <Hash className="w-2 h-2" />
                                                    {tag.replace('#', '')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Done summary */}
                    {progress.done && (
                        <div className="flex items-center gap-4 text-xs">
                            <span className="text-green-600 font-bold">✓ {progress.videos_written} posts fetched</span>
                            <span className="text-green-600 font-bold">✓ {progress.analyses_written} hourly analyses</span>
                        </div>
                    )}

                    {/* Error */}
                    {progress.error && (
                        <p className="text-xs text-destructive">{progress.error}</p>
                    )}
                </div>
            )}

            {/* ─── Loading ──────────────────────────────────── */}
            {isLoading && (
                <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                    <YouTubeIcon className="w-6 h-6 text-red-500 animate-pulse" />
                    <span className="text-sm font-bold uppercase tracking-widest">Loading data for {formatDate(selectedDate)}...</span>
                </div>
            )}

            {/* ─── 3-Zone Layout ────────────────────────────── */}
            {!isLoading && hasData && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ZONE 1: AI Pulse — hourly analysis timeline */}
                    <aside className="lg:col-span-2">
                        <div className="sticky top-4 h-[calc(100vh-2rem)] flex flex-col">
                            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Pulse</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                                {[...Array(24)].map((_, h) => {
                                    const hourPosts = hourGroups.get(h) || [];
                                    const analysis = analysisMap.get(h);
                                    const hasPosts = hourPosts.length > 0;
                                    const isSelected = selectedHour === h;

                                    return (
                                        <button
                                            key={h}
                                            ref={(el) => {
                                                if (el) sidebarButtonRefs.current.set(h, el);
                                                else sidebarButtonRefs.current.delete(h);
                                            }}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedHour(null);
                                                } else {
                                                    setSelectedHour(h);
                                                    isScrollingTo.current = h;
                                                    const el = hourRefs.current.get(h);
                                                    if (el) {
                                                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                    // Clear guard after scroll animation finishes
                                                    setTimeout(() => { isScrollingTo.current = null; }, 800);
                                                }
                                            }}
                                            className={cn(
                                                "w-full text-left p-2.5 rounded-xl transition-all duration-200",
                                                isSelected
                                                    ? "bg-primary/10 border border-primary/20"
                                                    : hasPosts
                                                        ? "bg-background/50 border border-border/20 hover:bg-muted/20 hover:border-border/40"
                                                        : "opacity-30",
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-mono font-bold tabular-nums">{formatHour(h)}</span>
                                                {hasPosts && (
                                                    <span className="text-[9px] font-mono font-bold text-muted-foreground">{hourPosts.length}</span>
                                                )}
                                            </div>
                                            {analysis && (
                                                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">
                                                    {analysis.summary}
                                                </p>
                                            )}
                                            {!hasPosts && !analysis && (
                                                <p className="text-[9px] text-muted-foreground/50 italic">No activity</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* ZONE 2: Visual Feed — hour-grouped, always visible */}
                    <main className="lg:col-span-7 space-y-6" ref={feedContainerRef}>
                        {/* Content type summary bar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {(Object.entries(contentTypeCounts) as [ContentType, number][]).filter(([, count]) => count > 0).map(([type, count]) => {
                                const cfg = CONTENT_TYPE_LABELS[type];
                                const Icon = CONTENT_ICONS[type];
                                return (
                                    <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/20 rounded-lg">
                                        <Icon className={cn("w-3 h-3", cfg.color)} />
                                        <span className="text-[10px] font-bold text-muted-foreground">{count} {cfg.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hour sections — ascending from 0 (morning) to 23 (night) */}
                        {[...Array(24)].map((_, h) => {
                            const hourIdx = h;
                            const hourPosts = hourGroups.get(hourIdx) || [];

                            // Always skip empty hours
                            if (hourPosts.length === 0) return null;

                            const analysis = analysisMap.get(hourIdx);
                            const postCount = analysis?.total_posts || analysis?.video_count || hourPosts.length;
                            const isSelected = selectedHour === hourIdx;

                            return (
                                <div
                                    key={hourIdx}
                                    ref={(el) => {
                                        if (el) hourRefs.current.set(hourIdx, el);
                                        else hourRefs.current.delete(hourIdx);
                                    }}
                                    className={cn(
                                        "scroll-mt-6 rounded-2xl transition-all duration-300",
                                        isSelected && "ring-2 ring-primary/20 bg-primary/[0.02]",
                                    )}
                                >
                                    {/* Hour header */}
                                    <div className="flex items-center gap-3 mb-3 px-3 pt-3">
                                        <span className={cn(
                                            "text-sm font-mono font-black tabular-nums",
                                            isSelected ? "text-primary" : "text-muted-foreground",
                                        )}>
                                            {formatHour(hourIdx)}
                                        </span>
                                        <div className="flex-1 h-px bg-border/30" />
                                        <span className="text-[10px] text-muted-foreground/50 font-mono">{postCount} posts</span>
                                    </div>

                                    {/* Full analysis for this hour */}
                                    {analysis && postCount > 0 && (
                                        <div className="mb-3 mx-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Sparkles className="w-3 h-3 text-primary" />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">AI Summary</span>
                                            </div>
                                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
                                            {/* Hashtag pills */}
                                            {analysis.hashtags && analysis.hashtags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {analysis.hashtags.map((tag: string) => (
                                                        <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary/70 rounded-full text-[9px] font-bold">
                                                            <Hash className="w-2.5 h-2.5" />
                                                            {tag.replace('#', '')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Post grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-3 pb-3">
                                        {hourPosts.map(post => (
                                            <PostCard key={post.id} post={post} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </main>

                    {/* ZONE 3: Account Directory */}
                    <aside className="lg:col-span-3 space-y-6">
                        <div className="sticky top-6 space-y-6">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3 text-muted-foreground">
                                    Active Sources ({derivedAccounts.length})
                                </h3>
                                <div className="space-y-2">
                                    {derivedAccounts
                                        .sort((a, b) => b.post_count - a.post_count)
                                        .map(account => (
                                            <AccountCard
                                                key={account.id}
                                                name={account.display_name}
                                                avatar={account.avatar_url}
                                                postCount={account.post_count}
                                            />
                                        ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
