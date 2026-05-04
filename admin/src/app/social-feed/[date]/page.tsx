/**
 * Industry Feed — YouTube + AI Hourly Analysis
 *
 * Date-navigable timeline with backfill support.
 * Loads persisted data from Firestore (via /api/social-feed/data).
 * Backfill trigger via /api/social-feed/backfill.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/api';
import {
    ACCOUNTS,
    CONTENT_TYPE_LABELS,
    type SocialAccount,
    type AccountCategory,
    type ContentType,
} from '@/features/social-pulse/data/mockSocialFeed';
import { YouTubeIcon } from '@/components/BrandIcons';
import {
    type FirestoreYouTubeVideo,
    type FirestoreHourlyAnalysis,
    formatHour,
    groupVideosByHour,
} from '@/lib/firestore-youtube';

// ─── Category labels ──────────────────────────────────

const CATEGORY_LABELS: Record<AccountCategory, { label: string; color: string }> = {
    critic: { label: 'Critics', color: 'text-amber-500' },
    cinema_chain: { label: 'Cinema Chains', color: 'text-green-500' },
    distributor: { label: 'Distributors', color: 'text-blue-500' },
    community: { label: 'Community', color: 'text-purple-500' },
};

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
    return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }); // "2026-05-05"
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
        videos: FirestoreYouTubeVideo[];
        analyses: FirestoreHourlyAnalysis[];
        video_count: number;
        analysis_count: number;
    };
}

// ─── Post Card ─────────────────────────────────────────

function PostCard({ post }: { post: FirestoreYouTubeVideo }) {
    const typeConfig = CONTENT_TYPE_LABELS[post.content_type as ContentType] || CONTENT_TYPE_LABELS.community;
    const TypeIcon = CONTENT_ICONS[post.content_type as ContentType] || CONTENT_ICONS.community;
    const account = ACCOUNTS.find(a => a.display_name === post.channel_title);

    return (
        <a
            href={post.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-background/50 border border-border/40 rounded-2xl hover:bg-muted/30 hover:border-border/60 transition-all duration-300 overflow-hidden"
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
                </div>
            )}

            <div className="p-3 space-y-2">
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
                        <span className="text-[11px] font-bold truncate">{post.channel_title}</span>
                        {account?.verified && <CheckCircle2 className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                    </div>
                </div>
                <p className="text-[12px] font-semibold leading-snug text-foreground line-clamp-2">
                    {post.title}
                </p>
            </div>
        </a>
    );
}

// ─── Account Card ──────────────────────────────────────

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

// ─── Page ──────────────────────────────────────────────

export default function SocialFeedPage() {
    const router = useRouter();
    const params = useParams();
    const today = useMemo(() => getJakartaToday(), []);
    const selectedDate = (params.date as string) || today;
    const [backfilling, setBackfilling] = useState(false);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);

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
        done?: boolean;
        error?: string;
        videos_written?: number;
        analyses_written?: number;
    } | null>(null);

    const updateProgress = (update: Partial<typeof progress> & { phase: string; message: string }) => {
        setProgress(prev => prev ? { ...prev, ...update } : update);
    };

    // Reset progress when navigating to a different date
    useEffect(() => {
        setProgress(null);
        setBackfilling(false);
    }, [selectedDate]);

    // Fetch persisted data for selected date
    const { data: responseData, isLoading, mutate } = useSWR<DataResponse>(
        `/api/social-feed/data?date=${selectedDate}`,
        fetcher,
    );

    const data = responseData?.data;
    const videos = data?.videos || [];
    const analyses = data?.analyses || [];
    const hasData = data?.has_data || false;

    // Group videos by hour
    const hourGroups = useMemo(() => groupVideosByHour(videos), [videos]);

    // Build analysis map for quick lookup (sorted by hour ascending)
    const analysisMap = useMemo(() => {
        const map = new Map<number, FirestoreHourlyAnalysis>();
        [...analyses].sort((a, b) => a.hour - b.hour).forEach(a => map.set(a.hour, a));
        return map;
    }, [analyses]);

    // Compute account data from videos
    const enrichedAccounts = useMemo(() => {
        const avatarMap = new Map<string, string>();
        const subsMap = new Map<string, string>();
        for (const v of videos) {
            if (v.channel_avatar && !avatarMap.has(v.channel_title)) {
                avatarMap.set(v.channel_title, v.channel_avatar);
            }
        }
        return ACCOUNTS.map(a => ({
            ...a,
            avatar_url: avatarMap.get(a.display_name) || a.avatar_url,
            follower_count: subsMap.get(a.display_name) || a.follower_count,
        }));
    }, [videos]);

    const accountsByCategory = useMemo(() => {
        const grouped: Record<AccountCategory, SocialAccount[]> = {
            critic: [], cinema_chain: [], distributor: [], community: [],
        };
        enrichedAccounts.forEach(a => grouped[a.category].push(a));
        return grouped;
    }, [enrichedAccounts]);

    const getPostCount = (accountId: string) => videos.filter(v => {
        const account = ACCOUNTS.find(a => a.id === accountId);
        return account && v.channel_title === account.display_name;
    }).length;

    // Backfill handler — consumes SSE stream
    const handleBackfill = useCallback(async () => {
        setBackfilling(true);
        setProgress({ phase: 'starting', message: 'Connecting...' });

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

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete last line

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
                                    lastSummary: data.summary,
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
                                mutate(); // Refresh data
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
        if (!confirm(`Delete all data for ${formatDate(selectedDate)}?\n\nThis removes ${videos.length} videos and ${analyses.length} analyses from Firestore.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/social-feed/data?date=${selectedDate}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                mutate(); // Refresh — will show "no data" state
            } else {
                console.error('Delete failed:', result.error);
            }
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setDeleting(false);
        }
    }, [selectedDate, videos.length, analyses.length, mutate]);

    // Date navigation
    const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
    const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
    const canGoForward = addDays(selectedDate, 1) <= today;

    // Content type counts
    const contentTypeCounts = useMemo(() => {
        const counts: Record<ContentType, number> = { trailer: 0, review: 0, short: 0, promo: 0, community: 0 };
        videos.forEach(v => {
            const ct = v.content_type as ContentType;
            if (ct in counts) counts[ct]++;
        });
        return counts;
    }, [videos]);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
            {/* ─── Header + Date Navigation ─────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                        <YouTubeIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black uppercase tracking-tighter">Industry Feed</h1>
                            <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-black text-muted-foreground uppercase tracking-tight">YouTube + AI</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {hasData
                                ? <><span className="text-foreground font-bold">{videos.length}</span> videos • <span className="text-foreground font-bold">{analyses.length}</span> hourly analyses</>
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

            {/* ─── Backfill Bar (shown when no data) ──────────── */}
            {!hasData && !isLoading && !backfilling && !progress?.done && (
                <div className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <Download className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold">No data for {formatDate(selectedDate)}</p>
                        <p className="text-xs text-muted-foreground">Click backfill to fetch YouTube uploads and generate AI analysis for this date.</p>
                    </div>
                    <Button
                        onClick={handleBackfill}
                        disabled={backfilling}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        <><Download className="w-4 h-4 mr-2" />Backfill {formatDate(selectedDate)}</>
                    </Button>
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
                                    Channel {progress.channelIndex}/{progress.totalChannels}: {progress.channel}
                                </p>
                            )}
                            {progress.phase === 'analyzing' && (
                                <p className="text-xs text-muted-foreground">
                                    Hour {progress.completedHours}/{progress.totalHours}
                                    {progress.totalVideos !== undefined && ` • ${progress.totalVideos} videos found`}
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

                    {/* Last summary preview */}
                    {progress.lastSummary && progress.phase === 'analyzing' && (
                        <div className="p-3 bg-muted/20 rounded-xl border border-border/20">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Latest AI Summary</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{progress.lastSummary}</p>
                        </div>
                    )}

                    {/* Done summary */}
                    {progress.done && (
                        <div className="flex items-center gap-4 text-xs">
                            <span className="text-green-600 font-bold">✓ {progress.videos_written} videos fetched</span>
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
                    <aside className="lg:col-span-2 space-y-4">
                        <div className="sticky top-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Pulse</h2>
                            </div>

                            <div className="space-y-1.5 max-h-[calc(100vh-180px)] overflow-y-auto">
                                {/* Hours with data */}
                                {[...Array(24)].map((_, h) => {
                                    const hourVideos = hourGroups.get(h) || [];
                                    const analysis = analysisMap.get(h);
                                    const hasVideos = hourVideos.length > 0;
                                    const isSelected = selectedHour === h;

                                    return (
                                        <button
                                            key={h}
                                            onClick={() => setSelectedHour(isSelected ? null : h)}
                                            className={cn(
                                                "w-full text-left p-2.5 rounded-xl transition-all duration-200",
                                                isSelected
                                                    ? "bg-primary/10 border border-primary/20"
                                                    : hasVideos
                                                        ? "bg-background/50 border border-border/20 hover:bg-muted/20 hover:border-border/40"
                                                        : "opacity-30",
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-mono font-bold tabular-nums">{formatHour(h)}</span>
                                                {hasVideos && (
                                                    <span className="text-[9px] font-mono font-bold text-muted-foreground">{hourVideos.length}</span>
                                                )}
                                            </div>
                                            {analysis && (
                                                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">
                                                    {analysis.summary}
                                                </p>
                                            )}
                                            {!hasVideos && !analysis && (
                                                <p className="text-[9px] text-muted-foreground/50 italic">No activity</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* ZONE 2: Visual Feed — hour-grouped */}
                    <main className="lg:col-span-7 space-y-6">
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

                        {/* Hour sections — descending from 23 to 0 */}
                        {[...Array(24)].map((_, h) => {
                            const hourIdx = 23 - h; // Reverse order
                            const hourVideos = selectedHour !== null
                                ? (hourGroups.get(selectedHour) || [])
                                : (hourGroups.get(hourIdx) || []);

                            // If a specific hour is selected, only show that
                            if (selectedHour !== null && hourIdx !== selectedHour) return null;
                            // Skip empty hours unless viewing all
                            if (selectedHour === null && hourVideos.length === 0) return null;

                            const analysis = analysisMap.get(selectedHour ?? hourIdx);

                            return (
                                <div key={hourIdx}>
                                    {/* Hour header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={cn(
                                            "text-sm font-mono font-black tabular-nums",
                                            selectedHour === hourIdx ? "text-primary" : "text-muted-foreground",
                                        )}>
                                            {formatHour(selectedHour ?? hourIdx)}
                                        </span>
                                        <div className="flex-1 h-px bg-border/30" />
                                        <span className="text-[10px] text-muted-foreground/50 font-mono">{hourVideos.length} videos</span>
                                    </div>

                                    {/* Full analysis for this hour */}
                                    {analysis && analysis.video_count > 0 && (
                                        <div className="mb-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Sparkles className="w-3 h-3 text-primary" />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">AI Summary</span>
                                            </div>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{analysis.summary}</p>
                                        </div>
                                    )}

                                    {/* Video grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {hourVideos.map(post => (
                                            <PostCard key={post.id} post={post} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty state when hour selected but no videos */}
                        {selectedHour !== null && (hourGroups.get(selectedHour) || []).length === 0 && (
                            <div className="py-12 text-center border border-dashed rounded-3xl border-border/40">
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No uploads at {formatHour(selectedHour)}</p>
                            </div>
                        )}
                    </main>

                    {/* ZONE 3: Account Directory */}
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
