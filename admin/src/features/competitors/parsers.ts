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

import { parse, format as fmt } from 'date-fns';
import type { CinePointShowtime, CinePointAdmission, TwitterTimelineResponse } from './types';

export interface RawTwitterEntry {
  id: string;
  created_at: string;
  text: string;
}

export interface ParsedImportResult {
  date: string;
  type: 'showtimes' | 'admissions' | 'other';
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

const SHOWTIME_LINE = /^#([\S]+?)\s+([\d,]+)\s*(?:\(([+-][\d.]+)%\)|\((?:estimated\s+)?opening\)|-(?:estimated\s+)?opening)/i;

export function parseShowtimeTweet(raw: string): CinePointShowtime[] {
  const results: CinePointShowtime[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^showtimes/i.test(trimmed) || trimmed === '-' || trimmed === '---') continue;

    const match = trimmed.match(SHOWTIME_LINE);
    if (!match) continue;

    results.push({
      title_cp: cleanTitle(match[1]),
      showtimes: parseInt(match[2].replace(/,/g, ''), 10),
      daily_change_pct: match[3] ? parseFloat(match[3]) : 0,
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

/**
 * CinePoint header date formats observed in the wild:
 *
 *   Numeric with day:   SHOWTIMES - MON, 4/5/26                  → D/M/YY
 *   Numeric no day:     SHOWTIMES - 16/04/26                      → D/M/YY
 *   Textual with day:   Estimated Admission - Sun, 12 Apr 2026   → d MMM yyyy
 *   Textual no day:     SHOWTIMES - 16 APR 2026                   → d MMM yyyy
 *   Textual ordinal:    Estimated Admission - Mon, Apr 6th 2026  → d MMM yyyy (with st/nd/rd/th)
 *
 * All prefixes: "SHOWTIMES" or "ESTIMATED ADMISSION" or "Estimated Admission"
 */

// Common prefix: matches the header keyword + dash
const HEADER_PREFIX = /(?:SHOWTIMES|ESTIMATED\s+ADMISSION)\s*-\s*/i;

// Day-of-week prefix (optional): "MON, " or "Sun, "
const OPT_DAY = /(?:\w{2,3},\s*)?/;

// Numeric date: D/M/YY or D/M/YYYY
const NUMERIC_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

// Textual date: "12 Apr 2026" or "Apr 6th 2026" (day and month may be swapped)
const TEXTUAL_DATE = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})|([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{2,4})/;

// Combined regexes
const HEADER_DATE_NUMERIC = new RegExp(
  HEADER_PREFIX.source + OPT_DAY.source + NUMERIC_DATE.source, 'i'
);
const HEADER_DATE_TEXTUAL_DMY = new RegExp(
  HEADER_PREFIX.source + OPT_DAY.source + TEXTUAL_DATE.source, 'i'
);

const TEXTUAL_DATE_FORMATS = ['d MMM yyyy', 'd MMMM yyyy', 'dd MMM yyyy', 'dd MMMM yyyy'];

/**
 * Extract the data date from a tweet's header text.
 *
 * Handles multiple CinePoint date formats:
 *   - Numeric:     "SHOWTIMES - MON, 4/5/26"            → D/M/YY
 *   - Numeric:     "SHOWTIMES - 16/04/26"               → D/M/YY (no day-of-week)
 *   - Textual DMY: "Estimated Admission - Sun, 12 Apr 2026" → d MMM yyyy
 *   - Textual MDY: "Estimated Admission - Mon, Apr 6th 2026" → MMM d yyyy (ordinal suffix)
 *   - Textual:     "SHOWTIMES - 16 APR 2026"            → d MMM yyyy (no day-of-week)
 *
 * Falls back to the tweet's posting date if the header can't be parsed.
 * The 2-day validation window accounts for late-night or early-morning posts.
 */
export function extractDateFromHeader(text: string, fallback?: string): string | null {
  // Try textual month format first (more specific, less ambiguous)
  const textualMatch = text.match(HEADER_DATE_TEXTUAL_DMY);
  if (textualMatch) {
    let dayStr: string;
    let monthStr: string;
    let yearStr: string;

    if (textualMatch[1]) {
      // Format: D MMM YYYY (e.g. "12 Apr 2026")
      dayStr = textualMatch[1];
      monthStr = textualMatch[2];
      yearStr = textualMatch[3];
    } else if (textualMatch[4]) {
      // Format: MMM D[th] YYYY (e.g. "Apr 6th 2026")
      monthStr = textualMatch[4];
      dayStr = textualMatch[5];
      yearStr = textualMatch[6];
    } else {
      dayStr = ''; monthStr = ''; yearStr = '';
    }

    const dateStr = parseTextualDateParts(dayStr, monthStr, yearStr);
    if (dateStr && isValidAgainstFallback(dateStr, fallback)) {
      return dateStr;
    }
  }

  // Try numeric format
  const numericMatch = text.match(HEADER_DATE_NUMERIC);
  if (numericMatch) {
    let day = parseInt(numericMatch[1], 10);
    let month = parseInt(numericMatch[2], 10);
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) year += 2000;

    // If month > 12, swap (M/D/Y format detected)
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isValidAgainstFallback(dateStr, fallback)) {
      return dateStr;
    }
  }

  return fallback || null;
}

/** Parse textual date parts into YYYY-MM-DD */
function parseTextualDateParts(dayStr: string, monthStr: string, yearStr: string): string | null {
  const year = parseInt(yearStr, 10);
  if (year < 100) {
    const fullYear = year + 2000;
    const composed = `${dayStr} ${monthStr} ${fullYear}`;
    return parseFlexibleDate(composed);
  }
  const composed = `${dayStr} ${monthStr} ${year}`;
  return parseFlexibleDate(composed);
}

/** Parse a flexible textual date like "12 Apr 2026" or "5 May 26" */
function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();

  for (const fmt_ of TEXTUAL_DATE_FORMATS) {
    try {
      const d = parse(trimmed, fmt_, new Date());
      if (!isNaN(d.getTime())) {
        return fmt(d, 'yyyy-MM-dd');
      }
    } catch {
      continue;
    }
  }

  // Last resort: try native Date parsing (handles "12 Apr 2026")
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
      return fmt(d, 'yyyy-MM-dd');
    }
  } catch {
    // fall through
  }

  return null;
}

/** Validate that a parsed date is within 2 days of the fallback (posting date) */
function isValidAgainstFallback(dateStr: string, fallback?: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;

  if (fallback) {
    const fallbackD = new Date(fallback + 'T00:00:00');
    const diffDays = Math.abs((d.getTime() - fallbackD.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  }

  return true;
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
 *
 * Returns one result per tweet:
 *   - 'showtimes' / 'admissions' for successfully parsed data tweets
 *   - 'other' for non-data tweets (milestones, commentary) AND data tweets
 *     that failed to parse (e.g. unrecognized date format, empty results).
 *
 * Callers should filter out 'other' results before creating snapshots.
 */
export function parseTweetBatch(tweets: RawTwitterEntry[]): ParsedImportResult[] {
  const results: ParsedImportResult[] = [];

  for (const tweet of tweets) {
    const text = tweet.text;
    const postingDate = twitterDateToYYYYMMDD(tweet.created_at);

    if (/^showtimes/i.test(text)) {
      const date = extractDateFromHeader(text, postingDate);
      const parsed = parseShowtimeTweet(text);
      if (date && parsed.length > 0) {
        results.push({ date, type: 'showtimes', parsed, raw_text: text, source_tweet_id: tweet.id });
      } else {
        // Showtime header matched but parsing failed — flag as 'other' for review
        results.push({ date: postingDate, type: 'other', parsed: [], raw_text: text, source_tweet_id: tweet.id });
      }
    } else if (/admission/i.test(text)) {
      const date = extractDateFromHeader(text, postingDate);
      const parsed = parseAdmissionsTweet(text);
      if (date && parsed.length > 0) {
        results.push({ date, type: 'admissions', parsed, raw_text: text, source_tweet_id: tweet.id });
      } else {
        // Admission header matched but parsing failed — flag as 'other' for review
        results.push({ date: postingDate, type: 'other', parsed: [], raw_text: text, source_tweet_id: tweet.id });
      }
    } else {
      // Non-data tweet (milestone, commentary, etc.)
      results.push({ date: postingDate, type: 'other', parsed: [], raw_text: text, source_tweet_id: tweet.id });
    }
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
