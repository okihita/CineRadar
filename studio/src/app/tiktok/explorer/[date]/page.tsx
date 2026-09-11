'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTodayJakarta, isValidDateFormat } from '@/lib/timeUtils';
import { useTheatricalRadarData } from '../_hooks/useTheatricalRadarData';
import { TheatricalRadarHeader } from '../_components/TheatricalRadarHeader';
import {
    TheatricalLoadingState,
    FutureDateState,
    PastDateUnrecordedState,
    MorningPendingBanner,
} from '../_components/TheatricalEmptyStates';
import { ActionableSignalsSection } from '../_components/ActionableSignalsSection';
import { SentimentLineupSection } from '../_components/SentimentLineupSection';
import { ExplorerTabsSection } from '../_components/ExplorerTabsSection';
import { MovieViralExplorerModal } from '@/components/tiktok/MovieViralExplorerModal';

export default function TikTokExplorerDatePage() {
    const router = useRouter();
    const params = useParams<{ date: string }>();
    const today = getTodayJakarta();

    const rawRouteDate = params?.date || '';
    const selectedDate = isValidDateFormat(rawRouteDate) ? rawRouteDate : today;

    // Redirect invalid dates to today
    useEffect(() => {
        if (rawRouteDate && !isValidDateFormat(rawRouteDate)) {
            router.replace(`/tiktok/explorer/${today}`);
        }
    }, [rawRouteDate, today, router]);

    const [selectedMovieFilter, setSelectedMovieFilter] = useState<string>('all');
    const [modalMovie, setModalMovie] = useState<{ id: string; title: string } | null>(null);

    // Fetch and synthesize data via custom hook (SRP / DIP)
    const {
        pulseLeaderboard,
        hasPulseData,
        pulseRawResponse,
        isLiveLoading,
        isScheduleLoading,
        crawlDate,
        hasSocialCrawl,
        hasNightRunHappened,
        allPosts,
        allComments,
        actionableInsights,
        todayMovieSentimentList,
        totalPostsCount,
        totalCommentsCount,
    } = useTheatricalRadarData(selectedDate);

    return (
        <div className="p-6 space-y-6 w-full">
            {/* Header & Date Controller */}
            <TheatricalRadarHeader
                selectedDate={selectedDate}
                today={today}
                onDateChange={(newDate) => router.push(`/tiktok/explorer/${newDate}`)}
            />

            {isLiveLoading && !hasPulseData ? (
                <TheatricalLoadingState />
            ) : selectedDate > today ? (
                <FutureDateState
                    selectedDate={selectedDate}
                    today={today}
                    onJumpToToday={() => router.push(`/tiktok/explorer/${today}`)}
                />
            ) : selectedDate < today && !hasSocialCrawl ? (
                <PastDateUnrecordedState
                    selectedDate={selectedDate}
                    targetDate={crawlDate || today}
                    onJumpToDate={(target) => router.push(`/tiktok/explorer/${target}`)}
                />
            ) : (
                <>
                    {/* Morning Theatrical Lineup Banner when Social Crawl is Pending */}
                    {!hasSocialCrawl || !actionableInsights ? (
                        <MorningPendingBanner activeTitlesCount={todayMovieSentimentList.length} />
                    ) : (
                        <ActionableSignalsSection
                            insights={actionableInsights}
                            selectedDate={selectedDate}
                            totalPostsCount={totalPostsCount}
                            totalCommentsCount={totalCommentsCount}
                            hasNightRunHappened={hasNightRunHappened}
                            hasPulseData={hasPulseData}
                        />
                    )}

                    {/* Theatrical Lineup & Sentiment Analysis */}
                    <SentimentLineupSection
                        movieList={todayMovieSentimentList}
                        selectedMovieFilter={selectedMovieFilter}
                        onSelectMovieFilter={setSelectedMovieFilter}
                        onOpenViralModal={setModalMovie}
                        selectedDate={selectedDate}
                        isScheduleLoading={isScheduleLoading}
                        hasPulseData={hasPulseData}
                    />

                    {/* Main Tabs Feed Section */}
                    <ExplorerTabsSection
                        allPosts={allPosts}
                        allComments={allComments}
                        pulseLeaderboard={pulseLeaderboard}
                        actionableInsights={actionableInsights}
                        todayMovieSentimentList={todayMovieSentimentList}
                        pulseRawResponse={pulseRawResponse}
                        selectedDate={selectedDate}
                        selectedMovieFilter={selectedMovieFilter}
                        onSelectMovieFilter={setSelectedMovieFilter}
                        onOpenViralModal={setModalMovie}
                        hasPulseData={hasPulseData}
                    />
                </>
            )}

            {/* Movie Viral Posts & Sentiment Explorer Modal */}
            <MovieViralExplorerModal
                isOpen={modalMovie !== null}
                onClose={() => setModalMovie(null)}
                movieId={modalMovie?.id || null}
                movieTitle={modalMovie?.title || ''}
                date={selectedDate}
            />
        </div>
    );
}
