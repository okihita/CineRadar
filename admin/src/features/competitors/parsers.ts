/**
 * CinePoint tweet parsers.
 *
 * Two formats:
 *   Showtimes:  #MovieName 2,466 (-3.90%)
 *   Admissions: #MovieName\n+74,385 (-3.90%) | 389,072
 *
 * Edge cases handled:
 *   - Emoji (🔥🔻) appended to hashtag names → stripped
 *   - `*` marker on movie names (new/featured) → stripped
 *   - Opening-day entries: `139,601 (estimated opening)` or `41,005 -estimated opening`
 *   - Truncated cumulative data (t.co URL cuts off the line)
 *   - Date extraction from header: `SHOWTIMES - MON, 4/5/26` (D/M/YY)
 */

import type { CinePointShowtime, CinePointAdmission, TwitterTimelineResponse } from './types';

export interface RawTwitterEntry {
  id: string;
  created_at: string;
  text: string;
}

export interface ParsedImportResult {
  date: string;
  type: 'showtimes' | 'admissions';
  parsed: CinePointShowtime[] | CinePointAdmission[];
  raw_text: string;
  source_tweet_id: string;
}

// ─── Helpers ───────────────────────────────────────────────

/** Strip emoji, *, and other non-alphanumeric suffixes from hashtag title */
function cleanTitle(raw: string): string {
  return raw.replace(/[🔥🔻*️⃗]/g, '').replace(/[^a-zA-Z0-9]/g, '') || raw;
}

// ─── Showtime Parser ───────────────────────────────────────

const SHOWTIME_LINE = /^#([\S]+?)\s+([\d,]+)\s+\(([+-][\d.]+)%\)/;

export function parseShowtimeTweet(raw: string): CinePointShowtime[] {
  const results: CinePointShowtime[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('SHOWTIMES') || trimmed === '-' || trimmed === '---') continue;

    const match = trimmed.match(SHOWTIME_LINE);
    if (!match) continue;

    results.push({
      title_cp: cleanTitle(match[1]),
      showtimes: parseInt(match[2].replace(/,/g, ''), 10),
      daily_change_pct: parseFloat(match[3]),
    });
  }

  return results;
}

// ─── Admissions Parser ─────────────────────────────────────

const ADMISSION_TITLE_LINE = /^#([\S]+)/;
// Standard: +74,385 (-3.90%) | 389,072
const ADMISSION_DATA = /^\+([\d,]+)\s+\(([+-][\d.]+)%\)\s*\|\s*([\d,]*)/;
// Opening day (no +/- change): 139,601 (estimated opening) or 41,005 -estimated opening
const ADMISSION_OPENING = /^([\d,]+)\s*(?:\(estimated\s+opening\)|-estimated\s+opening|\(opening\))/i;
// Standard without cumulative (truncated by t.co): +74,385 (-3.90%)
const ADMISSION_NO_CUM = /^\+([\d,]+)\s+\(([+-][\d.]+)%\)/;

export function parseAdmissionsTweet(raw: string): CinePointAdmission[] {
  const results: CinePointAdmission[] = [];
  const lines = raw.split('\n');

  let pendingTitle: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headers and separators
    if (
      !trimmed ||
      trimmed.startsWith('ESTIMATED') ||
      trimmed.startsWith('per Cinepoint') ||
      trimmed.startsWith('Per Cinepoint') ||
      trimmed === '-' ||
      trimmed === '---'
    ) {
      pendingTitle = null;
      continue;
    }

    // Try to match a title line (#MovieName)
    const titleMatch = trimmed.match(ADMISSION_TITLE_LINE);
    if (titleMatch && !trimmed.match(/^\+[\d,]/)) {
      pendingTitle = cleanTitle(titleMatch[1]);
      continue;
    }

    // Try to match data lines
    if (pendingTitle) {
      // 1. Standard format: +74,385 (-3.90%) | 389,072
      const dataMatch = trimmed.match(ADMISSION_DATA);
      if (dataMatch) {
        const cumStr = dataMatch[3]?.replace(/,/g, '');
        results.push({
          title_cp: pendingTitle,
          daily_admissions: parseInt(dataMatch[1].replace(/,/g, ''), 10),
          daily_change_pct: parseFloat(dataMatch[2]),
          cumulative_admissions: cumStr ? parseInt(cumStr, 10) : 0,
        });
        pendingTitle = null;
        continue;
      }

      // 2. Opening day: 139,601 (estimated opening)
      const openingMatch = trimmed.match(ADMISSION_OPENING);
      if (openingMatch) {
        results.push({
          title_cp: pendingTitle,
          daily_admissions: parseInt(openingMatch[1].replace(/,/g, ''), 10),
          daily_change_pct: 0,
          cumulative_admissions: 0,
        });
        pendingTitle = null;
        continue;
      }

      // 3. Standard without cumulative (truncated): +74,385 (-3.90%)
      const noCumMatch = trimmed.match(ADMISSION_NO_CUM);
      if (noCumMatch) {
        results.push({
          title_cp: pendingTitle,
          daily_admissions: parseInt(noCumMatch[1].replace(/,/g, ''), 10),
          daily_change_pct: parseFloat(noCumMatch[2]),
          cumulative_admissions: 0,
        });
        pendingTitle = null;
        continue;
      }

      pendingTitle = null;
    }
  }

  return results;
}

// ─── Date Extraction ───────────────────────────────────────

const HEADER_DATE = /(?:SHOWTIMES|ESTIMATED ADMISSION)\s*-\s*\w+,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;

/**
 * Extract the data date from a tweet's header text.
 * Format: "SHOWTIMES - MON, 4/5/26" → D/M/YY → "2026-05-04"
 *
 * @param text     Tweet text with header
 * @param fallback Fallback date (YYYY-MM-DD) if header is unparseable/wrong
 * Returns null if neither source works.
 */
export function extractDateFromHeader(text: string, fallback?: string): string | null {
  const match = text.match(HEADER_DATE);

  if (match) {
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    // If month > 12, swap (M/D/Y format detected)
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(dateStr + 'T00:00:00');

    if (!isNaN(d.getTime())) {
      // Validate: if fallback exists, the parsed date should be within 2 days
      if (fallback) {
        const fallbackD = new Date(fallback + 'T00:00:00');
        const diffDays = Math.abs((d.getTime() - fallbackD.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) return dateStr;
        // Header date too far from posting date — use fallback
      } else {
        return dateStr;
      }
    }
  }

  return fallback || null;
}

/**
 * Extract just the tweets from raw Twitter JSON.
 */
export function extractTweetsFromTwitterJson(json: unknown): RawTwitterEntry[] {
  try {
    const root = json as TwitterTimelineResponse;

      const instructions = root?.data?.user?.result?.timeline?.timeline?.instructions;

     if (!Array.isArray(instructions)) return [];

     const entries = instructions
       .filter((i) => Array.isArray(i?.entries))
       .flatMap((i) => i.entries || []);

     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     return (entries as any[])
      .filter((e) => {
        const r = e?.content?.itemContent?.tweet_results?.result;
        if (!r) return false;
        const target = r.tweet || r;
        return !!(target?.legacy?.full_text || target?.note_tweet?.note_tweet_results?.result?.text);
      })
      .map((e) => {
        let result = e.content.itemContent.tweet_results.result;
        
        // Handle "TweetWithVisibilityResults" wrapper
        if (result.tweet) {
          result = result.tweet;
        }

        const noteText = result?.note_tweet?.note_tweet_results?.result?.text;
        const legacyText = result?.legacy?.full_text;
        const rawText: string = noteText || legacyText || '';
        
        const text: string = rawText
          .replace(/https:\/\/t\.co\/\S+/g, '')
          .replace(/[🔥🔻]/g, '')
          .trim();
         return {
           id: result.rest_id as string,
           created_at: result.legacy.created_at as string,
           text,
         };
       });
   } catch {
     return [];
   }
 }

/**
 * Parse a batch of extracted tweets into structured import data,
 * grouped by date.
 */
export function parseTweetBatch(tweets: RawTwitterEntry[]): ParsedImportResult[] {
  const results: ParsedImportResult[] = [];

  for (const tweet of tweets) {
    const text = tweet.text;
    const postingDate = twitterDateToYYYYMMDD(tweet.created_at);

    if (text.startsWith('SHOWTIMES')) {
      const date = extractDateFromHeader(text, postingDate);
      const parsed = parseShowtimeTweet(text);
      if (date && parsed.length > 0) {
        results.push({ date, type: 'showtimes', parsed, raw_text: text, source_tweet_id: tweet.id });
      }
    } else if (/admission/i.test(text)) {
      // Any tweet containing "admission" is treated as an admissions tweet
      const date = extractDateFromHeader(text, postingDate);
      const parsed = parseAdmissionsTweet(text);
      if (date && parsed.length > 0) {
        results.push({ date, type: 'admissions', parsed, raw_text: text, source_tweet_id: tweet.id });
      }
    }
    // Skip non-data tweets (milestones, commentary, etc.)
  }

  return results;
}

/** Convert Twitter date format "Tue May 05 15:50:29 +0000 2026" → "2026-05-05" */
function twitterDateToYYYYMMDD(twitterDate: string): string {
  const d = new Date(twitterDate);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  // Convert to Jakarta timezone for the date
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}
