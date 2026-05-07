/**
 * Standalone script to scrape CinePoint Top Box Office data for the last N days.
 * 
 * Usage: npx tsx scripts/scrape-cinepoint-pilot.ts [days]
 * Default: 14 days
 * 
 * Saves to: admin/data/cinepoint-pilot.json
 */

import * as fs from 'fs';
import * as path from 'path';

const DELAY_MS = 3000;

interface BoxOfficeMovie {
  id: number;
  title: string;
  image_title: string | null;
  movie_genre: string[];
  duration: number;
  release_date: string;
  type: 'local' | 'international';
  admission: number;
  total_admission: number;
  change: number;
  showtimes: number;
  score: number;
  rank: { current_rank: number; last_rank?: number };
}

interface DayData {
  date: string;
  movies: BoxOfficeMovie[];
  scraped_at: string;
}

const days = Math.min(Math.max(parseInt(process.argv[2] ?? '14'), 1), 90);
const outputFile = path.join(process.cwd(), 'data', 'cinepoint-pilot.json');

async function main() {
  // Ensure data dir exists
  const dataDir = path.dirname(outputFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const today = new Date();
  const results: DayData[] = [];

  console.log(`\n🎬 CinePoint Pilot Scraper`);
  console.log(`   Scraping ${days} days back from ${today.toISOString().slice(0, 10)}`);
  console.log(`   Output: ${outputFile}\n`);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const url = `https://cinepoint.com/bff/v1/movies/top-box-office/daily/detail?date_start=${dateStr}&date_end=${dateStr}&type=all&limit=100&order=desc&sort=admission`;

    let retries = 0;
    let movies: BoxOfficeMovie[] = [];

    while (retries < 3) {
      try {
        const res = await fetch(url, {
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-app-request': 'true',
            referer: 'https://cinepoint.com/',
          },
        });

        if (res.status === 429) {
          console.log(`   ⏳ Rate limited on ${dateStr}, waiting 10s...`);
          await sleep(10000);
          retries++;
          continue;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        movies = json.response_output?.list?.content || [];
        break;
      } catch (err) {
        retries++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.log(`   ✗ Error on ${dateStr}: ${msg} (retry ${retries}/3)`);
        if (retries < 3) await sleep(5000);
      }
    }

    const totalAdm = movies.reduce((s, m) => s + m.admission, 0);
    const dayNum = days - i;
    console.log(`   [${dayNum.toString().padStart(2)}/${days}] ${dateStr}: ${movies.length} movies, ${totalAdm.toLocaleString()} admissions`);

    results.push({
      date: dateStr,
      movies,
      scraped_at: new Date().toISOString(),
    });

    // Rate-limit delay (skip on last day)
    if (i > 0) {
      await sleep(DELAY_MS);
    }
  }

  // Save
  const payload = {
    scraped_at: new Date().toISOString(),
    days_scraped: results.length,
    date_range: {
      start: results[0]?.date,
      end: results[results.length - 1]?.date,
    },
    days: results,
  };

  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf-8');

  const uniqueMovies = new Set(results.flatMap((d) => d.movies.map((m) => m.id))).size;
  const totalRecords = results.reduce((s, d) => s + d.movies.length, 0);

  console.log(`\n✓ Saved ${results.length} days, ${totalRecords} records, ${uniqueMovies} unique movies`);
  console.log(`  File: ${outputFile}`);
  console.log(`  Size: ${(fs.statSync(outputFile).size / 1024).toFixed(0)} KB\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
