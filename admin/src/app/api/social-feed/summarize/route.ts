/**
 * POST /api/social-feed/summarize
 *
 * Retry AI summarization for specific hours.
 * Admin-only.
 *
 * Body: { date: "2026-05-04", hours: [7, 8] }
 *   - hours: array of hour numbers (0-23) to retry
 *   - If hours is empty/missing, retries ALL failed hours for that date
 *
 * Returns JSON (not SSE) with per-hour results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COLLECTIONS, type FirestoreSocialAnalysis, type FirestoreSocialPost } from '@/lib/firestore-social';
import { summarizeHour } from '@/lib/summarize';

function isAdmin(session: unknown): boolean {
    return (session as { user?: { role?: string } })?.user?.role === 'admin';
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const body = await request.json();
        const { date, hours } = body as { date: string; hours?: number[] };

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ success: false, error: 'Invalid date format.' }, { status: 400 });
        }

        // Fetch all analyses for the date to find failed ones
        const analyses = await firestoreRestClient.runQuery<FirestoreSocialAnalysis>({
            from: [{ collectionId: COLLECTIONS.ANALYSIS }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'date' },
                    op: 'EQUAL',
                    value: { stringValue: date },
                },
            },
        });

        // Also fetch all posts for the date (to avoid per-hour queries)
        const dayStart = new Date(`${date}T00:00:00+07:00`);
        const dayEnd = new Date(`${date}T23:59:59+07:00`);
        const allPosts = await firestoreRestClient.runQuery<FirestoreSocialPost>({
            from: [{ collectionId: COLLECTIONS.POSTS }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        {
                            fieldFilter: {
                                field: { fieldPath: 'published_at' },
                                op: 'GREATER_THAN_OR_EQUAL',
                                value: { stringValue: dayStart.toISOString() },
                            },
                        },
                        {
                            fieldFilter: {
                                field: { fieldPath: 'published_at' },
                                op: 'LESS_THAN_OR_EQUAL',
                                value: { stringValue: dayEnd.toISOString() },
                            },
                        },
                    ],
                },
            },
            orderBy: [{ field: { fieldPath: 'published_at' }, direction: 'DESCENDING' }],
        });

        const analysisMap = new Map<number, FirestoreSocialAnalysis>();
        for (const a of analyses) analysisMap.set(a.hour, a);

        // Determine which hours to retry
        let hoursToRetry: number[];

        if (hours && hours.length > 0) {
            hoursToRetry = hours.filter(h => h >= 0 && h < 24);
        } else {
            // Auto-detect: retry hours where analysis has error summary, or has posts but no analysis
            const failedAnalysisHours = analyses
                .filter(a => a.summary?.startsWith('⚠️'))
                .map(a => a.hour);

            // Also find hours with posts but no analysis doc at all
            const postHourSet = new Set<number>();
            for (const p of allPosts) {
                const jakartaTime = new Date(p.published_at).toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false });
                const h = parseInt(jakartaTime, 10);
                if (!analysisMap.has(h)) postHourSet.add(h);
            }

            hoursToRetry = [...new Set([...failedAnalysisHours, ...postHourSet])].sort((a, b) => a - b);
        }

        if (hoursToRetry.length === 0) {
            return NextResponse.json({
                success: true,
                data: { date, retried: [], message: 'No hours need retry.' },
            });
        }

        // Execute retries sequentially (to avoid Gemini rate limits)
        const results = [];
        for (const hour of hoursToRetry) {
            const result = await summarizeHour(date, hour, { existingPosts: allPosts });
            results.push(result);

            // Small delay between retries to avoid rate limits
            if (hoursToRetry.indexOf(hour) < hoursToRetry.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            data: {
                date,
                retried: results,
                succeeded,
                failed,
            },
        });
    } catch (error) {
        console.error('[Summarize Error]', error);
        return NextResponse.json({ success: false, error: 'Summarization failed.' }, { status: 500 });
    }
}
