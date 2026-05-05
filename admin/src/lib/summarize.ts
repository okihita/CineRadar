/**
 * Shared summarizeHour() — single source of truth for generating
 * an AI summary for a specific hour on a specific date.
 *
 * Used by:
 *   - Backfill route (in a loop for all 24 hours)
 *   - Retry endpoint (single hour)
 *   - Batch retry (loop over failed hours)
 */

import { firestoreRestClient } from '@/lib/firestore-rest';
import { generateHourlySummary, type RetryCallback } from '@/lib/gemini';
import {
    COLLECTIONS,
    makeHourId,
    groupPostsByHour,
    type FirestoreSocialPost,
    type FirestoreSocialAnalysis,
} from '@/lib/firestore-social';

export interface SummarizeHourResult {
    success: boolean;
    hourId: string;
    summary: string;
    hashtags: string[];
    postCount: number;
    error?: string;
}

/**
 * Summarize a single hour: fetch posts, call Gemini, write analysis doc.
 *
 * If posts are provided (e.g., from a pre-fetched list), uses those.
 * Otherwise queries Firestore for posts in that hour.
 */
export async function summarizeHour(
    date: string,
    hour: number,
    options?: {
        existingPosts?: FirestoreSocialPost[];
        sourceIds?: string[];
        onRetry?: RetryCallback;
    },
): Promise<SummarizeHourResult> {
    const hourId = makeHourId(date, hour);
    const now = new Date().toISOString();

    // Get posts for this hour
    let postsInHour: FirestoreSocialPost[];
    if (options?.existingPosts && options.existingPosts.length > 0) {
        const hourGroups = groupPostsByHour(options.existingPosts);
        postsInHour = hourGroups.get(hour) || [];
    } else {
        // Query Firestore for posts in this hour range
        const dayStart = new Date(`${date}T00:00:00+07:00`);
        const hourStart = new Date(dayStart.getTime() + hour * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        postsInHour = await firestoreRestClient.runQuery<FirestoreSocialPost>({
            from: [{ collectionId: COLLECTIONS.POSTS }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        {
                            fieldFilter: {
                                field: { fieldPath: 'published_at' },
                                op: 'GREATER_THAN_OR_EQUAL',
                                value: { stringValue: hourStart.toISOString() },
                            },
                        },
                        {
                            fieldFilter: {
                                field: { fieldPath: 'published_at' },
                                op: 'LESS_THAN',
                                value: { stringValue: hourEnd.toISOString() },
                            },
                        },
                    ],
                },
            },
            orderBy: [{ field: { fieldPath: 'published_at' }, direction: 'DESCENDING' }],
        });
    }

    if (postsInHour.length === 0) {
        return {
            success: false,
            hourId,
            summary: '',
            hashtags: [],
            postCount: 0,
            error: 'No posts found for this hour.',
        };
    }

    // Compute breakdowns
    const typeBreakdown: Record<string, number> = {};
    const platformBreakdown: Record<string, number> = {};
    const sourcesActiveSet = new Set<string>();
    for (const p of postsInHour) {
        typeBreakdown[p.content_type] = (typeBreakdown[p.content_type] || 0) + 1;
        platformBreakdown[p.platform] = (platformBreakdown[p.platform] || 0) + 1;
        sourcesActiveSet.add(p.source_id);
    }
    const sourcesActive = [...sourcesActiveSet];

    const { summary, model: usedModel, hashtags, _error } = await generateHourlySummary(
        postsInHour.map(p => ({
            title: p.title,
            source_name: p.source_name,
            content_type: p.content_type,
            published_at: p.published_at,
            platform: p.platform,
            text: p.text,
        })),
        hour,
        date,
        options?.onRetry,
    );

    const isError = !!_error;

    // Build analysis doc
    const analysisDoc: Omit<FirestoreSocialAnalysis, 'id'> = {
        date,
        hour,
        summary,
        total_posts: postsInHour.length,
        posts_by_platform: platformBreakdown,
        posts_by_content_type: typeBreakdown,
        sources_active: sourcesActive,
        sources_fetched: options?.sourceIds || sourcesActive,
        hashtags,
        top_trailers: [],
        trending_topics: [],
        sentiment_hint: 'neutral',
        generated_at: now,
        model: usedModel,
        backfill_duration_ms: 0,
    };

    // Use updateDocument (PATCH) to overwrite existing analysis, or createDocument if new
    // updateDocument with field mask is safest for retry (overwrites the failed doc)
    const ok = await firestoreRestClient.updateDocument(
        COLLECTIONS.ANALYSIS,
        hourId,
        analysisDoc,
    );

    if (!ok) {
        // Fallback: try create (doc may not exist yet — backfill crashed before writing)
        const created = await firestoreRestClient.createDocument(
            COLLECTIONS.ANALYSIS,
            hourId,
            analysisDoc,
        );
        if (!created) {
            return {
                success: false,
                hourId,
                summary,
                hashtags,
                postCount: postsInHour.length,
                error: 'Failed to write analysis to Firestore.',
            };
        }
    }

    return {
        success: !isError,
        hourId,
        summary,
        hashtags,
        postCount: postsInHour.length,
        error: isError ? 'AI summary generation failed.' : undefined,
    };
}
