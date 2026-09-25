'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Hash,
    Plus,
    Trash2,
    Eye,
    Heart,
    CheckCircle2,
    Play,
    Pause,
    RefreshCw,
    Sliders,
    Search,
    Zap,
    ExternalLink,
    Clock,
    Edit3,
    X,
    Activity,
    Database,
    BarChart2,
    MoreHorizontal,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { TikTokIcon } from '@/components/BrandIcons';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { getFirestoreConsoleUrl } from '@/lib/constants';
import {
    formatIdr,
    formatUsd,
    computeHashtagUnitCost,
    USD_TO_IDR,
    APIFY_STARTER_MONTHLY_CREDITS_USD,
} from '@/lib/tiktokCostEngine';
import { toast } from 'sonner';
import type { TrackedHashtag, HashtagPulseStats } from '@/types/tiktokHashtags';

interface TrackedHashtagWithCost extends TrackedHashtag {
    cost: {
        totalPerCrawlUsd: number;
        dailyCostUsd: number;
        monthlyCostUsd: number;
        dailyCostIdr: number;
        monthlyCostIdr: number;
        estimatedItemsPerCrawl: number;
    };
    latest_stats?: HashtagPulseStats | null;
}

interface HashtagsApiResponse {
    success: boolean;
    tracked_hashtags: TrackedHashtagWithCost[];
    cost_forecast: {
        totalTags: number;
        activeTags: number;
        dailyCostUsd: number;
        monthlyCostUsd: number;
        dailyCostIdr: number;
        monthlyCostIdr: number;
        dailyItemsScraped: number;
        monthlyItemsScraped: number;
        percentOfStarterCredits: number;
        creditsStatus: 'safe' | 'warning' | 'overage';
    };
    excluded_hashtags: string[];
    updated_at?: string;
}

const CADENCE_OPTIONS = [
    { value: 1, label: '1x / hari', desc: 'Daily Sweep' },
    { value: 2, label: '2x / hari', desc: '11:00 & 18:00' },
    { value: 3, label: '3x / hari', desc: '3 Windows' },
    { value: 4, label: '4x / hari', desc: '6-Hour Pulse' },
];

const DEPTH_OPTIONS = [
    { value: 20, label: '20 posts' },
    { value: 40, label: '40 posts' },
    { value: 80, label: '80 posts' },
    { value: 100, label: '100 posts' },
];

const START_HOUR_OPTIONS = [
    { value: 18, label: '18:00 WIB (Recommended - Prime Evening Sales)' },
    { value: 11, label: '11:00 WIB (Morning Box Office Trajectory)' },
    { value: 14, label: '14:00 WIB (Afternoon Matinee Spike)' },
    { value: 21, label: '21:00 WIB (Primetime Screening Spike)' },
    { value: 23, label: '23:00 WIB (End-of-Day Social Recap)' },
    ...Array.from({ length: 24 }, (_, i) => i)
        .filter((h) => ![18, 11, 14, 21, 23].includes(h))
        .sort((a, b) => a - b)
        .map((h) => ({
            value: h,
            label: `${h.toString().padStart(2, '0')}:00 WIB`,
        })),
];

export default function CustomHashtagTrackerPage() {
    const { data: session } = useSession();
    const isAdmin = (session as unknown as { user?: { role?: string } })?.user?.role === 'admin';
    const todayJakarta = getTodayJakarta();

    const { data, mutate, isLoading } = useSWR<HashtagsApiResponse>(
        '/api/socials/tiktok/hashtags',
        fetcher
    );

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'campaign' | 'competitor' | 'meme' | 'talent' | 'general'>('all');

    // Add New Hashtag Form State
    const [newTag, setNewTag] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newCategory, setNewCategory] = useState<'campaign' | 'competitor' | 'meme' | 'talent' | 'general'>('campaign');
    const [newCadence, setNewCadence] = useState<number>(1);
    const [newTargetPosts, setNewTargetPosts] = useState<number>(40);
    const [newStartHour, setNewStartHour] = useState<number>(18);
    const [newIncludeComments, setNewIncludeComments] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Hashtag Modal State
    const [editingTag, setEditingTag] = useState<TrackedHashtagWithCost | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editCategory, setEditCategory] = useState<'campaign' | 'competitor' | 'meme' | 'talent' | 'general'>('campaign');
    const [editCadence, setEditCadence] = useState<number>(1);
    const [editTargetPosts, setEditTargetPosts] = useState<number>(40);
    const [editStartHour, setEditStartHour] = useState<number>(18);
    const [editIncludeComments, setEditIncludeComments] = useState<boolean>(true);
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);

    // Simulation State (What-If Adding New Hashtag/s)
    const [simAddTagsCount, setSimAddTagsCount] = useState<number>(1);
    const [simCadence, setSimCadence] = useState<number>(1);
    const [simPostsPerTag, setSimPostsPerTag] = useState<number>(40);
    const [simIncludeComments] = useState<boolean>(true);

    const forecast = data?.cost_forecast;

    // Filtered list
    const filteredTags = useMemo(() => {
        const tags = data?.tracked_hashtags || [];
        return tags.filter((t) => {
            const matchesQuery =
                t.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.label.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = categoryFilter === 'all' || t.category === categoryFilter;
            return matchesQuery && matchesCat;
        });
    }, [data?.tracked_hashtags, searchQuery, categoryFilter]);

    // Live cost preview for Add Form
    const currentFormCost = useMemo(() => {
        return computeHashtagUnitCost({
            postsPerCrawl: newTargetPosts,
            includeComments: newIncludeComments,
            crawlsPerDay: newCadence,
        });
    }, [newTargetPosts, newIncludeComments, newCadence]);

    // Live cost preview for Edit Form
    const editFormCost = useMemo(() => {
        return computeHashtagUnitCost({
            postsPerCrawl: editTargetPosts,
            includeComments: editIncludeComments,
            crawlsPerDay: editCadence,
        });
    }, [editTargetPosts, editIncludeComments, editCadence]);

    // Simulation calculations: incremental impact on top of current baseline
    const simulationResult = useMemo(() => {
        const unit = computeHashtagUnitCost({
            postsPerCrawl: simPostsPerTag,
            includeComments: simIncludeComments,
            crawlsPerDay: simCadence,
        });

        const additionalDailyUsd = unit.dailyCostUsd * simAddTagsCount;
        const additionalMonthlyUsd = unit.monthlyCostUsd * simAddTagsCount;
        const additionalDailyIdr = Math.round(additionalDailyUsd * USD_TO_IDR);
        const additionalMonthlyIdr = Math.round(additionalMonthlyUsd * USD_TO_IDR);
        const additionalItemsScraped = unit.estimatedItemsPerCrawl * simCadence * simAddTagsCount * 30;

        const currentMonthlyUsd = forecast?.monthlyCostUsd ?? 0;
        const projectedTotalMonthlyUsd = currentMonthlyUsd + additionalMonthlyUsd;
        const projectedTotalMonthlyIdr = Math.round(projectedTotalMonthlyUsd * USD_TO_IDR);

        const projectedCreditsPct =
            APIFY_STARTER_MONTHLY_CREDITS_USD > 0
                ? Math.round((projectedTotalMonthlyUsd / APIFY_STARTER_MONTHLY_CREDITS_USD) * 100)
                : 0;

        return {
            unit,
            additionalDailyUsd,
            additionalMonthlyUsd,
            additionalDailyIdr,
            additionalMonthlyIdr,
            additionalItemsScraped,
            projectedTotalMonthlyUsd,
            projectedTotalMonthlyIdr,
            projectedCreditsPct,
        };
    }, [simAddTagsCount, simCadence, simPostsPerTag, simIncludeComments, forecast?.monthlyCostUsd]);

    // Active Toggle Handler
    const handleToggleActive = async (tag: TrackedHashtagWithCost) => {
        try {
            const res = await fetch('/api/socials/tiktok/hashtags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tag.id, active: !tag.active }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Hashtag #${tag.tag} is now ${!tag.active ? 'active' : 'paused'}`);
                mutate();
            } else {
                toast.error(result.error || 'Failed to update hashtag');
            }
        } catch {
            toast.error('Network error updating hashtag');
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (tag: TrackedHashtagWithCost) => {
        setEditingTag(tag);
        setEditLabel(tag.label);
        setEditCategory(tag.category);
        setEditCadence(tag.cadence ?? 1);
        setEditTargetPosts(tag.target_posts ?? 40);
        setEditStartHour(tag.start_hour ?? 18);
        setEditIncludeComments(tag.include_comments ?? true);
    };

    // Save Edit Handler
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTag) return;

        setIsEditSubmitting(true);
        try {
            const res = await fetch('/api/socials/tiktok/hashtags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTag.id,
                    label: editLabel,
                    category: editCategory,
                    cadence: editCadence,
                    target_posts: editTargetPosts,
                    start_hour: editStartHour,
                    include_comments: editIncludeComments,
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Updated settings for #${editingTag.tag}`);
                setEditingTag(null);
                mutate();
            } else {
                toast.error(result.error || 'Failed to update hashtag');
            }
        } catch {
            toast.error('Network error updating hashtag');
        } finally {
            setIsEditSubmitting(false);
        }
    };

    // Delete Handler
    const handleDeleteTag = async (tagId: string, tagName: string) => {
        if (!confirm(`Are you sure you want to stop tracking #${tagName}?`)) return;
        try {
            const res = await fetch(`/api/socials/tiktok/hashtags?id=${tagId}`, {
                method: 'DELETE',
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Removed #${tagName} from tracking`);
                mutate();
            } else {
                toast.error(result.error || 'Failed to delete hashtag');
            }
        } catch {
            toast.error('Network error deleting hashtag');
        }
    };

    // Add Tag Handler
    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = newTag.replace(/^#/, '').toLowerCase().trim();
        if (!clean) {
            toast.error('Please enter a valid hashtag');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/socials/tiktok/hashtags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: clean,
                    label: newLabel || clean,
                    category: newCategory,
                    cadence: newCadence,
                    target_posts: newTargetPosts,
                    start_hour: newStartHour,
                    include_comments: newIncludeComments,
                    active: true,
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Hashtag #${clean} added to daily tracking`);
                setNewTag('');
                setNewLabel('');
                mutate();
            } else {
                toast.error(result.error || 'Failed to add hashtag');
            }
        } catch {
            toast.error('Network error creating hashtag');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dry-run Test Handler
    const [testingTag, setTestingTag] = useState<string | null>(null);
    const handleTestRun = async (tag: string) => {
        setTestingTag(tag);
        try {
            const res = await fetch('/api/socials/tiktok/hashtags/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag, dryRun: true }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(result.message);
                mutate();
            } else {
                toast.error(result.error || 'Run failed');
            }
        } catch {
            toast.error('Network error running test');
        } finally {
            setTestingTag(null);
        }
    };

    // Live On-Demand Scrape Handler
    const [scrapingLiveTag, setScrapingLiveTag] = useState<string | null>(null);
    const handleScrapeLive = async (tag: string) => {
        setScrapingLiveTag(tag);
        toast.info(`Initiating live Apify scrape for #${tag}...`);
        try {
            const res = await fetch('/api/socials/tiktok/hashtags/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag, force: false, dryRun: false }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(result.message || `Live crawl completed for #${tag}!`);
                mutate();
            } else if (result.cooldown) {
                toast.error(result.error);
            } else {
                toast.error(result.error || 'Live scrape failed');
            }
        } catch {
            toast.error('Network error during live scrape');
        } finally {
            setScrapingLiveTag(null);
        }
    };

    return (
        <div className="p-6 space-y-6 w-full">
            {/* Standard CineRadar Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shrink-0">
                        <TikTokIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-foreground">Hashtag Tracker</h1>
                            <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-500">
                                Social Pulse
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">
                            Multi-cadence promotional campaigns, competitor stunts &amp; real-time IDR cost management
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60 text-sm">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-foreground">{forecast?.activeTags ?? 0} Active</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono text-muted-foreground">{formatIdr(forecast?.dailyCostIdr ?? 0)}/hari</span>
                    </div>

                </div>
            </div>

            {/* Split 2-Column Layout: Left (2/3) & Right (1/3) with Full Horizontal Expansion */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                {/* Left Side: 2/3 Width (Tracked Hashtags & Stats) */}
                <div className="lg:col-span-8 space-y-4 w-full">
                    <Card className="border-border/60 bg-card overflow-hidden">
                        <CardHeader className="p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-primary" />
                                <CardTitle className="text-sm font-bold text-foreground">
                                    Tracked Hashtags ({filteredTags.length})
                                </CardTitle>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative w-48 sm:w-64">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search tag or label..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 pl-8 text-sm rounded-lg"
                                    />
                                </div>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm font-semibold shadow-sm"
                                >
                                    <option value="all">All Categories</option>
                                    <option value="campaign">Campaign</option>
                                    <option value="competitor">Competitor</option>
                                    <option value="meme">Meme/Trend</option>
                                    <option value="talent">Talent</option>
                                    <option value="general">General</option>
                                </select>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-16 text-center text-sm text-muted-foreground">
                                    Loading tracked custom hashtags &amp; telemetry...
                                </div>
                            ) : filteredTags.length === 0 ? (
                                <div className="p-16 text-center space-y-2">
                                    <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                                    <div className="text-sm font-bold text-foreground">No Custom Hashtags Found</div>
                                    <div className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Use the form on the right to configure and begin tracking your first custom hashtag.
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold uppercase text-[10px]">
                                            <tr>
                                                <th className="py-2.5 px-4">Hashtag</th>
                                                <th className="py-2.5 px-3">Category</th>
                                                <th className="py-2.5 px-3">Schedule &amp; Depth</th>
                                                <th className="py-2.5 px-3">Est. Unit Cost (IDR)</th>
                                                <th className="py-2.5 px-3">Latest Telemetry</th>
                                                <th className="py-2.5 px-3">Status</th>
                                                <th className="py-2.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {filteredTags.map((t) => {
                                                const statsDate = t.latest_stats?.crawled_at
                                                    ? t.latest_stats.crawled_at.split('T')[0]
                                                    : todayJakarta;
                                                const firestoreUrl = getFirestoreConsoleUrl('tiktok_tracked_hashtags', t.tag);

                                                return (
                                                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <Link
                                                                    href={`/tiktok/hashtags/results/${t.tag}?date=${statsDate}`}
                                                                    className="font-mono font-bold text-foreground text-sm hover:text-primary hover:underline transition-colors"
                                                                    title={`View intelligence results for #${t.tag}`}
                                                                >
                                                                    #{t.tag}
                                                                </Link>
                                                                <a
                                                                    href={`https://www.tiktok.com/tag/${t.tag}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-muted-foreground hover:text-primary transition-colors"
                                                                    title={`Open #${t.tag} on TikTok`}
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            </div>
                                                            {isAdmin && (
                                                                <div className="mt-0.5">
                                                                    <a
                                                                        href={firestoreUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-amber-500/80 hover:text-amber-500 hover:underline transition-colors"
                                                                        title={`Open Firestore: tiktok_tracked_hashtags/${t.tag}`}
                                                                    >
                                                                        <Database className="w-2.5 h-2.5" />
                                                                        <span>Firestore</span>
                                                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </td>

                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[10px] font-semibold capitalize"
                                                        >
                                                            {t.category}
                                                        </Badge>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <div className="font-medium text-foreground">
                                                            {t.target_posts} posts · {t.cadence ?? 1}x/hari
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Clock className="w-3 h-3" />
                                                            {(t.start_hour ?? 18).toString().padStart(2, '0')}:00 WIB
                                                            {t.include_comments && ' (+ comments)'}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <div className="font-bold text-foreground">
                                                            {formatIdr(t.cost.dailyCostIdr)} / hari
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono">
                                                            ~{formatIdr(t.cost.monthlyCostIdr)}/bln ({formatUsd(t.cost.monthlyCostUsd)})
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        {t.latest_stats ? (
                                                            <div className="space-y-0.5">
                                                                <div className="flex items-center gap-2 font-bold text-foreground">
                                                                    <span className="flex items-center gap-1">
                                                                        <Eye className="w-3 h-3 text-primary" />
                                                                        {(t.latest_stats.total_views || 0).toLocaleString()}
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-[11px]">
                                                                        <Heart className="w-2.5 h-2.5 text-rose-500" />
                                                                        {(t.latest_stats.total_likes || 0).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                {t.latest_stats.sentiment && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] font-bold border-emerald-500/30 text-emerald-500"
                                                                    >
                                                                        {t.latest_stats.sentiment.positive}% Positive
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="font-mono text-muted-foreground text-[11px]">
                                                                Pending crawl
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant={t.active ? 'default' : 'outline'}
                                                            className={`text-[10px] font-bold uppercase ${
                                                                t.active
                                                                    ? 'bg-emerald-500 hover:bg-emerald-600'
                                                                    : 'text-muted-foreground border-muted-foreground/40'
                                                            }`}
                                                        >
                                                            {t.active ? 'Active' : 'Paused'}
                                                        </Badge>
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {/* Primary Action: View Results */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                asChild
                                                                className="h-8 px-2.5 text-sm font-semibold rounded-lg border-border/60 hover:bg-muted gap-1.5"
                                                                title={`View intelligence results for #${t.tag}`}
                                                            >
                                                                <Link href={`/tiktok/hashtags/results/${t.tag}`}>
                                                                    <BarChart2 className="w-3.5 h-3.5 text-primary" />
                                                                    <span>Results</span>
                                                                </Link>
                                                            </Button>

                                                            {/* Secondary Action: Scrape Live */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={scrapingLiveTag === t.tag}
                                                                onClick={() => handleScrapeLive(t.tag)}
                                                                className="h-8 px-2.5 text-sm font-semibold rounded-lg border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 gap-1.5"
                                                                title="Scrape Live Now (Real Apify & Gemini)"
                                                            >
                                                                <Zap
                                                                    className={`w-3.5 h-3.5 ${
                                                                        scrapingLiveTag === t.tag ? 'animate-spin' : ''
                                                                    }`}
                                                                />
                                                                <span>{scrapingLiveTag === t.tag ? 'Scraping...' : 'Scrape'}</span>
                                                            </Button>

                                                            {/* Overflow Menu: Administrative & Utility Actions */}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                                                        title="More actions"
                                                                    >
                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                        <span className="sr-only">More options for #{t.tag}</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48 bg-card border border-border/80 shadow-lg">
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleToggleActive(t)}
                                                                        className="gap-2 text-sm cursor-pointer"
                                                                    >
                                                                        {t.active ? (
                                                                            <>
                                                                                <Pause className="w-3.5 h-3.5 text-amber-500" />
                                                                                <span>Pause Tracking</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Play className="w-3.5 h-3.5 text-emerald-500" />
                                                                                <span>Resume Tracking</span>
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        onClick={() => handleOpenEdit(t)}
                                                                        className="gap-2 text-sm cursor-pointer"
                                                                    >
                                                                        <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        <span>Edit Parameters</span>
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        disabled={testingTag === t.tag}
                                                                        onClick={() => handleTestRun(t.tag)}
                                                                        className="gap-2 text-sm cursor-pointer"
                                                                    >
                                                                        <RefreshCw
                                                                            className={`w-3.5 h-3.5 text-muted-foreground ${
                                                                                testingTag === t.tag ? 'animate-spin' : ''
                                                                            }`}
                                                                        />
                                                                        <span>Run Test (Dry-Run)</span>
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuSeparator className="bg-border/60" />

                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDeleteTag(t.id, t.tag)}
                                                                        className="gap-2 text-sm cursor-pointer text-rose-500 focus:text-rose-600 focus:bg-rose-500/10 hover:bg-rose-500/10"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                                                        <span>Remove Hashtag</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: 1/3 Width (Top to Bottom Stack) */}
                <div className="lg:col-span-4 space-y-5 w-full">
                    {/* 1. Adding New Hashtag */}
                    <Card className="border-border/60 bg-card shadow-sm">
                        <CardHeader className="p-4 pb-2 border-b border-border/40">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                <Plus className="w-4 h-4 text-primary" />
                                Add Tracked Hashtag
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Configure a custom hashtag. Defaults are pre-filled by best practices.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 pt-3">
                            <form onSubmit={handleCreateTag} className="space-y-3.5">
                                <div>
                                    <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                        Hashtag Name (without #)
                                    </label>
                                    <Input
                                        placeholder="e.g. filmindonesia2026"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        required
                                        className="h-8 font-mono text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Campaign Label
                                        </label>
                                        <Input
                                            placeholder="Optional tag label"
                                            value={newLabel}
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
                                        >
                                            <option value="campaign">Campaign</option>
                                            <option value="competitor">Competitor</option>
                                            <option value="meme">Meme/Trend</option>
                                            <option value="talent">Talent</option>
                                            <option value="general">General</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Cadence
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {CADENCE_OPTIONS.map((c) => (
                                                <Button
                                                    key={c.value}
                                                    type="button"
                                                    variant={newCadence === c.value ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="h-7 text-[11px] px-1 font-semibold"
                                                    onClick={() => setNewCadence(c.value)}
                                                >
                                                    {c.value}x / hari
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Scrape Depth
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {DEPTH_OPTIONS.map((d) => (
                                                <Button
                                                    key={d.value}
                                                    type="button"
                                                    variant={newTargetPosts === d.value ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="h-7 text-[11px] px-1 font-semibold"
                                                    onClick={() => setNewTargetPosts(d.value)}
                                                >
                                                    {d.value} posts
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                        Start Timer (24-Hour WIB)
                                    </label>
                                    <select
                                        value={newStartHour}
                                        onChange={(e) => setNewStartHour(Number(e.target.value))}
                                        className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm"
                                    >
                                        {START_HOUR_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center justify-between bg-muted/20 p-2.5 rounded-lg border border-border/50 text-sm">
                                    <div>
                                        <div className="font-semibold text-foreground">Audience Sentiment</div>
                                        <div className="text-[10px] text-muted-foreground">30 comments + Gemini AI</div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant={newIncludeComments ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-6 px-2.5 text-[11px] font-bold"
                                        onClick={() => setNewIncludeComments(!newIncludeComments)}
                                    >
                                        {newIncludeComments ? 'Enabled' : 'Disabled'}
                                    </Button>
                                </div>

                                {/* Live Cost Preview for this tag */}
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-sm space-y-1">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-muted-foreground">Biaya Tambahan:</span>
                                        <strong className="text-primary font-bold">
                                            {formatIdr(currentFormCost.dailyCostIdr)} / hari
                                        </strong>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex justify-between">
                                        <span>Proyeksi Bulanan:</span>
                                        <span className="font-medium text-foreground">
                                            {formatIdr(currentFormCost.monthlyCostIdr)} / bln ({formatUsd(currentFormCost.monthlyCostUsd)})
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-8 text-sm font-bold gap-1.5"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Save &amp; Track Hashtag
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* 2. Current Total API Burnrate */}
                    <Card className="border-border/60 bg-card shadow-sm">
                        <CardHeader className="p-4 pb-2 border-b border-border/40">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <Activity className="w-4 h-4 text-amber-500" />
                                    Current Total API Burnrate
                                </CardTitle>
                                <Badge
                                    variant="outline"
                                    className={`text-[9px] font-bold uppercase ${
                                        forecast?.creditsStatus === 'safe'
                                            ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                            : forecast?.creditsStatus === 'warning'
                                            ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                                            : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                                    }`}
                                >
                                    {forecast?.creditsStatus ?? 'safe'}
                                </Badge>
                            </div>
                            <CardDescription className="text-sm">
                                Live operational expenditure across all active custom hashtags.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3.5 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/20 p-2.5 rounded-lg border border-border/40">
                                    <span className="text-muted-foreground block text-[11px]">Daily Burn</span>
                                    <span className="font-black text-sm text-foreground">
                                        {formatIdr(forecast?.dailyCostIdr ?? 0)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block font-mono">
                                        / hari ({formatUsd(forecast?.dailyCostUsd ?? 0)})
                                    </span>
                                </div>

                                <div className="bg-muted/20 p-2.5 rounded-lg border border-border/40">
                                    <span className="text-muted-foreground block text-[11px]">30-Day Projected</span>
                                    <span className="font-black text-sm text-emerald-500">
                                        {formatIdr(forecast?.monthlyCostIdr ?? 0)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block font-mono">
                                        / bln ({formatUsd(forecast?.monthlyCostUsd ?? 0)})
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Starter Allowance ($29 / Rp 507.500)</span>
                                    <strong className="text-foreground font-mono">{forecast?.percentOfStarterCredits ?? 0}%</strong>
                                </div>
                                <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            forecast?.creditsStatus === 'safe'
                                                ? 'bg-emerald-500'
                                                : forecast?.creditsStatus === 'warning'
                                                ? 'bg-amber-500'
                                                : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${Math.min(100, forecast?.percentOfStarterCredits ?? 0)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                                <span>Active Tags: <strong className="text-foreground">{forecast?.activeTags ?? 0}</strong> of {forecast?.totalTags ?? 0}</span>
                                <span>Volume: <strong className="text-foreground">{forecast?.dailyItemsScraped ?? 0}</strong> items / hari</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Simulation of Adding New Hashtag/s */}
                    <Card className="border-border/60 bg-card shadow-sm">
                        <CardHeader className="p-4 pb-2 border-b border-border/40">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <Sliders className="w-4 h-4 text-primary" />
                                    Capacity &amp; Impact Simulator
                                </CardTitle>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                    What-If Analysis
                                </Badge>
                            </div>
                            <CardDescription className="text-sm">
                                Simulate adding new hashtags and evaluate budget impact before deploying.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3.5 text-sm">
                            <div>
                                <div className="flex justify-between text-[11px] font-semibold mb-1">
                                    <span>Simulate Adding Tags:</span>
                                    <span className="text-primary font-bold">+{simAddTagsCount} hashtag{simAddTagsCount > 1 ? 's' : ''}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={simAddTagsCount}
                                    onChange={(e) => setSimAddTagsCount(Number(e.target.value))}
                                    className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                        Cadence
                                    </label>
                                    <div className="grid grid-cols-2 gap-1">
                                        {[1, 2, 3, 4].map((num) => (
                                            <Button
                                                key={num}
                                                type="button"
                                                variant={simCadence === num ? 'default' : 'outline'}
                                                size="sm"
                                                className="h-6 text-[11px] px-1 font-semibold"
                                                onClick={() => setSimCadence(num)}
                                            >
                                                {num}x / hari
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                        Scrape Depth
                                    </label>
                                    <div className="grid grid-cols-2 gap-1">
                                        {[20, 40, 80, 100].map((num) => (
                                            <Button
                                                key={num}
                                                type="button"
                                                variant={simPostsPerTag === num ? 'default' : 'outline'}
                                                size="sm"
                                                className="h-6 text-[11px] px-1 font-semibold"
                                                onClick={() => setSimPostsPerTag(num)}
                                            >
                                                {num}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Simulated Cost Impact Output */}
                            <div className="bg-muted/20 p-3 rounded-lg border border-border/40 space-y-2">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-muted-foreground">Incremental Daily:</span>
                                    <strong className="text-foreground font-bold">
                                        +{formatIdr(simulationResult.additionalDailyIdr)} / hari
                                    </strong>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-muted-foreground">Incremental Monthly:</span>
                                    <strong className="text-emerald-500 font-bold">
                                        +{formatIdr(simulationResult.additionalMonthlyIdr)} / bln
                                    </strong>
                                </div>
                                <div className="border-t border-border/40 pt-1.5 flex justify-between items-center text-[11px]">
                                    <span className="text-foreground font-semibold">New Projected Total:</span>
                                    <strong className="text-primary font-bold">
                                        {formatIdr(simulationResult.projectedTotalMonthlyIdr)} / bln
                                    </strong>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex justify-between">
                                    <span>New Credit Usage:</span>
                                    <span className="font-mono">{simulationResult.projectedCreditsPct}% of $29 tier</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Hashtag Modal */}
            {editingTag && (
                <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
                    <Card className="border-border bg-card w-full max-w-lg shadow-xl">
                        <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-primary" />
                                    Edit Tracking Settings: #{editingTag.tag}
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    Update cadence, scrape depth, and start timer for this hashtag.
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingTag(null)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4">
                            <form onSubmit={handleSaveEdit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                        Campaign / Descriptive Label
                                    </label>
                                    <Input
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value as typeof editCategory)}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm"
                                        >
                                            <option value="campaign">Movie Campaign</option>
                                            <option value="competitor">Competitor Brand</option>
                                            <option value="meme">Viral Meme / Trend</option>
                                            <option value="talent">Director / Actor Stunt</option>
                                            <option value="general">General Film Topic</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Start Timer (WIB)
                                        </label>
                                        <select
                                            value={editStartHour}
                                            onChange={(e) => setEditStartHour(Number(e.target.value))}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm"
                                        >
                                            {START_HOUR_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Cadence (Runs / Hari)
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[1, 2, 3, 4].map((num) => (
                                                <Button
                                                    key={num}
                                                    type="button"
                                                    variant={editCadence === num ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="h-7 text-sm font-bold"
                                                    onClick={() => setEditCadence(num)}
                                                >
                                                    {num}x / hari
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground block mb-1">
                                            Scrape Depth
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[20, 40, 80, 100].map((num) => (
                                                <Button
                                                    key={num}
                                                    type="button"
                                                    variant={editTargetPosts === num ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="h-7 text-sm font-bold"
                                                    onClick={() => setEditTargetPosts(num)}
                                                >
                                                    {num} posts
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-muted/20 p-2.5 rounded-lg border border-border/50 text-sm">
                                    <span className="font-semibold text-foreground">Audience Sentiment (Gemini 3.8)</span>
                                    <Button
                                        type="button"
                                        variant={editIncludeComments ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-6 px-2.5 text-[11px] font-bold"
                                        onClick={() => setEditIncludeComments(!editIncludeComments)}
                                    >
                                        {editIncludeComments ? 'Enabled' : 'Disabled'}
                                    </Button>
                                </div>

                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-sm flex justify-between items-center">
                                    <span className="text-muted-foreground">New Estimated Cost:</span>
                                    <strong className="text-primary font-bold">
                                        {formatIdr(editFormCost.dailyCostIdr)} / hari ({formatIdr(editFormCost.monthlyCostIdr)} / bln)
                                    </strong>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-sm"
                                        onClick={() => setEditingTag(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isEditSubmitting}
                                        className="h-8 text-sm font-bold px-4"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
