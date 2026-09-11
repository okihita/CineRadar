import React from 'react';
import {
    Activity, Trophy, ThumbsUp, Zap, AlertTriangle,
    Sun, Moon, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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

            {/* 4 Actionable KPI Cards with Balanced Multi-Line Layout & Full Hover Inspection */}
            <TooltipProvider delayDuration={120}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: Share of Voice Leader */}
                    <Card className="bg-gradient-to-br from-indigo-500/5 via-card to-card border-indigo-500/20 hover:border-indigo-500/40 transition-colors flex flex-col justify-between h-full">
                        <CardHeader className="p-3.5 pb-1">
                            <CardDescription className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                                <span>Share of Voice Leader</span>
                                <Trophy className="w-4 h-4 shrink-0 text-indigo-500" />
                            </CardDescription>
                            <CardTitle className="text-base font-bold text-foreground truncate" title={insights.sovLeader.title}>
                                {insights.sovLeader.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-1 space-y-2 flex-1 flex flex-col justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                                    {insights.sovLeader.metricValue || '#1 Buzz'}
                                </span>
                                <span className="text-sm text-muted-foreground font-medium">
                                    {insights.sovLeader.metricLabel || 'Volume Leader'}
                                </span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p
                                        className="text-sm text-muted-foreground line-clamp-3 leading-relaxed cursor-help transition-colors hover:text-foreground/90"
                                        title={insights.sovLeader.insight}
                                    >
                                        {insights.sovLeader.insight}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-xs sm:max-w-md p-3 text-sm leading-relaxed bg-popover text-popover-foreground border border-border/80 shadow-xl"
                                >
                                    <p className="font-semibold text-foreground mb-1">
                                        {insights.sovLeader.title}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {insights.sovLeader.insight}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardContent>
                    </Card>

                    {/* Card 2: Organic WoM Winner */}
                    <Card className="bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/20 hover:border-emerald-500/40 transition-colors flex flex-col justify-between h-full">
                        <CardHeader className="p-3.5 pb-1">
                            <CardDescription className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                                <span>Organic WoM Ratio</span>
                                <ThumbsUp className="w-4 h-4 shrink-0 text-emerald-500" />
                            </CardDescription>
                            <CardTitle className="text-base font-bold text-foreground truncate" title={insights.womWinner.title}>
                                {insights.womWinner.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-1 space-y-2 flex-1 flex flex-col justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                                    {insights.womWinner.metricValue || `${insights.womWinner.positivePct}%`}
                                </span>
                                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                    {insights.womWinner.metricLabel || 'Organic WoM'}
                                </span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p
                                        className="text-sm text-muted-foreground line-clamp-3 leading-relaxed cursor-help transition-colors hover:text-foreground/90"
                                        title={insights.womWinner.insight}
                                    >
                                        {insights.womWinner.insight}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-xs sm:max-w-md p-3 text-sm leading-relaxed bg-popover text-popover-foreground border border-border/80 shadow-xl"
                                >
                                    <p className="font-semibold text-foreground mb-1">
                                        {insights.womWinner.title}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {insights.womWinner.insight}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardContent>
                    </Card>

                    {/* Card 3: Virality Velocity Leader */}
                    <Card className="bg-gradient-to-br from-cyan-500/5 via-card to-card border-cyan-500/20 hover:border-cyan-500/40 transition-colors flex flex-col justify-between h-full">
                        <CardHeader className="p-3.5 pb-1">
                            <CardDescription className="text-sm font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center justify-between">
                                <span>Virality Velocity</span>
                                <Zap className="w-4 h-4 shrink-0 text-cyan-500" />
                            </CardDescription>
                            <CardTitle className="text-base font-bold text-foreground truncate" title={insights.viralityLeader.title}>
                                {insights.viralityLeader.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-1 space-y-2 flex-1 flex flex-col justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                                    {insights.viralityLeader.metricValue || (insights.viralityLeader.shares > 0 ? (insights.viralityLeader.shares).toLocaleString() : 'Surging')}
                                </span>
                                <span className="text-sm text-muted-foreground font-mono">
                                    {insights.viralityLeader.metricLabel || (insights.viralityLeader.shares > 0 ? 'shares' : 'Velocity')}
                                </span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p
                                        className="text-sm text-muted-foreground line-clamp-3 leading-relaxed cursor-help transition-colors hover:text-foreground/90"
                                        title={insights.viralityLeader.insight}
                                    >
                                        {insights.viralityLeader.insight}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-xs sm:max-w-md p-3 text-sm leading-relaxed bg-popover text-popover-foreground border border-border/80 shadow-xl"
                                >
                                    <p className="font-semibold text-foreground mb-1">
                                        {insights.viralityLeader.title}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {insights.viralityLeader.insight}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardContent>
                    </Card>

                    {/* Card 4: Critical Friction Alert */}
                    <Card className="bg-gradient-to-br from-amber-500/5 via-card to-card border-amber-500/20 hover:border-amber-500/40 transition-colors flex flex-col justify-between h-full">
                        <CardHeader className="p-3.5 pb-1">
                            <CardDescription className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                                <span>Friction Alert</span>
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                            </CardDescription>
                            <CardTitle className="text-base font-bold text-foreground truncate" title={insights.frictionTarget.title}>
                                {insights.frictionTarget.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-1 space-y-2 flex-1 flex flex-col justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                                    {insights.frictionTarget.metricValue || 'Watch'}
                                </span>
                                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                    {insights.frictionTarget.metricLabel || 'Attention Point'}
                                </span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p
                                        className="text-sm text-muted-foreground line-clamp-3 leading-relaxed cursor-help transition-colors hover:text-foreground/90"
                                        title={insights.frictionTarget.topComplaint}
                                    >
                                        {insights.frictionTarget.topComplaint}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-xs sm:max-w-md p-3 text-sm leading-relaxed bg-popover text-popover-foreground border border-border/80 shadow-xl"
                                >
                                    <p className="font-semibold text-foreground mb-1">
                                        {insights.frictionTarget.title}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {insights.frictionTarget.topComplaint}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardContent>
                    </Card>
                </div>
            </TooltipProvider>

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
