import React, { useState } from 'react';
import Link from 'next/link';
import {
    Film, ExternalLink, Play, ChevronDown, ChevronUp,
    ShieldCheck, Building2, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MovieSentimentItem } from '@/features/tiktok/types';

interface SentimentLineupSectionProps {
    movieList: MovieSentimentItem[];
    selectedMovieFilter: string;
    onSelectMovieFilter: (title: string) => void;
    onOpenViralModal: (movie: { id: string; title: string }) => void;
    selectedDate: string;
    isScheduleLoading: boolean;
    hasPulseData: boolean;
}

export function SentimentLineupSection({
    movieList,
    selectedMovieFilter,
    onSelectMovieFilter,
    onOpenViralModal,
    selectedDate,
    isScheduleLoading,
    hasPulseData,
}: SentimentLineupSectionProps) {
    const [showAllMovies, setShowAllMovies] = useState<boolean>(false);

    const displayedMovies = showAllMovies ? movieList : movieList.slice(0, 10);
    const verifiedTagsCount = movieList.filter((m) => m.discoveredTags.length > 0).length;

    return (
        <div className="space-y-4">
            {/* Theatrical Lineup & Sentiment Analysis Table */}
            <Card className="border-border/60 bg-card overflow-hidden">
                <CardHeader className="p-3.5 pb-2.5 border-b border-border/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm font-bold text-foreground">
                                Theatrical Lineup &amp; Sentiment ({movieList.length})
                            </CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onSelectMovieFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                                    selectedMovieFilter === 'all'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted/40 hover:bg-muted text-muted-foreground border border-border/40'
                                }`}
                            >
                                All Active
                                <Badge variant="secondary" className="text-sm font-normal px-1.5 py-0 h-5">
                                    {movieList.length}
                                </Badge>
                            </button>

                            {movieList.length > 10 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAllMovies((prev) => !prev)}
                                    className="text-sm font-semibold text-foreground gap-1 h-7 px-2.5"
                                >
                                    {showAllMovies ? (
                                        <>
                                            Top 10
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </>
                                    ) : (
                                        <>
                                            All ({movieList.length})
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/40 text-muted-foreground text-sm font-bold uppercase tracking-wider border-b border-border/40">
                                <tr>
                                    <th className="p-3 pl-4 w-1/3 min-w-[240px]"># Movie Title</th>
                                    <th className="p-3 text-right w-36 whitespace-nowrap">24h Views</th>
                                    <th className="p-3 pr-4">Top Audience Takeaway</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {isScheduleLoading && !hasPulseData ? (
                                    Array.from({ length: 6 }).map((_, idx) => (
                                        <tr key={idx} className="animate-pulse">
                                            <td className="p-3 pl-4 w-1/3 min-w-[240px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-muted rounded shrink-0" />
                                                    <div className="space-y-1.5 flex-1">
                                                        <div className="w-40 h-4 bg-muted/80 rounded" />
                                                        <div className="w-24 h-3 bg-muted/50 rounded" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right w-36">
                                                <div className="w-16 h-4 bg-muted/70 rounded ml-auto" />
                                            </td>
                                            <td className="p-3 pr-4">
                                                <div className="w-full max-w-md h-4 bg-muted/60 rounded" />
                                            </td>
                                        </tr>
                                    ))
                                ) : movieList.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                                            No active theatrical movies found for {selectedDate}.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedMovies.map((movie, idx) => {
                                        const isSelected = selectedMovieFilter.toLowerCase() === movie.title.toLowerCase();
                                        return (
                                            <tr
                                                key={movie.id}
                                                onClick={() => onSelectMovieFilter(isSelected ? 'all' : movie.title)}
                                                className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                                                    isSelected ? 'bg-primary/10 font-semibold' : ''
                                                }`}
                                            >
                                                <td className="p-3 pl-4 text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground font-mono text-sm w-4">
                                                            {idx + 1}.
                                                        </span>
                                                        <div>
                                                            <span className="hover:underline font-bold text-foreground">
                                                                {movie.title}
                                                            </span>
                                                            {movie.discoveredTags && movie.discoveredTags.length > 0 ? (
                                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5" onClick={(e) => e.stopPropagation()}>
                                                                    {movie.discoveredTags.map((tag) => {
                                                                        const cleanTag = tag.replace(/^#/, '');
                                                                        return (
                                                                            <a
                                                                                key={tag}
                                                                                href={`https://www.tiktok.com/tag/${cleanTag}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                title={`Open #${cleanTag} on TikTok`}
                                                                                className="text-sm text-muted-foreground font-mono font-normal hover:text-primary hover:underline inline-flex items-center gap-0.5 transition-colors"
                                                                            >
                                                                                {tag}
                                                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                                            </a>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-0.5">
                                                                    <Badge variant="outline" className="text-sm font-normal border-dashed text-muted-foreground py-0 px-1.5 h-5">
                                                                        Pending
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold text-foreground">
                                                    {movie.hasSocialCrawl && movie.views > 0 ? movie.views.toLocaleString() : '—'}
                                                </td>
                                                <td className="p-3 pr-4 text-muted-foreground">
                                                    {movie.hasSocialCrawl ? (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="line-clamp-1">{movie.topPraise}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onOpenViralModal({ id: movie.id, title: movie.title });
                                                                }}
                                                                className="h-6 px-2 text-sm font-bold text-primary hover:bg-primary/10 gap-1 rounded shrink-0"
                                                            >
                                                                <Play className="w-2.5 h-2.5 fill-primary" />
                                                                Viral
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="font-mono text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Verified Campaign Hashtags Section */}
            <Card className="border-border/60 bg-card overflow-hidden">
                <CardHeader className="p-3.5 pb-2.5 border-b border-border/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <CardTitle className="text-sm font-bold text-foreground">
                                Verified Campaign Hashtags ({verifiedTagsCount}/{movieList.length})
                            </CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link href="/tiktok/exhibitors">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-sm font-semibold h-7 px-2.5 rounded-lg border-border/60"
                                >
                                    <Building2 className="w-3.5 h-3.5 text-amber-500" />
                                    Circuit Channels
                                </Button>
                            </Link>
                            <Link href="/tiktok/ops">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-sm font-semibold h-7 px-2.5 rounded-lg border-border/60"
                                >
                                    <Layers className="w-3.5 h-3.5 text-primary" />
                                    Ops &amp; Pipeline Hub
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {movieList.map((movie) => {
                            const hasTags = movie.discoveredTags.length > 0;
                            return (
                                <div
                                    key={`tag-card-${movie.id}`}
                                    className="p-3 rounded-xl border border-border/40 bg-muted/10 space-y-2 flex flex-col justify-between"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-foreground truncate">
                                            {movie.title}
                                        </span>
                                        <Badge variant="outline" className="text-sm font-medium shrink-0">
                                            {movie.age_category}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/20">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {hasTags ? (
                                                movie.discoveredTags.map((tag) => {
                                                    const cleanTag = tag.replace(/^#/, '');
                                                    return (
                                                        <a
                                                            key={tag}
                                                            href={`https://www.tiktok.com/tag/${cleanTag}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`Verify #${cleanTag} on TikTok`}
                                                            className="inline-flex items-center gap-1 font-mono text-sm font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md px-2 py-0.5 transition-colors"
                                                        >
                                                            {tag}
                                                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                        </a>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-sm text-muted-foreground italic">
                                                    Pending 08:00 WIB discovery
                                                </span>
                                            )}
                                        </div>

                                        {movie.hasSocialCrawl && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onOpenViralModal({ id: movie.id, title: movie.title })}
                                                className="h-6 px-2 text-sm font-bold text-primary hover:bg-primary/10 gap-1 rounded shrink-0"
                                            >
                                                <Play className="w-2.5 h-2.5 fill-primary" />
                                                Viral ({movie.postsCount || 40})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
