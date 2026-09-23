'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Hash,
    Plus,
    Trash2,
    DollarSign,
    Sparkles,
    Flame,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    AlertTriangle,
    CheckCircle2,
    Play,
    Pause,
    RefreshCw,
    Sliders,
    Search,
    Calculator,
    Zap,
    ExternalLink
} from 'lucide-react';
import { fetcher } from '@/lib/api';
import { formatIdr, formatUsd, computeHashtagUnitCost, computeAggregateCost } from '@/lib/tiktokCostEngine';
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

export default function CustomHashtagTrackerPage() {
    const { data, mutate, isLoading } = useSWR<HashtagsApiResponse>(
        '/api/socials/tiktok/hashtags',
        fetcher
    );

    // Filter and search
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'campaign' | 'competitor' | 'meme' | 'talent' | 'general'>('all');

    // Add New Hashtag Form
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newCategory, setNewCategory] = useState<'campaign' | 'competitor' | 'meme' | 'talent' | 'general'>('campaign');
    const [newTargetPosts, setNewTargetPosts] = useState<number>(40);
    const [newIncludeComments, setNewIncludeComments] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Interactive Cost Simulator State
    const [simTagsCount, setSimTagsCount] = useState<number>(5);
    const [simPostsPerTag, setSimPostsPerTag] = useState<number>(40);
    const [simIncludeComments, setSimIncludeComments] = useState<boolean>(true);

    const simulatedCost = useMemo(() => {
        const unit = computeHashtagUnitCost({
            postsPerCrawl: simPostsPerTag,
            includeComments: simIncludeComments,
        });
        const dailyUsd = unit.dailyCostUsd * simTagsCount;
        const monthlyUsd = unit.monthlyCostUsd * simTagsCount;
        return {
            unit,
            dailyUsd,
            monthlyUsd,
            dailyIdr: Math.round(dailyUsd * 16000),
            monthlyIdr: Math.round(monthlyUsd * 16000),
            totalMonthlyItems: unit.estimatedItemsPerCrawl * simTagsCount * 30,
        };
    }, [simTagsCount, simPostsPerTag, simIncludeComments]);

    const tags = data?.tracked_hashtags || [];
    const forecast = data?.cost_forecast;

    const filteredTags = useMemo(() => {
        return tags.filter((t) => {
            const matchesQuery =
                t.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.label.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = categoryFilter === 'all' || t.category === categoryFilter;
            return matchesQuery && matchesCat;
        });
    }, [tags, searchQuery, categoryFilter]);

    // Handle Active Toggle
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

    // Handle Delete
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

    // Handle Add Tag
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
                    target_posts: newTargetPosts,
                    include_comments: newIncludeComments,
                    active: true,
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Hashtag #${clean} added to daily tracking!`);
                setNewTag('');
                setNewLabel('');
                setIsAddOpen(false);
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

    // Handle Dry-run or test scrape
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

    return (
        <div className="p-6 space-y-6 w-full max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <PageHeader
                        title="Custom Hashtag Tracker"
                        description="Track arbitrary promotional campaigns, studio stunts, or competitor hashtags with real-time transparent cost forecasting."
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setIsAddOpen(!isAddOpen)}
                        className="gap-2 font-bold shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {isAddOpen ? 'Close Form' : 'Track New Hashtag'}
                    </Button>
                </div>
            </div>

            {/* Top Metrics Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 bg-card">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Tracked Hashtags
                            </span>
                            <Hash className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black">{forecast?.activeTags ?? 0}</span>
                            <span className="text-xs text-muted-foreground">
                                active of {forecast?.totalTags ?? 0} total
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                            Crawled daily at 18:00 WIB
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Daily Crawl Burn
                            </span>
                            <Zap className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black">
                                {formatUsd(forecast?.dailyCostUsd ?? 0)}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                                / day ({formatIdr(forecast?.dailyCostIdr ?? 0)})
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xs text-muted-foreground mt-1">
                            ~{forecast?.dailyItemsScraped ?? 0} items processed / day
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                30-Day Projected Burn
                            </span>
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black">
                                {formatUsd(forecast?.monthlyCostUsd ?? 0)}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                                ({formatIdr(forecast?.monthlyCostIdr ?? 0)})
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xs text-muted-foreground mt-1">
                            Apify Posts + Comments + Gemini 3.8 AI
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Starter Allowance ($29)
                            </span>
                            {forecast?.creditsStatus === 'safe' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                            )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black">
                                {forecast?.percentOfStarterCredits ?? 0}%
                            </span>
                            <Badge
                                variant="outline"
                                className={`text-[10px] font-bold uppercase ${
                                    forecast?.creditsStatus === 'safe'
                                        ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                        : forecast?.creditsStatus === 'warning'
                                        ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                                        : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                                }`}
                            >
                                {forecast?.creditsStatus}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="w-full bg-muted/60 rounded-full h-1.5 mt-1 overflow-hidden">
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
                    </CardContent>
                </Card>
            </div>

            {/* Add New Hashtag Form (Collapsible) */}
            {isAddOpen && (
                <Card className="border-primary/40 bg-card/95 shadow-md">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Hash className="w-4 h-4 text-primary" />
                            Track Custom Hashtag
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Configure an ad-hoc hashtag to scrape daily. The cost forecast updates in real-time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                        <form onSubmit={handleCreateTag} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                        Hashtag Name (without #)
                                    </label>
                                    <Input
                                        placeholder="e.g. filmindonesia2026"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        required
                                        className="h-9 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                        Campaign / Descriptive Label
                                    </label>
                                    <Input
                                        placeholder="e.g. Indie Horror Promo Wave"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value as any)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    >
                                        <option value="campaign">Movie Campaign</option>
                                        <option value="competitor">Competitor Brand</option>
                                        <option value="meme">Viral Meme / Trend</option>
                                        <option value="talent">Director / Actor Stunt</option>
                                        <option value="general">General Film Topic</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-foreground">Scrape Depth</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Number of raw TikTok videos to scrape per crawl
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {[20, 40, 80].map((num) => (
                                            <Button
                                                key={num}
                                                type="button"
                                                variant={newTargetPosts === num ? 'default' : 'outline'}
                                                size="sm"
                                                className="h-7 px-2.5 text-xs font-bold"
                                                onClick={() => setNewTargetPosts(num)}
                                            >
                                                {num} posts
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <div>
                                        <div className="text-xs font-bold text-foreground">Audience Sentiment</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            30 comments + Gemini 3.8 Flash analysis
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant={newIncludeComments ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 px-3 text-xs font-bold"
                                        onClick={() => setNewIncludeComments(!newIncludeComments)}
                                    >
                                        {newIncludeComments ? 'Enabled' : 'Disabled'}
                                    </Button>
                                </div>
                            </div>

                            {/* Live Unit Cost Preview */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <Calculator className="w-4 h-4 text-primary" />
                                    <span>
                                        Estimated cost for this hashtag:{' '}
                                        <strong className="text-foreground">
                                            {formatUsd(
                                                computeHashtagUnitCost({
                                                    postsPerCrawl: newTargetPosts,
                                                    includeComments: newIncludeComments,
                                                }).dailyCostUsd
                                            )}
                                            /crawl
                                        </strong>{' '}
                                        (
                                        {formatIdr(
                                            computeHashtagUnitCost({
                                                postsPerCrawl: newTargetPosts,
                                                includeComments: newIncludeComments,
                                            }).monthlyCostIdr
                                        )}
                                        /month)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setIsAddOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isSubmitting}
                                        className="h-7 text-xs font-bold gap-1"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Save &amp; Track
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Interactive "What-If" Cost Simulator Bento */}
            <Card className="border-border/60 bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm font-bold text-foreground">
                                Real-Time Unit Economics &amp; Capacity Simulator
                            </CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono">
                            Apify $3/1k · Gemini 3.8 Flash $0.75/1M
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-1">
                                    <span>Number of Custom Hashtags</span>
                                    <span className="text-primary font-bold">{simTagsCount} tags</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={simTagsCount}
                                    onChange={(e) => setSimTagsCount(Number(e.target.value))}
                                    className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-1">
                                    <span>Depth (Posts per Crawl)</span>
                                    <span className="text-primary font-bold">{simPostsPerTag} posts</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {[20, 40, 80, 100].map((num) => (
                                        <Button
                                            key={num}
                                            variant={simPostsPerTag === num ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-6 text-[11px] px-2 font-bold"
                                            onClick={() => setSimPostsPerTag(num)}
                                        >
                                            {num}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Forecast for {simTagsCount} Custom Hashtags
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Daily Crawl Cost:</span>
                                    <span className="font-bold text-sm text-foreground">
                                        {formatUsd(simulatedCost.dailyUsd)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block">
                                        ({formatIdr(simulatedCost.dailyIdr)})
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Monthly Total:</span>
                                    <span className="font-bold text-sm text-emerald-500">
                                        {formatUsd(simulatedCost.monthlyUsd)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block">
                                        ({formatIdr(simulatedCost.monthlyIdr)})
                                    </span>
                                </div>
                            </div>
                            <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                                Monthly Volume: <strong>{simulatedCost.totalMonthlyItems.toLocaleString()}</strong> items scraped.
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-center">
                            <div className="text-xs font-bold text-foreground mb-1">
                                Monthly Budget Impact
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Tracking {simTagsCount} custom tags adds{' '}
                                <strong className="text-foreground">
                                    {formatIdr(simulatedCost.monthlyIdr)}/mo
                                </strong>{' '}
                                to CineRadar&apos;s infrastructure. All tags run in parallel during the standard 18:00 WIB daily sweep.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Hashtag Catalog */}
            <Card className="border-border/60 bg-card overflow-hidden">
                <CardHeader className="p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-primary" />
                        <CardTitle className="text-sm font-bold text-foreground">
                            Active Custom Hashtag Slate ({filteredTags.length})
                        </CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-48 sm:w-64">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                            <Input
                                placeholder="Search tag or label..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs rounded-lg"
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as any)}
                            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold shadow-sm"
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
                        <div className="p-12 text-center text-xs text-muted-foreground">
                            Loading custom hashtags &amp; unit economics...
                        </div>
                    ) : filteredTags.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                            <div className="text-sm font-bold text-foreground">No Custom Hashtags Found</div>
                            <div className="text-xs text-muted-foreground max-w-sm mx-auto">
                                Add your first custom hashtag above to begin tracking ad-hoc promotional campaigns and buzz.
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 text-xs font-bold"
                                onClick={() => setIsAddOpen(true)}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add First Hashtag
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold uppercase text-[10px]">
                                    <tr>
                                        <th className="py-2.5 px-4">Hashtag &amp; Label</th>
                                        <th className="py-2.5 px-3">Category</th>
                                        <th className="py-2.5 px-3">Config &amp; Depth</th>
                                        <th className="py-2.5 px-3">Est. Unit Cost</th>
                                        <th className="py-2.5 px-3">Latest Telemetry</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredTags.map((t) => (
                                        <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-foreground text-sm">
                                                        #{t.tag}
                                                    </span>
                                                    <a
                                                        href={`https://www.tiktok.com/tag/${t.tag}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-primary transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    {t.label}
                                                </div>
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
                                                    {t.target_posts} posts
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {t.include_comments ? '+ 30 comments (AI sentiment)' : 'Posts only'}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="font-bold text-foreground">
                                                    {formatUsd(t.cost.totalPerCrawlUsd)}/crawl
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    ~{formatIdr(t.cost.monthlyCostIdr)}/mo
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
                                                        Pending daily pulse
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-bold ${
                                                        t.active
                                                            ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                                            : 'border-muted text-muted-foreground bg-muted/20'
                                                    }`}
                                                >
                                                    {t.active ? 'ACTIVE' : 'PAUSED'}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 rounded-md"
                                                        onClick={() => handleToggleActive(t)}
                                                        title={t.active ? 'Pause tracking' : 'Resume tracking'}
                                                    >
                                                        {t.active ? (
                                                            <Pause className="w-3.5 h-3.5 text-amber-500" />
                                                        ) : (
                                                            <Play className="w-3.5 h-3.5 text-emerald-500" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 rounded-md"
                                                        onClick={() => handleTestRun(t.tag)}
                                                        disabled={testingTag === t.tag}
                                                        title="Test dry run"
                                                    >
                                                        <RefreshCw
                                                            className={`w-3.5 h-3.5 text-muted-foreground ${
                                                                testingTag === t.tag ? 'animate-spin' : ''
                                                            }`}
                                                        />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                                        onClick={() => handleDeleteTag(t.id, t.tag)}
                                                        title="Delete hashtag"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
