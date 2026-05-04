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

/** Convert a Jakarta date to UTC ISO string range for Firestore queries */
function jakartaDayToUtcRange(date: string): { after: string; before: string } {
    // Jakarta = UTC+7, so 2026-05-05 00:00+07:00 = 2026-05-04T17:00:00Z
    // and 2026-05-05 23:59:59+07:00 = 2026-05-05T16:59:59Z
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(`${date}T23:59:59+07:00`);
    return {
        after: start.toISOString(),   // "2026-05-04T17:00:00.000Z"
        before: end.toISOString(),     // "2026-05-05T16:59:59.000Z"
    };
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

        const { after: publishedAfter, before: publishedBefore } = jakartaDayToUtcRange(date);

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

        const { after: publishedAfter, before: publishedBefore } = jakartaDayToUtcRange(date);

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
