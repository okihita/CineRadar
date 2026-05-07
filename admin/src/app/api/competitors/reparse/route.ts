/**
 * POST /api/competitors/reparse — re-parse all stored tweets with updated parsers
 *
 * Reads all tweets from competitor_tweets, re-runs parseTweetBatch()
 * with the improved date parser, and upserts snapshots. Preserves existing
 * match data (matched_movie_id, matched_title) by title_cp key.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { COMPETITOR_COLLECTION, TWEET_COLLECTION } from '@/features/competitors/types';
import type { CompetitorSnapshot, CompetitorTweet, CinePointShowtime, CinePointAdmission } from '@/features/competitors/types';
import { parseTweetBatch, type RawTwitterEntry, type ParsedImportResult } from '@/features/competitors/parsers';

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    // 1. Fetch all stored tweets
    const tweets = await firestoreRestClient.getCollectionWithQuery<CompetitorTweet>(
      TWEET_COLLECTION,
      'imported_at',
      1000,
    );

    if (tweets.length === 0) {
      return NextResponse.json({
        success: true,
        data: { tweets_scanned: 0, dates_changed: 0, dates_total: 0 },
      });
    }

    // 2. Convert to RawTwitterEntry format for re-parsing
    const rawEntries: RawTwitterEntry[] = tweets.map((t) => ({
      id: t.id,
      created_at: t.created_at,
      text: t.text,
    }));

    // 3. Re-parse all tweets with the improved date parser
    const parsed = parseTweetBatch(rawEntries);

    // 4. Load all existing snapshots to preserve match data
    const existingSnapshots = await firestoreRestClient.getCollectionWithQuery<CompetitorSnapshot>(
      COMPETITOR_COLLECTION,
      'date',
      500,
    );

    // Build lookup: date → snapshot (for match preservation)
    const snapshotByDate = new Map<string, CompetitorSnapshot>();
    for (const snap of existingSnapshots) {
      snapshotByDate.set(snap.date || snap.id, snap);
    }

    // Build lookup: old_date → match data by title_cp
    // (for migrating match data when dates change)
    const matchDataByDateAndTitle = new Map<string, Map<string, { matched_movie_id?: string; matched_title?: string }>>();
    for (const snap of existingSnapshots) {
      const matchMap = new Map<string, { matched_movie_id?: string; matched_title?: string }>();
      for (const item of snap.showtimes?.parsed ?? []) {
        if (item.matched_movie_id) {
          matchMap.set(item.title_cp, { matched_movie_id: item.matched_movie_id, matched_title: item.matched_title });
        }
      }
      for (const item of snap.admissions?.parsed ?? []) {
        if (item.matched_movie_id) {
          matchMap.set(item.title_cp, { matched_movie_id: item.matched_movie_id, matched_title: item.matched_title });
        }
      }
      if (matchMap.size > 0) {
        matchDataByDateAndTitle.set(snap.date || snap.id, matchMap);
      }
    }

    // 5. Group parsed results by date
    const byDate = new Map<string, ParsedImportResult[]>();
    for (const item of parsed) {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date)!.push(item);
    }

    // 6. Upsert snapshots with preserved match data
    const now = new Date().toISOString();
    let datesChanged = 0;
    let datesTotal = 0;
    const changes: { old_date: string; new_date: string; type: string }[] = [];

    for (const [date, items] of byDate) {
      datesTotal++;
      const existing = snapshotByDate.get(date);

      // Check if any item's date changed compared to where it was previously stored
      // (detected by checking if the old snapshot at this date had different raw text)
      let dateActuallyChanged = false;

      const data: Record<string, unknown> = { date, source: 'cinepoint' };

      // Showtimes
      const showtimeItems = items.filter((i) => i.type === 'showtimes');
      if (showtimeItems.length > 0) {
        const latest = showtimeItems[showtimeItems.length - 1];
        const reparsed = latest.parsed as CinePointShowtime[];

        // Restore match data from any existing snapshot that had this raw text
        const restored = restoreMatchData(reparsed, date, matchDataByDateAndTitle);

        data.showtimes = {
          raw: latest.raw_text,
          parsed: restored,
          source_tweet_id: latest.source_tweet_id,
          updated_at: now,
        };

        // Detect if this data was previously stored under a different date
        if (existing?.showtimes?.raw !== latest.raw_text) {
          dateActuallyChanged = true;
        }
      } else {
        data.showtimes = existing?.showtimes ?? null;
      }

      // Admissions
      const admissionItems = items.filter((i) => i.type === 'admissions');
      if (admissionItems.length > 0) {
        const latest = admissionItems[admissionItems.length - 1];
        const reparsed = latest.parsed as CinePointAdmission[];
        const restored = restoreMatchData(reparsed, date, matchDataByDateAndTitle);

        data.admissions = {
          raw: latest.raw_text,
          parsed: restored,
          source_tweet_id: latest.source_tweet_id,
          updated_at: now,
        };

        if (existing?.admissions?.raw !== latest.raw_text) {
          dateActuallyChanged = true;
        }
      } else {
        data.admissions = existing?.admissions ?? null;
      }

      const ok = existing
        ? await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, date, data)
        : await firestoreRestClient.createDocument(COMPETITOR_COLLECTION, date, data);

      if (ok && dateActuallyChanged) {
        datesChanged++;
      }
    }

    // 7. Clean up orphaned snapshots
    // If a tweet's date changed from old_date to new_date, the old_date snapshot
    // may now be stale. We should check if any snapshots no longer have corresponding
    // parsed data and clean them up.
    const newDates = new Set(byDate.keys());
    let orphansRemoved = 0;

    for (const [oldDate, oldSnap] of snapshotByDate) {
      if (newDates.has(oldDate)) continue;

      // This date was in the old data but not in the new parse
      // Check if it had data that has now moved elsewhere
      const hadShowtimes = !!(oldSnap.showtimes?.parsed?.length);
      const hadAdmissions = !!(oldSnap.admissions?.parsed?.length);

      if (hadShowtimes || hadAdmissions) {
        // Check if the raw text from this old date now appears under a new date
        const oldRaw = oldSnap.showtimes?.raw || oldSnap.admissions?.raw;
        let movedToNewDate = false;

        for (const [, newItems] of byDate) {
          for (const item of newItems) {
            if (item.raw_text === oldRaw) {
              movedToNewDate = true;
              break;
            }
          }
          if (movedToNewDate) break;
        }

        if (movedToNewDate) {
          // Data moved to a new date — clear the old snapshot's moved data
          const cleanData: Record<string, unknown> = { date: oldDate, source: 'cinepoint' };
          if (hadShowtimes && !newDates.has(oldDate)) cleanData.showtimes = null;
          if (hadAdmissions && !newDates.has(oldDate)) cleanData.admissions = null;

          await firestoreRestClient.updateDocument(COMPETITOR_COLLECTION, oldDate, cleanData);
          orphansRemoved++;
          changes.push({ old_date: oldDate, new_date: '(moved)', type: 'orphan-cleaned' });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tweets_scanned: tweets.length,
        tweets_parsed: parsed.length,
        dates_total: datesTotal,
        dates_changed: datesChanged,
        orphans_removed: orphansRemoved,
        details: changes,
      },
    });
  } catch (error) {
    console.error('[Competitor Reparse Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to reparse tweets' }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────

type MatchableItem = { title_cp: string; matched_movie_id?: string; matched_title?: string };

/**
 * Restore match data onto re-parsed items by looking up the title_cp
 * in the previously stored match data.
 *
 * Checks the target date first, then all other dates (for date migrations).
 */
function restoreMatchData<T extends MatchableItem>(
  items: T[],
  targetDate: string,
  matchDataByDate: Map<string, Map<string, { matched_movie_id?: string; matched_title?: string }>>,
): T[] {
  return items.map((item) => {
    // Try exact date match first
    const dateMatches = matchDataByDate.get(targetDate);
    const match = dateMatches?.get(item.title_cp);

    if (match?.matched_movie_id) {
      return { ...item, ...match };
    }

    // Try all dates (date might have moved)
    for (const [, titleMap] of matchDataByDate) {
      const m = titleMap.get(item.title_cp);
      if (m?.matched_movie_id) {
        return { ...item, ...m };
      }
    }

    return item;
  });
}
