'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Database,
    Copy,
    Check,
    RefreshCw,
    Search,
    FileJson,
    FolderTree,
    Layers,
    Clock,
    Sparkles,
} from 'lucide-react';
import { fetcher } from '@/lib/api';
import { toast } from 'sonner';

interface RawApiResponse {
    success: boolean;
    collection: string;
    path: string;
    total_documents?: number;
    data: unknown;
    message?: string;
    error?: string;
}

const FIRESTORE_TARGETS = [
    {
        id: 'tiktok_daily_pulse',
        name: 'Daily Pulse Leaderboard',
        pathFormat: 'tiktok_daily_pulse/{date}',
        description: 'Aggregated daily ranking, SOV leaders, hype scores, and top video snippets.',
        supportsDate: true,
        supportsMovieId: true,
    },
    {
        id: 'tiktok_hashtag_discovery',
        name: 'Hashtag Discovery',
        pathFormat: 'tiktok_hashtag_discovery/{date}',
        description: 'Verified campaign tags derived from 14-day exhibitor trailers and studio accounts.',
        supportsDate: true,
        supportsMovieId: false,
    },
    {
        id: 'tiktok_exhibitor_archive',
        name: 'Exhibitor 14-Day Archive',
        pathFormat: 'tiktok_exhibitor_archive (50 docs)',
        description: 'Chronological raw promotional posts from XXI, CGV, and Cinépolis.',
        supportsDate: false,
        supportsMovieId: false,
    },
    {
        id: 'tiktok_sources',
        name: 'Sources & Noise Config',
        pathFormat: 'tiktok_sources/config',
        description: 'Active seed accounts, truth weights, and excluded generic hashtag filters.',
        supportsDate: false,
        supportsMovieId: false,
    },
    {
        id: 'tiktok_movie_trends',
        name: 'Movie Lifetime Trend Series',
        pathFormat: 'tiktok_movie_trends/{movie_id}',
        description: '60-day historical time-series curves and cumulative virality metrics.',
        supportsDate: false,
        supportsMovieId: true,
    },
];

export default function TikTokRawDataExplorerPage() {
    const today = new Date().toISOString().split('T')[0];
    const [selectedCollection, setSelectedCollection] = useState<string>('tiktok_daily_pulse');
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [movieId, setMovieId] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const targetConfig = FIRESTORE_TARGETS.find((t) => t.id === selectedCollection) || FIRESTORE_TARGETS[0];

    const apiUrl = `/api/socials/tiktok/raw?collection=${selectedCollection}&date=${selectedDate}${
        movieId ? `&movie_id=${encodeURIComponent(movieId)}` : ''
    }`;

    const { data: rawRes, error, isLoading, mutate } = useSWR<RawApiResponse>(apiUrl, fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 10000,
    });

    const handleCopy = () => {
        if (!rawRes?.data) return;
        navigator.clipboard.writeText(JSON.stringify(rawRes.data, null, 2));
        setCopied(true);
        toast.success('Raw JSON copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const formattedJson = rawRes?.data ? JSON.stringify(rawRes.data, null, 2) : '';

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
                        title="TikTok Raw Data & Schema Inspector"
                        description="Direct inspection tool for Firestore collections: daily pulse snapshots, movie subcollections, and exhibitor timelines."
                    />

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => mutate()}
                            disabled={isLoading}
                            className="gap-1.5 text-sm font-semibold h-8"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleCopy}
                            disabled={!rawRes?.data}
                            className="gap-1.5 text-sm font-semibold h-8"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied' : 'Copy JSON'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Collection Selector Bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {FIRESTORE_TARGETS.map((target) => {
                    const isSelected = selectedCollection === target.id;
                    return (
                        <Card
                            key={target.id}
                            onClick={() => setSelectedCollection(target.id)}
                            className={`cursor-pointer transition-all p-3.5 space-y-1.5 flex flex-col justify-between ${
                                isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm'
                                    : 'border-border/60 hover:border-border hover:bg-muted/20'
                            }`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-bold text-muted-foreground truncate">
                                        {target.id}
                                    </span>
                                    {isSelected && <Badge variant="default" className="text-[10px] h-4 py-0 px-1">Selected</Badge>}
                                </div>
                                <h4 className="text-sm font-bold text-foreground leading-tight">{target.name}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-2">{target.description}</p>
                            </div>
                            <div className="pt-2 border-t border-border/30">
                                <span className="text-[11px] font-mono text-primary truncate block">{target.pathFormat}</span>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Target Filter & Path Banner */}
            <Card className="border-border/60 bg-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-mono font-semibold text-foreground truncate">
                            {rawRes?.path ? `Firestore: /${rawRes.path}` : targetConfig.pathFormat}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {targetConfig.supportsDate && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="h-8 text-xs font-mono w-36 bg-muted/20"
                                />
                            </div>
                        )}

                        {targetConfig.supportsMovieId && (
                            <div className="flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter by movie_id (e.g. spiderman)..."
                                    value={movieId}
                                    onChange={(e) => setMovieId(e.target.value)}
                                    className="h-8 text-xs font-mono w-56 bg-muted/20"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* JSON Output Viewer */}
            <Card className="border-border/60 bg-card overflow-hidden">
                <CardHeader className="p-3.5 pb-2.5 border-b border-border/30 bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm font-bold text-foreground">
                                Document Payload ({formattedJson.length.toLocaleString()} characters)
                            </CardTitle>
                        </div>
                        {rawRes?.total_documents !== undefined && (
                            <Badge variant="outline" className="font-mono text-xs">
                                {rawRes.total_documents} Documents
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                            Loading Firestore snapshot...
                        </div>
                    ) : error || !rawRes?.success ? (
                        <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                            <p className="text-rose-500 font-semibold">
                                {rawRes?.message || error?.message || 'No document found at this path.'}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground">
                                Path: /{rawRes?.path || targetConfig.pathFormat}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-zinc-950 text-zinc-200 p-4 font-mono text-xs leading-relaxed overflow-x-auto max-h-[650px]">
                            <pre>{formattedJson}</pre>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
