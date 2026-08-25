/**
 * Google Gemini AI client for hourly analysis generation.
 * Uses @google/generative-ai SDK with retry + graceful degradation.
 * 
 * Summary rules:
 *   - 1 paragraph per 4 timeline items (rounding down)
 *   - 0 items → default message
 *   - No hour/time mention in output (already shown in UI)
 *   - Hashtags extracted from post text and returned separately
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    }
    return genAI;
}

export interface PostForAnalysis {
    title: string;
    source_name: string;
    content_type: string;
    published_at: string;
    platform: string;            // e.g. "youtube", "twitter"
    text: string;                // Full description/text — used for hashtag extraction
}

/** Extract retry delay in seconds from Gemini 429 error */
function extractRetryDelay(error: unknown): number {
    try {
        const errorDetails = (error as { errorDetails?: Array<Record<string, unknown>> }).errorDetails;
        if (!Array.isArray(errorDetails)) return 10;

        const retryInfo = errorDetails.find(
            (d) => typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo')
        );

        if (retryInfo) {
            const raw = retryInfo['retryDelay'];
            if (typeof raw === 'string') {
                const match = raw.match(/([\d.]+)s/);
                if (match) {
                    return Math.ceil(parseFloat(match[1])) + 1;
                }
            }
        }
    } catch { /* ignore */ }
    return 10;
}

/** Extract hashtags from post text (matches #word patterns) */
function extractHashtags(posts: PostForAnalysis[]): string[] {
    const hashtagSet = new Set<string>();
    for (const post of posts) {
        if (!post.text) continue;
        const matches = post.text.match(/#[\w]+/g);
        if (matches) {
            for (const tag of matches) {
                hashtagSet.add(tag);
            }
        }
    }
    return [...hashtagSet].sort();
}

const MAX_RETRIES = 4;

export interface HourlySummaryResult {
    summary: string;
    model: string;
    retried: boolean;
    hashtags: string[];
    _error?: string;
}

/**
 * Callback for retry progress — lets the caller report countdown to the UI.
 */
export type RetryCallback = (info: { attempt: number; maxRetries: number; retryDelaySeconds: number }) => void;

/**
 * Generate a concise hourly summary of social media activity.
 * 
 * Summary length: 1 paragraph per 4 posts (rounding down).
 * No hour/time mention — the UI already shows it.
 * Hashtags are extracted from post text and returned separately.
 */
export async function generateHourlySummary(
    posts: PostForAnalysis[],
    hour: number,
    date: string,
    onRetry?: RetryCallback,
): Promise<HourlySummaryResult> {
    // Extract hashtags regardless of post count
    const hashtags = extractHashtags(posts);

    if (posts.length === 0) {
        return {
            summary: 'No activity from monitored accounts this hour.',
            model: 'none',
            retried: false,
            hashtags: [],
        };
    }

    const client = getClient();
    const modelName = 'gemini-3.1-flash-lite-preview';
    const model = client.getGenerativeModel({ model: modelName });

    const postCount = posts.length;
    // 3 sentences for 1-4 items, +1 sentence for every additional 2 items
    const sentenceCount = postCount <= 4 ? 3 : 3 + Math.ceil((postCount - 4) / 2);

    const postList = posts
        .map(p => {
            const platformLabel = p.platform === 'youtube' ? 'YouTube'
                : p.platform === 'twitter' ? 'Twitter'
                : p.platform === 'instagram' ? 'Instagram'
                : p.platform === 'tiktok' ? 'TikTok'
                : 'Web';
            return `- [${platformLabel}] "${p.title}" by ${p.source_name} (${p.content_type})`;
        })
        .join('\n');

    const prompt = `You are a cinema industry analyst covering the Indonesian film market.

Activity from monitored accounts:
${postList}

There are ${postCount} items. Write exactly ${sentenceCount} sentences. Not a paragraph — separate sentences. Do NOT mention the hour or time range.

Focus on:
1. Key releases (trailers, teasers, new announcements)
2. Audience reactions (reviews, community buzz, sentiment)
3. Cross-platform trends
4. Notable patterns (e.g., same movie trending across multiple sources)

Be factual and specific. Mention movie titles, studio names, and people.
Brevity is critical. Every sentence must carry new information. No filler.`;

    let retried = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            return {
                summary: text || 'Summary generation returned empty.',
                model: modelName,
                retried,
                hashtags,
            };
        } catch (error: unknown) {
            const status = (error as { status?: number }).status;
            const isRetryable = status === 429 || status === 503 || status === 500;

            if (isRetryable && attempt < MAX_RETRIES) {
                const baseDelay = status === 429 ? extractRetryDelay(error) : 10;
                const delay = Math.ceil(baseDelay * Math.pow(1.5, attempt));
                const reason = status === 429 ? 'Rate limit' : status === 503 ? 'Service unavailable' : 'Server error';
                console.warn(`[Gemini ${status}] ${reason}. Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s`);

                if (onRetry) {
                    onRetry({ attempt: attempt + 1, maxRetries: MAX_RETRIES, retryDelaySeconds: delay });
                }

                retried = true;
                await new Promise(r => setTimeout(r, delay * 1000));
                continue;
            }

            console.error(`[Gemini Error] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
            return {
                summary: `⚠️ Summary temporarily unavailable.`,
                model: modelName,
                retried,
                hashtags,
                _error: isRetryable ? `Service returned ${status} after retries.` : (error instanceof Error ? error.message : 'Unknown error'),
            };
        }
    }

    // Should never reach here — every loop iteration returns
    return { summary: '⚠️ Summary temporarily unavailable.', model: modelName, retried: true, hashtags };
}
