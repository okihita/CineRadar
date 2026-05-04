/**
 * /api/social-feed/data?date=2026-05-04
 *
 * GET  — Loads persisted YouTube videos and hourly AI analysis from Firestore
 * DELETE — Removes all videos and analyses for a date (clean slate)
 */

import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, type FirestoreYouTubeVideo, type FirestoreHourlyAnalysis } from '@/lib/firestore-youtube';

function validateDate(searchParams: URLSearchParams): string | null {
    const date = searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return date;
}

// ─── GET ───────────────────────────────────────────────

export async function GET(request: Request) {
    try {
        const date = validateDate(new URL(request.url).searchParams);
        if (!date) {
            return NextResponse.json(
                { success: false, error: 'Invalid date. Use YYYY-MM-DD format.' },
                { status: 400 },
            );
        }

        const publishedAfter = `${date}T00:00:00.000Z`;
        const publishedBefore = `${date}T23:59:59.999Z`;

        const [videos, analyses] = await Promise.all([
            firestoreRestClient.runQuery<FirestoreYouTubeVideo>({
                from: [{ collectionId: COLLECTIONS.VIDEOS }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            {
                                fieldFilter: {
                                    field: { fieldPath: 'published_at' },
                                    op: 'GREATER_THAN_OR_EQUAL',
                                    value: { stringValue: publishedAfter },
                                },
                            },
                            {
                                fieldFilter: {
                                    field: { fieldPath: 'published_at' },
                                    op: 'LESS_THAN_OR_EQUAL',
                                    value: { stringValue: publishedBefore },
                                },
                            },
                        ],
                    },
                },
                orderBy: [{ field: { fieldPath: 'published_at' }, direction: 'DESCENDING' }],
            }),
            firestoreRestClient.runQuery<FirestoreHourlyAnalysis>({
                from: [{ collectionId: COLLECTIONS.HOURLY_ANALYSIS }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'date' },
                        op: 'EQUAL',
                        value: { stringValue: date },
                    },
                },
                orderBy: [{ field: { fieldPath: 'hour' }, direction: 'ASCENDING' }],
            }),
        ]);

        const hasData = videos.length > 0 || analyses.length > 0;

        return NextResponse.json({
            success: true,
            data: {
                date,
                has_data: hasData,
                videos,
                analyses,
                video_count: videos.length,
                analysis_count: analyses.length,
            },
        });
    } catch (error) {
        console.error('[Data Load Error]', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load data' },
            { status: 500 },
        );
    }
}

// ─── DELETE ────────────────────────────────────────────

export async function DELETE(request: Request) {
    try {
        const date = validateDate(new URL(request.url).searchParams);
        if (!date) {
            return NextResponse.json(
                { success: false, error: 'Invalid date. Use YYYY-MM-DD format.' },
                { status: 400 },
            );
        }

        const publishedAfter = `${date}T00:00:00.000Z`;
        const publishedBefore = `${date}T23:59:59.999Z`;

        const [videosDeleted, analysesDeleted] = await Promise.all([
            firestoreRestClient.deleteByQuery({
                from: [{ collectionId: COLLECTIONS.VIDEOS }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            {
                                fieldFilter: {
                                    field: { fieldPath: 'published_at' },
                                    op: 'GREATER_THAN_OR_EQUAL',
                                    value: { stringValue: publishedAfter },
                                },
                            },
                            {
                                fieldFilter: {
                                    field: { fieldPath: 'published_at' },
                                    op: 'LESS_THAN_OR_EQUAL',
                                    value: { stringValue: publishedBefore },
                                },
                            },
                        ],
                    },
                },
            }),
            firestoreRestClient.deleteByQuery({
                from: [{ collectionId: COLLECTIONS.HOURLY_ANALYSIS }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'date' },
                        op: 'EQUAL',
                        value: { stringValue: date },
                    },
                },
            }),
        ]);

        console.log(`[Delete] Removed ${videosDeleted} videos, ${analysesDeleted} analyses for ${date}`);

        return NextResponse.json({
            success: true,
            data: {
                date,
                videos_deleted: videosDeleted,
                analyses_deleted: analysesDeleted,
            },
        });
    } catch (error) {
        console.error('[Delete Error]', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete data' },
            { status: 500 },
        );
    }
}
