import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { getTodayJakarta } from '@/lib/timeUtils';
import { normalizeTitleForMatching, extractMovieTitleFromText } from '@/features/tiktok/utils';
import type {
    PulseLeaderboardItem,
    ExplorerPost,
    ExplorerComment,
    DailyPulseDoc,
    ActionableInsights,
    MovieSentimentItem,
    TikTokSourcesResponse,
    TikTokDiscoveryResponse,
} from '@/features/tiktok/types';
import type { ScheduleResponse, MovieSchedule } from '@/features/schedules/types';

export function useTheatricalRadarData(selectedDate: string) {
    const today = getTodayJakarta();

    // 1. Fetch daily 18:00 WIB social pulse leaderboard
    const { data: pulseResponse } = useSWR<{
        success: boolean;
        data?: DailyPulseDoc;
    }>(`/api/socials/tiktok/pulse?date=${selectedDate}`, fetcher, { revalidateOnFocus: false });

    const pulseLeaderboard: PulseLeaderboardItem[] = useMemo(() => {
        return pulseResponse?.data?.leaderboard || [];
    }, [pulseResponse]);

    const hasPulseData = pulseLeaderboard.length > 0 || Boolean(pulseResponse?.data?.ai_insights);

    // 2. Fetch real live scraped dataset
    const { data: liveResponse, isLoading: isLiveLoading } = useSWR(
        '/api/socials/tiktok?hashtag=latest',
        fetcher,
        { revalidateOnFocus: false }
    );
    const liveData = liveResponse?.data;

    // 3. Fetch movies with actual showtimes from schedules_v2
    const { data: scheduleResponse, isLoading: isScheduleLoading } = useSWR<ScheduleResponse>(
        `/api/schedules?date=${selectedDate}`,
        fetcher,
        { revalidateOnFocus: false }
    );
    const activeShowtimeMovies: MovieSchedule[] = useMemo(() => {
        return scheduleResponse?.movies || [];
    }, [scheduleResponse]);

    // 4. Fetch truth seed accounts and manual overrides
    const { data: sourcesResponse } = useSWR<TikTokSourcesResponse>(
        '/api/socials/tiktok/sources',
        fetcher,
        { revalidateOnFocus: false }
    );
    const sourcesData = sourcesResponse;

    // 5. Fetch daily 08:00 WIB discovery snapshot
    const { data: discoveryResponse } = useSWR<TikTokDiscoveryResponse>(
        `/api/socials/tiktok/discovery?date=${selectedDate}`,
        fetcher,
        { revalidateOnFocus: false }
    );

    const discoveryMovies = useMemo(() => {
        return discoveryResponse?.data?.movies || {};
    }, [discoveryResponse]);

    // Crawl date timestamp normalized to Asia/Jakarta (WIB)
    const crawlDate = useMemo(() => {
        if (!liveData?.executed_at) return today;
        const d = new Date(liveData.executed_at);
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
    }, [liveData, today]);

    const isDataAvailableForDate = selectedDate === crawlDate;
    const hasSocialCrawl = hasPulseData || (isDataAvailableForDate && Boolean(liveData?.posts?.length));

    // Check if the night crawl window (23:00 WIB) has executed for the active dataset
    const hasNightRunHappened = useMemo(() => {
        if (!liveData?.executed_at) return false;
        const d = new Date(liveData.executed_at);
        const jakartaHour = Number(new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: 'Asia/Jakarta',
        }).format(d));
        return jakartaHour >= 22;
    }, [liveData]);

    // --- Map Real Posts ---
    const allPosts: ExplorerPost[] = useMemo(() => {
        if (!isDataAvailableForDate || !liveData?.posts) return [];
        const rawPosts = liveData.posts as ExplorerPost[];

        return rawPosts.map((p) => {
            const rawTag = (p.platform_data?.campaign_hashtag || '').toLowerCase().replace('#', '');
            const likes = p.metrics?.likes || 0;

            const matchedMovie = activeShowtimeMovies.find((m) => {
                const cleanM = normalizeTitleForMatching(m.title);
                return cleanM.includes(rawTag) || (rawTag && rawTag.includes(cleanM));
            });
            const movieTitle = matchedMovie?.title || (rawTag ? rawTag.toUpperCase() : 'THEATRICAL POST');

            return {
                id: p.id,
                movieTitle,
                hashtag: rawTag ? `#${rawTag}` : '#bioskop',
                title: p.title || p.text?.slice(0, 80) || '',
                text: p.text || '',
                url: p.url || '',
                published_at: p.published_at || new Date().toISOString(),
                source_name: p.source_name || 'TikTok Creator',
                source_handle: p.source_handle || '@creator',
                source_avatar: p.source_avatar || '',
                thumbnail: p.thumbnail || '',
                metrics: p.metrics || { views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
                sentiment: (likes > 20000 || p.text?.toLowerCase().includes('bagus') || p.text?.toLowerCase().includes('keren') ? 'positive' : 'mixed') as 'positive' | 'mixed' | 'negative',
                tiktok_sound: p.platform_data?.tiktok_sound || '',
            };
        });
    }, [isDataAvailableForDate, liveData, activeShowtimeMovies]);

    // --- Map Real Comments ---
    const allComments: ExplorerComment[] = useMemo(() => {
        if (!isDataAvailableForDate || !liveData?.comments) return [];
        const rawComments = liveData.comments as Array<Record<string, unknown>>;
        const postsList = (liveData.posts || []) as Array<{ id: string; platform_data?: { campaign_hashtag?: string } }>;

        return rawComments.map((c, idx) => {
            const videoId = String(c.videoId || '');
            const text = String(c.text || '');
            const diggCount = Number(c.diggCount || 0);
            const authorName = String(c.authorName || 'user');

            const matchingPost = postsList.find((p) => p.id.includes(videoId));
            const rawTag = (matchingPost?.platform_data?.campaign_hashtag || '').toLowerCase().replace('#', '');
            const matchedMovie = activeShowtimeMovies.find((m) => {
                const cleanM = normalizeTitleForMatching(m.title);
                return cleanM.includes(rawTag) || (rawTag && rawTag.includes(cleanM));
            });
            const movieTitle = matchedMovie?.title || (rawTag ? rawTag.toUpperCase() : 'AUDIENCE REACTION');

            return {
                id: String(c.id || `live_c_${idx}`),
                movieTitle,
                text,
                diggCount,
                authorName,
                sentiment: (diggCount > 50 || text.toLowerCase().includes('keren') || text.toLowerCase().includes('bagus') ? 'positive' : 'mixed') as 'positive' | 'mixed' | 'negative',
                topic: text.toLowerCase().includes('tiket') ? 'Ticketing & Availability'
                    : text.toLowerCase().includes('ending') || text.toLowerCase().includes('plot') ? 'Story & Ending'
                    : text.toLowerCase().includes('akting') || text.toLowerCase().includes('aktor') ? 'Performance & Cast'
                    : 'Audience Reaction',
            };
        });
    }, [isDataAvailableForDate, liveData, activeShowtimeMovies]);

    // --- Actionable Market Signals (Live AI or Firestore Pulse Synthesis) ---
    const actionableInsights: ActionableInsights | null = useMemo(() => {
        if (!hasSocialCrawl) return null;

        // Preferred source 1: Official Firestore Daily Pulse (with Gemini 3.8 Flash intelligence)
        if (hasPulseData || pulseResponse?.data) {
            const pulseDoc = pulseResponse?.data;
            const pulseAi = pulseDoc?.ai_insights;
            const knownMovies = [...pulseLeaderboard, ...activeShowtimeMovies];

            const sortedByViews = [...pulseLeaderboard].sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
            const sortedByLikes = [...pulseLeaderboard].sort((a, b) => (b.total_likes || 0) - (a.total_likes || 0));
            const sortedByShares = [...pulseLeaderboard].sort((a, b) => (b.total_shares || 0) - (a.total_shares || 0));

            const topViewMovie = sortedByViews[0];
            const topLikeMovie = sortedByLikes[0];
            const topShareMovie = sortedByShares[0];
            const frictionMovie = pulseLeaderboard.find((m) => (m.sentiment?.negative || 0) > 10) || pulseLeaderboard[pulseLeaderboard.length - 1];

            const totalViews = pulseLeaderboard.reduce((s, m) => s + (m.total_views || 0), 0) || allPosts.reduce((s, p) => s + (p.metrics?.views || 0), 0);
            const totalShares = pulseLeaderboard.reduce((s, m) => s + (m.total_shares || 0), 0) || allPosts.reduce((s, p) => s + (p.metrics?.shares || 0), 0);
            const totalLikes = pulseLeaderboard.reduce((s, m) => s + (m.total_likes || 0), 0) || allPosts.reduce((s, p) => s + (p.metrics?.likes || 0), 0);

            // 1. Share of Voice Leader
            const sovTitle = extractMovieTitleFromText(pulseAi?.share_of_voice_leader, knownMovies)
                || topViewMovie?.title
                || allPosts[0]?.movieTitle
                || activeShowtimeMovies[0]?.title
                || 'Dominant Theatrical Slate';
            const sovInsight = pulseAi?.share_of_voice_leader
                || (topViewMovie ? `${(topViewMovie.total_views || 0).toLocaleString()} views on TikTok (#1 Buzz Leader)` : `${(totalViews / 1000000).toFixed(1)}M daily impressions across theatrical campaigns`);
            const sovMetricValue = topViewMovie?.total_views
                ? (topViewMovie.total_views >= 1000000 ? `${(topViewMovie.total_views / 1000000).toFixed(1)}M` : topViewMovie.total_views.toLocaleString())
                : '#1 Buzz';

            // 2. Organic WoM Ratio
            const womPctMatch = pulseAi?.organic_wom_ratio?.match(/(\d+)%/);
            const womPct = womPctMatch
                ? parseInt(womPctMatch[1], 10)
                : (topLikeMovie?.sentiment?.positive ?? (pulseLeaderboard.length > 0 ? Math.round(pulseLeaderboard.reduce((s, m) => s + (m.sentiment?.positive || 70), 0) / pulseLeaderboard.length) : 75));
            const womTitle = topLikeMovie?.title
                || extractMovieTitleFromText(pulseAi?.organic_wom_ratio, knownMovies)
                || 'Audience Consensus';
            const womInsight = pulseAi?.organic_wom_ratio
                || (topLikeMovie ? `${(topLikeMovie.total_likes || 0).toLocaleString()} likes (${topLikeMovie.total_views ? ((topLikeMovie.total_likes / topLikeMovie.total_views) * 100).toFixed(1) : '0'}% like-to-view ratio)` : `${womPct}% authentic audience conversation ratio`);

            // 3. Virality Velocity
            const virPctMatch = pulseAi?.virality_velocity_leader?.match(/(\d+(?:\.\d+)?%)/);
            const virTitle = extractMovieTitleFromText(pulseAi?.virality_velocity_leader, knownMovies)
                || topShareMovie?.title
                || 'Viral Momentum';
            const virShares = topShareMovie?.total_shares || totalShares;
            const virMetricValue = virPctMatch
                ? virPctMatch[1]
                : (virShares > 0 ? (virShares >= 1000000 ? `${(virShares / 1000000).toFixed(1)}M` : virShares.toLocaleString()) : 'Surging');
            const virInsight = pulseAi?.virality_velocity_leader
                || (topShareMovie ? `${(topShareMovie.total_shares || 0).toLocaleString()} organic shares across audience feeds` : 'High share-to-view conversion across fan edits');

            // 4. Critical Friction Alert
            const fricTitle = extractMovieTitleFromText(pulseAi?.critical_friction_alert, knownMovies)
                || frictionMovie?.title
                || 'Circuit Allocation & Capacity';
            const fricComplaint = pulseAi?.critical_friction_alert
                || frictionMovie?.sentiment?.criticism_themes?.[0]
                || 'Ketersediaan jam tayang dan pembagian layar bioskop';

            return {
                totalViews,
                totalShares,
                sovLeader: {
                    title: sovTitle,
                    insight: sovInsight,
                    metricValue: sovMetricValue,
                    metricLabel: 'Volume Leader',
                },
                womWinner: {
                    title: womTitle,
                    positivePct: womPct,
                    insight: womInsight,
                    metricValue: `${womPct}%`,
                    metricLabel: 'Organic WoM',
                },
                viralityLeader: {
                    title: virTitle,
                    shares: virShares,
                    insight: virInsight,
                    metricValue: virMetricValue,
                    metricLabel: virPctMatch ? 'Velocity' : 'Shares',
                },
                frictionTarget: {
                    title: fricTitle,
                    topComplaint: fricComplaint,
                    metricValue: 'Watch',
                    metricLabel: 'Attention Point',
                },
                morningBriefing: pulseAi?.morning_briefing || `Daily 18:00 WIB Social Pulse recorded ${pulseLeaderboard.length} active theatrical movies across Cinema XXI, CGV, and Cinepolis with ${(totalViews / 1000000).toFixed(1)}M aggregated views and ${(totalLikes / 1000000).toFixed(1)}M likes.`,
                nightBriefing: pulseAi?.night_briefing || 'Evening showtime tracking confirms sustained engagement for top theatrical releases heading into prime showtimes.',
            };
        }

        // Preferred source 2: Dynamic computation from live scraped posts (if pulse doc not yet written)
        if (isDataAvailableForDate && allPosts.length > 0) {
            const totalViews = allPosts.reduce((s, p) => s + (p.metrics?.views || 0), 0);
            const totalShares = allPosts.reduce((s, p) => s + (p.metrics?.shares || 0), 0);

            // Group by movie dynamically
            const movieMap = new Map<string, { views: number; likes: number; shares: number; postCount: number }>();
            allPosts.forEach((p) => {
                const cur = movieMap.get(p.movieTitle) || { views: 0, likes: 0, shares: 0, postCount: 0 };
                cur.views += p.metrics?.views || 0;
                cur.likes += p.metrics?.likes || 0;
                cur.shares += p.metrics?.shares || 0;
                cur.postCount += 1;
                movieMap.set(p.movieTitle, cur);
            });

            const sortedByViews = [...movieMap.entries()].sort((a, b) => b[1].views - a[1].views);
            const sortedByLikes = [...movieMap.entries()].sort((a, b) => b[1].likes - a[1].likes);
            const sortedByShares = [...movieMap.entries()].sort((a, b) => b[1].shares - a[1].shares);

            const topView = sortedByViews[0];
            const topLike = sortedByLikes[0];
            const topShare = sortedByShares[0];

            const positivePostsCount = allPosts.filter((p) => p.sentiment === 'positive').length;
            const livePositivePct = allPosts.length > 0 ? Math.round((positivePostsCount / allPosts.length) * 100) : 75;

            return {
                totalViews,
                totalShares,
                sovLeader: {
                    title: topView ? topView[0] : (activeShowtimeMovies[0]?.title || 'Dominant Title'),
                    insight: `${((totalViews / 1000000)).toFixed(1)}M daily impressions across tracked theatrical campaigns`,
                    metricValue: topView ? (topView[1].views >= 1000000 ? `${(topView[1].views / 1000000).toFixed(1)}M` : topView[1].views.toLocaleString()) : '#1 Buzz',
                    metricLabel: 'Volume Leader',
                },
                womWinner: {
                    title: topLike ? topLike[0] : 'Audience Excitement',
                    positivePct: livePositivePct,
                    insight: `${livePositivePct}% organic audience positive sentiment ratio across ${allPosts.length} tracked posts`,
                    metricValue: `${livePositivePct}%`,
                    metricLabel: 'Organic WoM',
                },
                viralityLeader: {
                    title: topShare ? topShare[0] : 'Daily Momentum',
                    shares: topShare ? topShare[1].shares : totalShares,
                    insight: topShare ? `${topShare[1].shares.toLocaleString()} shares generated across fan edits and reactions` : 'High share-to-view conversion across fan edits',
                    metricValue: topShare ? (topShare[1].shares >= 1000000 ? `${(topShare[1].shares / 1000000).toFixed(1)}M` : topShare[1].shares.toLocaleString()) : 'Surging',
                    metricLabel: 'Shares',
                },
                frictionTarget: {
                    title: 'Capacity & Regional Allocation',
                    topComplaint: 'Limited late-night showtimes and circuit allocation in secondary regions',
                    metricValue: 'Watch',
                    metricLabel: 'Attention Point',
                },
                morningBriefing: 'Early morning engagement spikes across TikTok creator feeds indicate solid momentum for today\'s theatrical titles.',
                nightBriefing: 'Evening showtime audience reactions highlighted strong word-of-mouth and high cinema attendance.',
            };
        }

        return null;
    }, [hasSocialCrawl, hasPulseData, pulseResponse, pulseLeaderboard, activeShowtimeMovies, allPosts, isDataAvailableForDate]);

    // --- Per-Movie Sentiment Breakdown for Today's Active Lineup ---
    const todayMovieSentimentList: MovieSentimentItem[] = useMemo(() => {
        if (activeShowtimeMovies.length === 0 && pulseLeaderboard.length === 0) return [];

        const aiBreakdowns = (liveData?.ai_insights?.movie_breakdowns || {}) as Record<string, {
            top_praise?: string;
            top_complaint?: string;
            positive_pct?: number;
            mixed_pct?: number;
            negative_pct?: number;
        }>;

        const list: MovieSentimentItem[] = activeShowtimeMovies.map((m) => {
            const cleanTag = normalizeTitleForMatching(m.title);
            const mPosts = allPosts.filter((p) =>
                p.movieTitle.toLowerCase() === m.title.toLowerCase() ||
                p.hashtag.toLowerCase().includes(cleanTag)
            );
            const mComments = allComments.filter((c) =>
                c.movieTitle.toLowerCase() === m.title.toLowerCase()
            );

            // Match from daily 18:00 WIB pulse leaderboard if available
            const pulseMatch = pulseLeaderboard.find((p) => {
                if (p.movie_id && m.movie_id && p.movie_id === m.movie_id) return true;
                const cleanP = normalizeTitleForMatching(p.title);
                if (!cleanP || !cleanTag) return false;
                return cleanP === cleanTag || cleanTag.includes(cleanP) || cleanP.includes(cleanTag);
            });

            const views = pulseMatch?.total_views ?? mPosts.reduce((s, p) => s + (p.metrics?.views || 0), 0);
            const likes = pulseMatch?.total_likes ?? mPosts.reduce((s, p) => s + (p.metrics?.likes || 0), 0);
            const shares = pulseMatch?.total_shares ?? mPosts.reduce((s, p) => s + (p.metrics?.shares || 0), 0);
            const hasCrawlData = Boolean(pulseMatch || (hasSocialCrawl && views > 0));

            const breakdown = aiBreakdowns[cleanTag] || {};
            const positivePct = pulseMatch?.sentiment?.positive ?? breakdown.positive_pct ?? (
                mComments.length > 0
                    ? Math.round((mComments.filter((c) => c.sentiment === 'positive').length / mComments.length) * 100)
                    : (hasCrawlData ? 80 : 0)
            );
            const negativePct = pulseMatch?.sentiment?.negative ?? breakdown.negative_pct ?? (
                mComments.length > 0
                    ? Math.round((mComments.filter((c) => c.sentiment === 'negative').length / mComments.length) * 100)
                    : (hasCrawlData ? 5 : 0)
            );
            const mixedPct = hasCrawlData ? (100 - positivePct - negativePct) : 0;

            const topPraise = pulseMatch?.sentiment?.praise_points?.[0] || breakdown.top_praise || (
                mComments[0]?.text
                    ? `"${mComments[0].text.slice(0, 90)}..."`
                    : (hasCrawlData ? 'Diskusi audiens dan antusiasme penonton aktif' : 'Scheduled for 18:00 WIB crawl')
            );
            const topComplaint = pulseMatch?.sentiment?.criticism_themes?.[0] || breakdown.top_complaint || (
                mComments.find((c) => c.sentiment === 'mixed')?.text
                    ? `"${mComments.find((c) => c.sentiment === 'mixed')?.text.slice(0, 90)}..."`
                    : (hasCrawlData ? 'Ketersediaan jam tayang di bioskop' : 'Scheduled for 18:00 WIB crawl')
            );

            const movieOverrides = sourcesData?.overrides?.[m.title.toUpperCase()] || [];
            const snapshotTags = discoveryMovies[m.title.toUpperCase()]?.discovered_hashtags || [];

            const discoveredTags = movieOverrides.length > 0
                ? movieOverrides.map((t) => `#${t.replace(/^#/, '')}`)
                : (snapshotTags.length > 0
                    ? snapshotTags.map((t) => `#${t.replace(/^#/, '')}`)
                    : (hasCrawlData && mPosts.length > 0 ? [`#${cleanTag}`] : []));

            const hashtagDisplay = discoveredTags.length > 0 ? discoveredTags.join(' ') : null;

            const totalShowtimes = Object.values(m.cities || {}).reduce((cSum, theatres) => {
                return cSum + (theatres || []).reduce((tSum, t) => {
                    return tSum + (t.rooms || []).reduce((rSum, r) => rSum + (r.all_showtimes?.length || r.showtimes?.length || 0), 0);
                }, 0);
            }, 0);

            return {
                id: m.movie_id,
                title: m.title,
                hashtag: hashtagDisplay,
                discoveredTags,
                showtimes_count: totalShowtimes,
                merchants: m.merchants || [],
                genres: m.genres || [],
                age_category: m.age_category || 'SU',
                views,
                likes,
                shares,
                hasSocialCrawl: hasCrawlData,
                postsCount: pulseMatch?.posts_count || mPosts.length,
                positivePct,
                mixedPct,
                negativePct,
                topPraise,
                topComplaint,
            };
        });

        // Ensure any pulse leaderboard movies not matched in active showtimes are also included
        pulseLeaderboard.forEach((pm) => {
            const cleanTag = normalizeTitleForMatching(pm.title);
            const alreadyInList = list.some((m) => {
                if (m.id && pm.movie_id && m.id === pm.movie_id) return true;
                const cleanM = normalizeTitleForMatching(m.title);
                if (!cleanM || !cleanTag) return false;
                return cleanM === cleanTag || cleanTag.includes(cleanM) || cleanM.includes(cleanTag);
            });

            if (!alreadyInList) {
                const movieOverrides = sourcesData?.overrides?.[pm.title.toUpperCase()] || [];
                const snapshotTags = discoveryMovies[pm.title.toUpperCase()]?.discovered_hashtags || [];
                const discoveredTags = movieOverrides.length > 0
                    ? movieOverrides.map((t) => `#${t.replace(/^#/, '')}`)
                    : (snapshotTags.length > 0 ? snapshotTags.map((t) => `#${t.replace(/^#/, '')}`) : [`#${cleanTag}`]);

                list.push({
                    id: pm.movie_id,
                    title: pm.title,
                    hashtag: discoveredTags.join(' '),
                    discoveredTags,
                    showtimes_count: 0,
                    merchants: [],
                    genres: [],
                    age_category: 'SU',
                    views: pm.total_views || 0,
                    likes: pm.total_likes || 0,
                    shares: pm.total_shares || 0,
                    hasSocialCrawl: true,
                    postsCount: pm.posts_count || 0,
                    positivePct: pm.sentiment?.positive ?? 80,
                    mixedPct: pm.sentiment?.mixed ?? 15,
                    negativePct: pm.sentiment?.negative ?? 5,
                    topPraise: pm.sentiment?.praise_points?.[0] || 'Diskusi audiens dan antusiasme penonton aktif',
                    topComplaint: pm.sentiment?.criticism_themes?.[0] || 'Ketersediaan jam tayang di bioskop',
                });
            }
        });

        // Sort descending by 24h views
        list.sort((a, b) => (b.views || 0) - (a.views || 0));

        return list;
    }, [activeShowtimeMovies, pulseLeaderboard, hasSocialCrawl, allPosts, allComments, liveData, sourcesData, discoveryMovies]);

    const totalPostsCount = allPosts.length > 0
        ? allPosts.length
        : pulseLeaderboard.reduce((s, m) => s + (m.posts_count || 0), 0);

    const totalCommentsCount = allComments.length > 0
        ? allComments.length
        : pulseLeaderboard.reduce((s, m) => s + (m.total_comments || 0), 0);

    return {
        today,
        selectedDate,
        pulseLeaderboard,
        hasPulseData,
        pulseRawResponse: pulseResponse?.data || null,
        isLiveLoading,
        isScheduleLoading,
        crawlDate,
        isDataAvailableForDate,
        hasSocialCrawl,
        hasNightRunHappened,
        allPosts,
        allComments,
        actionableInsights,
        todayMovieSentimentList,
        totalPostsCount,
        totalCommentsCount,
    };
}
