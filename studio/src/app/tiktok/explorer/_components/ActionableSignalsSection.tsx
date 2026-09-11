import React from 'react';
import {
    Activity, Trophy, ThumbsUp, Zap, AlertTriangle,
    Sun, Moon, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ActionableInsights } from '@/features/tiktok/types';

interface ActionableSignalsSectionProps {
    insights: ActionableInsights;
    selectedDate: string;
    totalPostsCount: number;
    totalCommentsCount: number;
    hasNightRunHappened: boolean;
    hasPulseData: boolean;
}

export function ActionableSignalsSection({
    insights,
    selectedDate,
    totalPostsCount,
    totalCommentsCount,
    hasNightRunHappened,
    hasPulseData,
}: ActionableSignalsSectionProps) {
    return (
        <div className="space-y-4">
            {/* Header & Ingestion Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Today&apos;s Theatrical Signals · {selectedDate}
                </span>
                <span className="text-sm text-muted-foreground font-mono">
                    Live Ingestion: <strong className="text-foreground">{totalPostsCount}</strong> posts | <strong className="text-foreground">{totalCommentsCount}</strong> comments
                </span>
            </div>

            {/* 4 Actionable KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: Share of Voice Leader */}
                <Card className="bg-gradient-to-br from-indigo-500/5 via-card to-card border-indigo-500/20">
                    <CardHeader className="p-3.5 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                            Share of Voice Leader
                            <Trophy className="w-3.5 h-3.5" />
                        </CardDescription>
                        <CardTitle className="text-base font-bold text-foreground truncate">
                            {insights.sovLeader.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                                #1 Buzz
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                            {insights.sovLeader.insight}
                        </p>
                    </CardContent>
                </Card>

                {/* Card 2: Organic WoM Winner */}
                <Card className="bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/20">
                    <CardHeader className="p-3.5 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                            Organic WoM Ratio
                            <ThumbsUp className="w-3.5 h-3.5" />
                        </CardDescription>
                        <CardTitle className="text-base font-bold text-foreground truncate">
                            {insights.womWinner.title || 'Audience Excitement'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                                {insights.womWinner.positivePct}%
                            </span>
                            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                High Positive
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                            {insights.womWinner.insight}
                        </p>
                    </CardContent>
                </Card>

                {/* Card 3: Virality Velocity Leader */}
                <Card className="bg-gradient-to-br from-cyan-500/5 via-card to-card border-cyan-500/20">
                    <CardHeader className="p-3.5 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center justify-between">
                            Virality Velocity
                            <Zap className="w-3.5 h-3.5" />
                        </CardDescription>
                        <CardTitle className="text-base font-bold text-foreground truncate">
                            {insights.viralityLeader.title || 'Daily Momentum'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                                {(insights.viralityLeader.shares || 0).toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground font-mono">
                                shares
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                            {insights.viralityLeader.insight}
                        </p>
                    </CardContent>
                </Card>

                {/* Card 4: Critical Friction Alert */}
                <Card className="bg-gradient-to-br from-amber-500/5 via-card to-card border-amber-500/20">
                    <CardHeader className="p-3.5 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                            Friction Alert
                            <AlertTriangle className="w-3.5 h-3.5" />
                        </CardDescription>
                        <CardTitle className="text-base font-bold text-foreground truncate">
                            {insights.frictionTarget.title || 'Showtime Availability'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                                Watch
                            </span>
                            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                Attention Point
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                            {insights.frictionTarget.topComplaint}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Dual-Column Intelligence Briefings */}
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
                                        Social Pulse Window
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-sm font-medium">
                                Pre-Showtime
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                            {insights.morningBriefing}
                        </p>
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
                                        {hasNightRunHappened || hasPulseData ? 'Ingested Window' : 'Scheduled Daily Run'}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-sm font-medium">
                                {hasNightRunHappened || hasPulseData ? 'Post-Showtimes' : 'Awaiting 23:00 WIB'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5">
                        {hasNightRunHappened || hasPulseData ? (
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                {insights.nightBriefing}
                            </p>
                        ) : (
                            <div className="py-3 text-center space-y-1 bg-muted/20 rounded-lg border border-border/30 p-3">
                                <p className="text-sm font-semibold text-foreground">
                                    Awaiting Evening Showtime Reactions
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    The Night Box Office Recap will automatically populate at <strong className="text-foreground font-mono">23:00 WIB</strong> after evening showtime discussions and prime-time word-of-mouth are ingested.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
