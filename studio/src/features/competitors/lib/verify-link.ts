import { addDays, format, parseISO } from 'date-fns';

/**
 * Build a Twitter/X search URL for @cinepoint_ posts on a given date
 * (and the two days after, to account for late-night / next-day posting).
 *
 * @param dateStr - ISO date string "YYYY-MM-DD"
 * @returns Twitter search URL, e.g. https://x.com/search?q=from%3Acinepoint_%20since%3A2026-04-05%20until%3A2026-04-08
 */
export function buildCinepointVerifyUrl(dateStr: string): string {
  const date = parseISO(dateStr);
  const since = dateStr;
  const until = format(addDays(date, 3), 'yyyy-MM-dd'); // +3 = date + 2 extra days
  const query = `from:cinepoint_ since:${since} until:${until}`;
  return `https://x.com/search?q=${encodeURIComponent(query)}`;
}
