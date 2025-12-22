/**
 * Movie Directory Scraper
 * 
 * Fetches all movies from Cinepoint directory and stores to Firestore.
 * Run: npm run scrape:movies
 */

import { getClient } from '../api/client.js';
import { getStorage } from '../storage/bigquery.js';
import type { CinepointMovie, MovieDirectoryItem } from '../models/types.js';

function transformMovie(item: MovieDirectoryItem): CinepointMovie {
    return {
        id: item.id,
        title: item.title,
        originalTitle: item.original_title,
        posterUrl: item.poster,
        backdropUrl: item.backdrop,
        genre: item.genre || [],
        duration: item.duration,
        releaseDate: item.release_date,
        country: item.country,
        rating: item.rating || 'SU',
        synopsis: item.synopsis || '',
        cast: item.cast?.map(c => c.name) || [],
        directors: item.directors?.map(d => d.name) || [],
        status: item.status as CinepointMovie['status'],
        lastUpdated: new Date().toISOString()
    };
}

async function scrapeMovieDirectory(): Promise<void> {
    const client = getClient();
    const storage = getStorage();

    console.log('=== Cinepoint Movie Directory Scraper ===\n');

    const allMovies: CinepointMovie[] = [];
    let page = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
        try {
            console.log(`Fetching page ${page}...`);
            const response = await client.getMovieDirectory(page, limit);

            const items = response.data?.items || [];
            if (items.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of items) {
                const movie = transformMovie(item);
                allMovies.push(movie);
            }

            console.log(`  Got ${items.length} movies (total: ${allMovies.length})`);

            // Check if there are more pages
            const total = response.data?.total || 0;
            hasMore = (page + 1) * limit < total;
            page++;

        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            // Continue to next page on error
            page++;
            if (page > 100) break; // Safety limit
        }
    }

    console.log(`\nTotal movies fetched: ${allMovies.length}`);

    // Store to Firestore in batches
    const BATCH_SIZE = 400; // Firestore limit is 500
    for (let i = 0; i < allMovies.length; i += BATCH_SIZE) {
        const batch = allMovies.slice(i, i + BATCH_SIZE);
        await storage.upsertMovies(batch);
        console.log(`Stored batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    // Log sync
    await storage.logSync('movies', {
        moviesScraped: allMovies.length,
        status: 'success'
    });

    console.log('\n✓ Movie directory scrape complete!');
}

// Run if executed directly
scrapeMovieDirectory().catch(console.error);

export { scrapeMovieDirectory };
