import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
    Play, Eye, Heart, MessageSquare, ExternalLink, Bookmark,
    Search, LayoutGrid, List, User, FileCode, Copy, Check, Activity
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeTitleForMatching } from '@/features/tiktok/utils';
import type {
    ExplorerPost,
    ExplorerComment,
    PulseLeaderboardItem,
    ActionableInsights,
    MovieSentimentItem,
} from '@/features/tiktok/types';

interface ExplorerTabsSectionProps {
    allPosts: ExplorerPost[];
    allComments: ExplorerComment[];
    pulseLeaderboard: PulseLeaderboardItem[];
    actionableInsights: ActionableInsights | null;
    todayMovieSentimentList: MovieSentimentItem[];
    pulseRawResponse: unknown;
    selectedDate: string;
    selectedMovieFilter: string;
    onSelectMovieFilter: (title: string) => void;
    onOpenViralModal: (movie: { id: string; title: string }) => void;
    hasPulseData: boolean;
}

export function ExplorerTabsSection({
    allPosts,
    allComments,
    pulseLeaderboard,
    actionableInsights,
    todayMovieSentimentList,
    pulseRawResponse,
    selectedDate,
    selectedMovieFilter,
    onSelectMovieFilter,
    onOpenViralModal,
    hasPulseData,
}: ExplorerTabsSectionProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [commentSearch, setCommentSearch] = useState<string>('');
    const [visibleCommentCount, setVisibleCommentCount] = useState<number>(30);
    const [videoLayoutMode, setVideoLayoutMode] = useState<'grid' | 'list'>('grid');
    const [copied, setCopied] = useState<boolean>(false);

    // Filtered Posts
    const filteredPosts = useMemo(() => {
        let list = allPosts;
        if (selectedMovieFilter !== 'all') {
            list = list.filter((p) => p.movieTitle.toLowerCase() === selectedMovieFilter.toLowerCase());
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((p) =>
                p.title.toLowerCase().includes(q) ||
                p.text.toLowerCase().includes(q) ||
                p.source_name.toLowerCase().includes(q) ||
                p.source_handle.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allPosts, selectedMovieFilter, searchQuery]);

    // Filtered Comments
    const filteredComments = useMemo(() => {
        let list = allComments;
        if (selectedMovieFilter !== 'all') {
            list = list.filter((c) => c.movieTitle.toLowerCase() === selectedMovieFilter.toLowerCase());
        }
        if (commentSearch.trim()) {
            const q = commentSearch.toLowerCase();
            list = list.filter((c) =>
                c.text.toLowerCase().includes(q) ||
                c.authorName.toLowerCase().includes(q) ||
                c.topic.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allComments, selectedMovieFilter, commentSearch]);

    // Filtered Pulse Leaderboard fallback
    const filteredPulseLeaderboard = useMemo(() => {
        let list = pulseLeaderboard;
        if (selectedMovieFilter !== 'all') {
            const cleanFilter = normalizeTitleForMatching(selectedMovieFilter);
            list = list.filter((m) => {
                const cleanTitle = normalizeTitleForMatching(m.title);
                return (
                    cleanTitle === cleanFilter ||
                    (cleanFilter.length > 0 && cleanTitle.includes(cleanFilter)) ||
                    (cleanTitle.length > 0 && cleanFilter.includes(cleanTitle))
                );
            });
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) =>
                m.title.toLowerCase().includes(q) ||
                m.tier.toLowerCase().includes(q)
            );
        }
        return list;
    }, [pulseLeaderboard, selectedMovieFilter, searchQuery]);

    const handleCopyJson = () => {
        const payload = {
            date: selectedDate,
            hasPulseData,
            pulseData: pulseRawResponse,
            actionableInsights,
            todayMovieSentimentList,
            totalPosts: filteredPosts.length,
            totalComments: filteredComments.length,
            topPosts: filteredPosts.slice(0, 50),
            sampleComments: filteredComments.slice(0, 50),
        };
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const activeVideosCount = filteredPosts.length > 0 ? filteredPosts.length : filteredPulseLeaderboard.length;

    return (
        <Tabs defaultValue="videos" className="space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <TabsList className="bg-muted/40 p-0.5 rounded-lg border border-border/40 h-auto">
                    <TabsTrigger value="videos" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                        <Play className="w-3.5 h-3.5" />
                        Viral Videos ({activeVideosCount})
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Audience Comments ({filteredComments.length})
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="gap-2 text-sm font-semibold px-3 py-1.5 rounded-md">
                        <FileCode className="w-3.5 h-3.5" />
                        Daily Raw JSON
                    </TabsTrigger>
                </TabsList>

                {/* Active Filter Indicator */}
                {selectedMovieFilter !== 'all' && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Filtered to:</span>
                        <Badge variant="secondary" className="font-semibold text-sm">
                            {selectedMovieFilter}
                        </Badge>
                        <button
                            onClick={() => onSelectMovieFilter('all')}
                            className="text-sm text-primary hover:underline font-medium"
                        >
                            Clear filter
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: VIDEOS FEED */}
            <TabsContent value="videos" className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search in captions or creators..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-muted/20 text-sm h-8"
                            />
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            Showing <span className="font-mono font-medium">{activeVideosCount}</span> entries
                        </span>
                    </div>

                    {/* Layout Mode Switcher */}
                    {filteredPosts.length > 0 && (
                        <div className="flex items-center rounded-lg border border-border/60 bg-card p-0.5 shadow-sm shrink-0">
                            <button
                                onClick={() => setVideoLayoutMode('grid')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold transition-colors ${
                                    videoLayoutMode === 'grid'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Thumbnail Card Grid"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span>Thumbnails</span>
                            </button>
                            <button
                                onClick={() => setVideoLayoutMode('list')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold transition-colors ${
                                    videoLayoutMode === 'list'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Row Table View"
                            >
                                <List className="w-3.5 h-3.5" />
                                <span>Row Views</span>
                            </button>
                        </div>
                    )}
                </div>

                {filteredPosts.length > 0 ? (
                    videoLayoutMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredPosts.map((post: ExplorerPost) => (
                                <Card key={post.id} className="overflow-hidden bg-card border-border/50 flex flex-col justify-between group hover:border-border transition-all">
                                    <div>
                                        {/* Creator Header */}
                                        <div className="p-3 pb-2.5 flex items-center justify-between gap-3 border-b border-border/30">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {post.source_avatar ? (
                                                    <Image
                                                        src={post.source_avatar}
                                                        alt={post.source_name}
                                                        width={28}
                                                        height={28}
                                                        className="w-7 h-7 rounded-full object-cover border border-border/40 flex-shrink-0"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                                                        {post.source_name ? post.source_name.charAt(0) : 'T'}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-foreground truncate">
                                                        {post.source_name}
                                                    </h4>
                                                    <a
                                                        href={`https://www.tiktok.com/@${post.source_handle.replace(/^@/, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title={`Open @${post.source_handle} on TikTok`}
                                                        className="text-sm text-muted-foreground hover:text-primary hover:underline truncate inline-flex items-center gap-0.5 transition-colors"
                                                    >
                                                        {post.source_handle}
                                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                    </a>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-sm font-normal shrink-0">
                                                {post.movieTitle}
                                            </Badge>
                                        </div>

                                        {/* Video Cover Preview Thumbnail */}
                                        {post.thumbnail ? (
                                            <div className="relative aspect-video w-full bg-muted/40 overflow-hidden border-b border-border/20">
                                                <Image
                                                    src={post.thumbnail}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center shadow-sm">
                                                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="aspect-video w-full bg-muted/20 flex items-center justify-center text-muted-foreground border-b border-border/20">
                                                <Play className="w-8 h-8 opacity-40" />
                                            </div>
                                        )}

                                        {/* Metrics Bar */}
                                        <div className="px-3 py-2 bg-muted/30 flex items-center justify-between text-sm font-mono border-b border-border/20">
                                            <span className="flex items-center gap-1 text-foreground" title="Views">
                                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                {(post.metrics?.views || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1 text-foreground" title="Likes">
                                                <Heart className="w-3.5 h-3.5 text-rose-500" />
                                                {(post.metrics?.likes || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1 text-foreground" title="Comments">
                                                <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />
                                                {(post.metrics?.comments || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1 text-foreground" title="Bookmarks">
                                                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                                                {(post.metrics?.bookmarks || 0).toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1 text-foreground" title="Shares">
                                                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                                {(post.metrics?.shares || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Caption */}
                                        <div className="p-3 space-y-1.5">
                                            <p className="text-sm line-clamp-3 leading-relaxed text-foreground/90 whitespace-pre-line">
                                                {post.text}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 pt-2 border-t border-border/30 flex items-center justify-between text-sm text-muted-foreground">
                                        <span>{new Date(post.published_at).toLocaleDateString()}</span>
                                        <a
                                            href={post.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-primary hover:underline flex items-center gap-1"
                                        >
                                            Watch on TikTok
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        /* Row Table View */
                        <Card className="border-border/60 bg-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/40 text-muted-foreground text-sm font-bold uppercase tracking-wider border-b border-border/40">
                                        <tr>
                                            <th className="p-3 pl-4">Account</th>
                                            <th className="p-3">Caption</th>
                                            <th className="p-3 text-right">Views</th>
                                            <th className="p-3 text-right">Likes</th>
                                            <th className="p-3 text-right">Comments</th>
                                            <th className="p-3 text-right">Bookmarks</th>
                                            <th className="p-3 text-right">Shares</th>
                                            <th className="p-3 pr-4 text-center">Watch</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {filteredPosts.map((post: ExplorerPost) => (
                                            <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 pl-4 min-w-[200px]">
                                                    <div className="flex items-center gap-2.5">
                                                        {post.source_avatar ? (
                                                            <Image
                                                                src={post.source_avatar}
                                                                alt={post.source_name}
                                                                width={32}
                                                                height={32}
                                                                className="w-8 h-8 rounded-full object-cover border border-border/40 shrink-0"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                                                                {post.source_name ? post.source_name.charAt(0) : 'T'}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-bold text-foreground truncate max-w-[200px]">
                                                                {post.source_name}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                                {post.source_handle}
                                                            </p>
                                                            <Badge variant="outline" className="text-sm font-normal mt-0.5">
                                                                {post.movieTitle}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="p-3 min-w-[280px]">
                                                    <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed whitespace-pre-line font-sans">
                                                        {post.text}
                                                    </p>
                                                    <span className="text-sm text-muted-foreground block mt-1">
                                                        {new Date(post.published_at).toLocaleDateString()}
                                                    </span>
                                                </td>

                                                <td className="p-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                                                    {(post.metrics?.views || 0).toLocaleString()}
                                                </td>

                                                <td className="p-3 text-right font-mono text-rose-500 font-semibold whitespace-nowrap">
                                                    {(post.metrics?.likes || 0).toLocaleString()}
                                                </td>

                                                <td className="p-3 text-right font-mono text-cyan-600 dark:text-cyan-400 font-semibold whitespace-nowrap">
                                                    {(post.metrics?.comments || 0).toLocaleString()}
                                                </td>

                                                <td className="p-3 text-right font-mono text-amber-500 font-semibold whitespace-nowrap">
                                                    {(post.metrics?.bookmarks || 0).toLocaleString()}
                                                </td>

                                                <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                                                    {(post.metrics?.shares || 0).toLocaleString()}
                                                </td>

                                                <td className="p-3 pr-4 text-center whitespace-nowrap">
                                                    <a
                                                        href={post.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-muted text-primary hover:underline transition-colors"
                                                        title="Open TikTok Video"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )
                ) : hasPulseData ? (
                    /* Synthesized Leaderboard Cards when Live Raw Posts are from Pulse Snapshot */
                    filteredPulseLeaderboard.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredPulseLeaderboard.map((m) => (
                                <Card key={m.movie_id} className="p-4 bg-card border-border/50 flex flex-col justify-between space-y-3 hover:border-border transition-all">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge variant="outline" className="text-sm uppercase font-bold text-primary border-primary/30">
                                                Rank #{m.rank}
                                            </Badge>
                                            <Badge variant="secondary" className="text-sm uppercase">
                                                {m.tier.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <h4 className="text-base font-bold text-foreground line-clamp-2">
                                            {m.title}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {m.posts_count} viral posts captured in 18:00 WIB pulse
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-border/30 text-sm font-mono">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Views</span>
                                            <strong className="text-foreground">{m.total_views.toLocaleString()}</strong>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> Likes</span>
                                            <strong className="text-foreground">{m.total_likes.toLocaleString()}</strong>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-emerald-500" /> Shares</span>
                                            <strong className="text-foreground">{m.total_shares.toLocaleString()}</strong>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onOpenViralModal({ id: m.movie_id, title: m.title })}
                                            className="w-full mt-2 text-sm font-bold gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10"
                                        >
                                            <Play className="w-3.5 h-3.5 fill-primary" />
                                            View Viral Intelligence
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground border border-border/40 rounded-xl bg-card">
                            No video records matching the current filter found for {selectedDate}.
                        </div>
                    )
                ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No video records found for {selectedDate}.
                    </div>
                )}
            </TabsContent>

            {/* TAB 2: AUDIENCE COMMENTS */}
            <TabsContent value="comments" className="space-y-3.5">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search in comments or topics..."
                            value={commentSearch}
                            onChange={(e) => setCommentSearch(e.target.value)}
                            className="pl-9 bg-muted/20 text-sm h-8"
                        />
                    </div>
                    <span className="text-sm text-muted-foreground">
                        Showing <span className="font-mono font-medium">{filteredComments.length}</span> comments for {selectedDate}
                    </span>
                </div>

                {filteredComments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                        {filteredComments.slice(0, visibleCommentCount).map((comment) => (
                            <Card key={comment.id} className="bg-card border-border/40 p-3.5 space-y-2.5 flex flex-col justify-between">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                <User className="w-3 h-3" />
                                            </div>
                                            <a
                                                href={`https://www.tiktok.com/@${comment.authorName.replace(/^@/, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={`Open @${comment.authorName} on TikTok`}
                                                className="text-sm font-semibold text-foreground hover:text-primary hover:underline truncate inline-flex items-center gap-1 transition-colors"
                                            >
                                                @{comment.authorName}
                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                            </a>
                                        </div>
                                        <Badge variant="outline" className="text-sm font-normal shrink-0">
                                            {comment.movieTitle}
                                        </Badge>
                                    </div>

                                    <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                                        &ldquo;{comment.text}&rdquo;
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground border-t border-border/20">
                                    <span className="flex items-center gap-1 text-rose-500 font-medium">
                                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                                        <span className="font-mono">{comment.diggCount}</span> likes
                                    </span>
                                    <Badge variant="secondary" className="text-sm font-normal">
                                        {comment.topic}
                                    </Badge>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-sm text-muted-foreground border border-border/40 rounded-xl bg-card">
                        Raw comment snippets are captured during the live crawler pass. Aggregated sentiment metrics are reflected in the Theatrical Lineup table above.
                    </div>
                )}

                {filteredComments.length > visibleCommentCount && (
                    <div className="flex justify-center pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisibleCommentCount((prev) => prev + 30)}
                            className="text-sm font-semibold rounded-lg"
                        >
                            Load More Comments ({filteredComments.length - visibleCommentCount} remaining)
                        </Button>
                    </div>
                )}
            </TabsContent>

            {/* TAB 3: DAILY RAW JSON */}
            <TabsContent value="raw" className="space-y-3.5">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Full aggregated daily multi-movie dataset for <strong className="text-foreground">{selectedDate}</strong>
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyJson}
                        className="gap-2 text-sm font-medium h-8"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy JSON'}
                    </Button>
                </div>

                <div className="bg-zinc-950 text-zinc-200 p-4 rounded-xl border border-border/40 overflow-x-auto max-h-[600px] font-mono text-sm leading-relaxed">
                    <pre>{JSON.stringify({
                        date: selectedDate,
                        hasPulseData,
                        pulseData: pulseRawResponse,
                        actionableInsights,
                        todayMovieSentimentList,
                        totalPosts: filteredPosts.length,
                        totalComments: filteredComments.length,
                        topPosts: filteredPosts.slice(0, 50),
                        sampleComments: filteredComments.slice(0, 50),
                    }, null, 2)}</pre>
                </div>
            </TabsContent>
        </Tabs>
    );
}
