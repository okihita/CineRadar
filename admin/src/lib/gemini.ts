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

/** Parse retry delay from Gemini 429 error (defaults to 8s) */
function parseRetryDelay(error: unknown): number {
    try {
        const details = (error as { errorDetails?: Array<{ '@type': string; retryDelay?: string }> }).errorDetails;
        const retryInfo = details?.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
            const match = retryInfo.retryDelay.match(/(\d+)s/);
            if (match) return parseInt(match[1]) + 1; // +1s buffer
        }
    } catch { /* ignore */ }
    return 8;
}

const MAX_RETRIES = 4;

/**
 * Generate a concise hourly summary of YouTube activity.
 * Retries on 429 with exponential backoff + parsed retryDelay.
 */
export async function generateHourlySummary(
    videos: VideoForAnalysis[],
    hour: number,
    date: string,
): Promise<{ summary: string; model: string; retried: boolean }> {
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
                const baseDelay = parseRetryDelay(error);
                const delay = baseDelay * Math.pow(1.5, attempt); // Exponential backoff
                console.warn(`[Gemini 429] Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}s`);
                retried = true;
                await new Promise(r => setTimeout(r, delay * 1000));
                continue;
            }

            // Non-429 error or exhausted retries
            console.error(`[Gemini Error] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
            return {
                summary: `⚠️ AI summary unavailable — ${is429 ? 'Gemini rate limit reached. Retry this hour later.' : (error instanceof Error ? error.message : 'Unknown error')}`,
                model: 'gemini-2.0-flash',
                retried,
            };
        }
    }

    // Should never reach here, but just in case
    return {
        summary: '⚠️ AI summary unavailable after multiple retries.',
        model: 'gemini-2.0-flash',
        retried: true,
    };
}
