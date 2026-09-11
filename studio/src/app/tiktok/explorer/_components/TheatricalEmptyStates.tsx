import React from 'react';
import Link from 'next/link';
import {
    Activity, Clock, Film, ShieldCheck, Sparkles,
    ArrowRight, CalendarX2, Layers
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function TheatricalLoadingState() {
    return (
        <Card className="border-border/60 bg-card p-12 text-center">
            <Activity className="w-8 h-8 text-primary mx-auto animate-pulse mb-3" />
            <h3 className="text-base font-bold text-foreground">Loading Theatrical Intelligence...</h3>
            <p className="text-sm text-muted-foreground">Aggregating live crawler records and social pulse telemetry.</p>
        </Card>
    );
}

interface FutureDateStateProps {
    selectedDate: string;
    today: string;
    onJumpToToday: () => void;
}

export function FutureDateState({ selectedDate, today, onJumpToToday }: FutureDateStateProps) {
    return (
        <Card className="border-border/60 bg-card p-6 sm:p-10 text-center space-y-6 max-w-2xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-sm">
                <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
                <Badge variant="outline" className="text-sm font-semibold border-primary/30 text-primary">
                    Upcoming Ingestion Schedule
                </Badge>
                <h3 className="text-xl font-bold text-foreground">
                    Scheduled Data Pipeline for {selectedDate}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Intelligence for this future date is scheduled to populate automatically across the following daily automated runs:
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-bold text-primary">06:00 WIB</span>
                            <Film className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">Showtimes Sync</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            Populates active movies and showtimes from XXI, CGV, and Cinepolis.
                        </p>
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-bold text-amber-500">08:00 WIB</span>
                            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">Hashtag Discovery</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            Populates and links viral TikTok campaign tags to newly screening movies.
                        </p>
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-bold text-emerald-500">11:00 &amp; 18:00 WIB</span>
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">Social Pulse Run</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            Executes sentiment analysis, engagement ranking, and daily pulse snapshots.
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-1">
                <Button
                    variant="default"
                    size="sm"
                    onClick={onJumpToToday}
                    className="gap-1.5 text-sm font-semibold rounded-lg"
                >
                    Jump to Today&apos;s Live Intelligence ({today})
                    <ArrowRight className="w-3.5 h-3.5" />
                </Button>
            </div>
        </Card>
    );
}

interface PastDateUnrecordedStateProps {
    selectedDate: string;
    targetDate: string;
    onJumpToDate: (date: string) => void;
}

export function PastDateUnrecordedState({ selectedDate, targetDate, onJumpToDate }: PastDateUnrecordedStateProps) {
    return (
        <Card className="border-border/60 bg-card p-12 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <CalendarX2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-foreground">No Crawl Snapshot for {selectedDate}</h3>
                <p className="text-sm text-muted-foreground">
                    Automated crawling captures data twice daily (11:00 &amp; 23:00 WIB). Real theatrical intelligence is recorded for today.
                </p>
            </div>
            <Button
                variant="default"
                size="sm"
                onClick={() => onJumpToDate(targetDate)}
                className="gap-1.5 text-sm font-semibold rounded-lg"
            >
                Jump to Latest Live Crawl ({targetDate})
                <ArrowRight className="w-3.5 h-3.5" />
            </Button>
        </Card>
    );
}

interface MorningPendingBannerProps {
    activeTitlesCount: number;
}

export function MorningPendingBanner({ activeTitlesCount }: MorningPendingBannerProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                            Theatrical Slate Active ({activeTitlesCount} Titles)
                        </span>
                        <Badge variant="outline" className="text-sm font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 py-0 px-1.5 h-5">
                            Showtimes Synced
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Hashtag discovery and TikTok sentiment crawl scheduled for 08:00 &amp; 11:00 WIB.
                    </p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Next Crawl: 18:00 WIB</span>
                </div>
                <Link href="/tiktok/ops?tab=workflow">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-sm font-semibold rounded-lg gap-1.5 border-border/60 hover:border-primary/50"
                    >
                        <Layers className="w-3 h-3 text-primary" />
                        View Pipeline
                    </Button>
                </Link>
            </div>
        </div>
    );
}
