'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Sparkles, Play, Clock, CheckCircle2,
    Calendar, ArrowRight, Video, MessageSquare, Terminal, DollarSign,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CrawlJob {
    id: string;
    hashtag: string;
    status: 'SUCCEEDED' | 'RUNNING' | 'SCHEDULED';
    videosCount: number;
    commentsCount: number;
    spendUsd: number;
    executedAt: string;
}

const RECENT_JOBS: CrawlJob[] = [
    {
        id: 'job-001',
        hashtag: '#harusnyahorror',
        status: 'SUCCEEDED',
        videosCount: 10,
        commentsCount: 45,
        spendUsd: 0.1323,
        executedAt: 'Today, 01:48 WIB',
    },
    {
        id: 'job-002',
        hashtag: '#kangmak',
        status: 'SCHEDULED',
        videosCount: 25,
        commentsCount: 50,
        spendUsd: 0.094,
        executedAt: 'Tonight, 23:00 WIB',
    },
    {
        id: 'job-003',
        hashtag: '#agaklaen',
        status: 'SCHEDULED',
        videosCount: 25,
        commentsCount: 50,
        spendUsd: 0.094,
        executedAt: 'Tonight, 23:00 WIB',
    },
];

export default function TikTokJobsPage() {
    const [targetTag, setTargetTag] = useState<string>('#harusnyahorror');
    const [videoLimit, setVideoLimit] = useState<number>(25);
    const [commentsLimit, setCommentsLimit] = useState<number>(20);
    const [isTriggering, setIsTriggering] = useState<boolean>(false);
    const [triggerSuccess, setTriggerSuccess] = useState<boolean>(false);

    const handleTrigger = () => {
        setIsTriggering(true);
        setTimeout(() => {
            setIsTriggering(false);
            setTriggerSuccess(true);
            setTimeout(() => setTriggerSuccess(false), 4000);
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">TikTok Crawler Jobs</h1>
                            <p className="text-muted-foreground text-sm font-medium">
                                Batch crawl orchestrator, manual execution trigger, and automated daily schedule monitor
                            </p>
                        </div>
                    </div>
                </div>

                <Badge variant="outline" className="px-3 py-1 text-sm font-semibold gap-1.5 self-start md:self-auto bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apify Engine Active
                </Badge>
            </div>

            {/* Quick Status KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Daily Schedule
                            <Clock className="w-4 h-4 text-primary" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-foreground">
                            2x / Day
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            11:00 & 23:00 WIB
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Active Slate
                            <Video className="w-4 h-4 text-cyan-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-cyan-500">
                            6 Movies
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Tracked in Indonesian cinemas
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Daily Spend Rate
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-emerald-500">
                            ~$0.85 / $5.00
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Within \$5.00 daily target
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Today&apos;s Data
                            <MessageSquare className="w-4 h-4 text-amber-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-amber-500">
                            10 Posts / 45 Cmd
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Synced to local storage
                        </span>
                    </CardContent>
                </Card>
            </div>

            {/* Manual Launch & CLI Command Generator Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/60 bg-card">
                    <CardHeader className="p-6 pb-4 border-b border-border/30">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Play className="w-4 h-4 text-primary" />
                            Manual Scrape Trigger
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Configure and launch an on-demand crawl job for any movie campaign
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-bold uppercase text-muted-foreground mb-1 block">
                                    Target Hashtag
                                </label>
                                <Input
                                    value={targetTag}
                                    onChange={(e) => setTargetTag(e.target.value)}
                                    placeholder="#harusnyahorror"
                                    className="rounded-xl font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold uppercase text-muted-foreground mb-1 block">
                                    Max Videos ({videoLimit})
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="50"
                                    step="5"
                                    value={videoLimit}
                                    onChange={(e) => setVideoLimit(parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer mt-3"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold uppercase text-muted-foreground mb-1 block">
                                    Comments / Post ({commentsLimit})
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="50"
                                    step="5"
                                    value={commentsLimit}
                                    onChange={(e) => setCommentsLimit(parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer mt-3"
                                />
                            </div>
                        </div>

                        {/* Estimated Cost Badge */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/40 text-sm">
                            <span className="text-muted-foreground font-medium">Estimated Run Cost:</span>
                            <span className="font-mono font-bold text-emerald-500">
                                ~${(0.038 + (3 * commentsLimit * 0.0025 / 20)).toFixed(3)} USD
                            </span>
                        </div>

                        {/* CLI Command Equivalent */}
                        <div>
                            <div className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                <Terminal className="w-3.5 h-3.5" />
                                CLI Execution Equivalent:
                            </div>
                            <div className="p-3 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-sm overflow-x-auto border border-border/40">
                                <code>
                                    uv run python backend/scripts/pilot_tiktok_crawler.py --hashtag {targetTag.replace('#', '')} --limit {videoLimit} --comments-per-post {commentsLimit}
                                </code>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                onClick={handleTrigger}
                                disabled={isTriggering}
                                className="rounded-xl px-6 gap-2 font-bold text-sm"
                            >
                                {isTriggering ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Triggering Apify Run...
                                    </>
                                ) : triggerSuccess ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        Job Dispatched Successfully!
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Start Crawl Job
                                    </>
                                )}
                            </Button>

                            <Link
                                href="/tiktok/explorer"
                                className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                            >
                                View latest results in Explorer →
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Schedules & Cron Card */}
                <Card className="border-border/60 bg-card">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Daily Automated Windows
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Automated pipeline intervals
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3 text-sm">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                                <span>Window 1: Morning Check</span>
                                <Badge variant="outline" className="text-sm">11:00 WIB</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Captures overnight viral spikes & early morning movie buzz
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                                <span>Window 2: Night Recap</span>
                                <Badge variant="outline" className="text-sm">23:00 WIB</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Full daily recap after evening prime-time showtimes finish
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Execution History Table */}
            <Card className="border-border/60 bg-card">
                <CardHeader className="p-6 pb-3 border-b border-border/30">
                    <CardTitle className="text-base font-bold">Recent Crawler Runs</CardTitle>
                    <CardDescription className="text-sm">
                        Execution history of live and scheduled hashtag crawlers
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/30 text-sm">
                        {RECENT_JOBS.map((job) => (
                            <div key={job.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant={job.status === 'SUCCEEDED' ? 'default' : 'secondary'}
                                        className="text-sm font-mono"
                                    >
                                        {job.status}
                                    </Badge>
                                    <span className="font-mono font-bold text-sm text-foreground">
                                        {job.hashtag}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6 text-muted-foreground">
                                    <span>{job.videosCount} Videos</span>
                                    <span>{job.commentsCount} Comments</span>
                                    <span className="font-mono text-emerald-500 font-semibold">
                                        ${job.spendUsd.toFixed(4)}
                                    </span>
                                    <span>{job.executedAt}</span>
                                </div>

                                <Link
                                    href="/tiktok/explorer"
                                    className="px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted font-medium text-sm flex items-center gap-1 text-foreground transition-colors"
                                >
                                    Explorer
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
