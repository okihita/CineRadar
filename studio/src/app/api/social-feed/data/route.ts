/**
 * /api/social-feed/data?date=2026-05-04
 *
 * GET  — Loads persisted posts and hourly AI analysis from Firestore
 * DELETE — Removes all posts and analyses for a date (clean slate)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, type FirestoreSocialPost, type FirestoreSocialAnalysis } from '@/lib/firestore-social';

function validateDate(searchParams: URLSearchParams): string | null {
    const date = searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return date;
}

/** Convert a Jakarta date to UTC ISO string range for Firestore queries */
function jakartaDayToUtcRange(date: string): { after: string; before: string } {
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(`${date}T23:59:59.999+07:00`);
    return {
        after: start.toISOString(),
        before: end.toISOString(),
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

        const [posts, analyses] = await Promise.all([
            firestoreRestClient.runQuery<FirestoreSocialPost>({
                from: [{ collectionId: COLLECTIONS.POSTS }],
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
            firestoreRestClient.runQuery<FirestoreSocialAnalysis>({
                from: [{ collectionId: COLLECTIONS.ANALYSIS }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'date' },
                        op: 'EQUAL',
                        value: { stringValue: date },
                    },
                },
            }),
        ]);

        const hasData = posts.length > 0 || analyses.length > 0;

        return NextResponse.json({
            success: true,
            data: {
                date,
                has_data: hasData,
                posts,
                analyses,
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
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const date = validateDate(new URL(request.url).searchParams);
        if (!date) {
            return NextResponse.json(
                { success: false, error: 'Invalid date. Use YYYY-MM-DD format.' },
                { status: 400 },
            );
        }

        const { after: publishedAfter, before: publishedBefore } = jakartaDayToUtcRange(date);

        const [postsDeleted, analysesDeleted] = await Promise.all([
            firestoreRestClient.deleteByQuery({
                from: [{ collectionId: COLLECTIONS.POSTS }],
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
                from: [{ collectionId: COLLECTIONS.ANALYSIS }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'date' },
                        op: 'EQUAL',
                        value: { stringValue: date },
                    },
                },
            }),
        ]);

        console.log(`[Delete] Removed ${postsDeleted} posts, ${analysesDeleted} analyses for ${date}`);

        return NextResponse.json({
            success: true,
            data: {
                date,
                posts_deleted: postsDeleted,
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
