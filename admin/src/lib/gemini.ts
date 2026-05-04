/**
 * Google Gemini AI client for hourly analysis generation.
 * Uses @google/generative-ai SDK with retry + graceful degradation.
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

export interface VideoForAnalysis {
    title: string;
    channel_title: string;
    content_type: string;
    published_at: string;
}

/** Extract retry delay in seconds from Gemini 429 error */
function extractRetryDelay(error: unknown): number {
    try {
        // The SDK exposes errorDetails directly on the error object
        const errorDetails = (error as { errorDetails?: Array<Record<string, unknown>> }).errorDetails;
        if (!Array.isArray(errorDetails)) return 10;

        const retryInfo = errorDetails.find(
            (d) => typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo')
        );

        if (retryInfo) {
            const raw = retryInfo['retryDelay'];
            if (typeof raw === 'string') {
                // Format: "6s", "6.779633506s", "12s"
                const match = raw.match(/([\d.]+)s/);
                if (match) {
                    return Math.ceil(parseFloat(match[1])) + 1; // +1s buffer
                }
            }
        }
    } catch { /* ignore */ }
    return 10; // Safe default
}

const MAX_RETRIES = 4;

export interface HourlySummaryResult {
    summary: string;
    model: string;
    retried: boolean;
}

/**
 * Callback for retry progress — lets the caller report countdown to the UI.
 */
export type RetryCallback = (info: { attempt: number; maxRetries: number; retryDelaySeconds: number }) => void;

/**
 * Generate a concise hourly summary of YouTube activity.
 * Retries on 429 with parsed retryDelay from error + exponential backoff.
 * Calls onRetry before each retry so the caller can stream progress.
 */
export async function generateHourlySummary(
    videos: VideoForAnalysis[],
    hour: number,
    date: string,
    onRetry?: RetryCallback,
): Promise<HourlySummaryResult> {
    if (videos.length === 0) {
        return {
            summary: 'No YouTube activity from monitored accounts this hour.',
            model: 'none',
            retried: false,
        };
    }

    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const videoList = videos
        .map(v => `- "${v.title}" by ${v.channel_title} [${v.content_type}] at ${v.published_at}`)
        .join('\n');

    const prompt = `You are a cinema industry analyst covering the Indonesian film market. Summarize the following YouTube activity from monitored cinema accounts during the ${hour}:00–${hour}:59 hour on ${date}.

Focus on:
1. Key releases (trailers, teasers, new announcements)
2. Audience reactions (reviews, community buzz)
3. Notable trends or patterns across channels

Videos this hour:
${videoList}

Write exactly 2-3 concise, factual sentences. No fluff. No generic filler.`;

    let retried = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            return {
                summary: text || 'Summary generation returned empty.',
                model: 'gemini-2.0-flash',
                retried,
            };
        } catch (error: unknown) {
            const status = (error as { status?: number }).status;
            const is429 = status === 429;

            if (is429 && attempt < MAX_RETRIES) {
                const baseDelay = extractRetryDelay(error);
                const delay = Math.ceil(baseDelay * Math.pow(1.5, attempt));
                console.warn(`[Gemini 429] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s`);

                // Notify caller so SSE can stream countdown
                if (onRetry) {
                    onRetry({ attempt: attempt + 1, maxRetries: MAX_RETRIES, retryDelaySeconds: delay });
                }

                retried = true;
                await new Promise(r => setTimeout(r, delay * 1000));
                continue;
            }

            // Non-429 error or exhausted retries
            console.error(`[Gemini Error] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
            return {
                summary: `⚠️ AI summary unavailable — ${is429 ? 'Gemini rate limit reached after retries.' : (error instanceof Error ? error.message : 'Unknown error')}`,
                model: 'gemini-2.0-flash',
                retried,
            };
        }
    }

    return {
        summary: '⚠️ AI summary unavailable after multiple retries.',
        model: 'gemini-2.0-flash',
        retried: true,
    };
}
