/**
 * Google Gemini AI client for hourly analysis generation.
 * Uses @google/generative-ai SDK with gemini-2.0-flash model.
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

/**
 * Generate a concise hourly summary of YouTube activity.
 */
export async function generateHourlySummary(
    videos: VideoForAnalysis[],
    hour: number,
    date: string,
): Promise<string> {
    if (videos.length === 0) {
        return 'No YouTube activity from monitored accounts this hour.';
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

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        return text || 'Summary generation returned empty.';
    } catch (error) {
        console.error('[Gemini Error]', error);
        return `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}
