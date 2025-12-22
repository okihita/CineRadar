/**
 * BigQuery Storage for Cinepoint Data
 * 
 * Uses Google Cloud BigQuery for analytics-optimized storage.
 * Project: cineradar-481014
 */

import { BigQuery, Table } from '@google-cloud/bigquery';
import type {
    CinepointMovie,
    BoxOfficeRecord,
    ShowtimeRanking,
    InsightArticle
} from '../models/types.js';

const PROJECT_ID = 'cineradar-481014';
const DATASET_ID = 'cinepoint';

// Table schemas
const SCHEMAS = {
    movies: [
        { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'title', type: 'STRING', mode: 'REQUIRED' },
        { name: 'original_title', type: 'STRING' },
        { name: 'poster_url', type: 'STRING' },
        { name: 'backdrop_url', type: 'STRING' },
        { name: 'genre', type: 'STRING', mode: 'REPEATED' },
        { name: 'duration', type: 'INTEGER' },
        { name: 'release_date', type: 'DATE' },
        { name: 'country', type: 'STRING' },
        { name: 'rating', type: 'STRING' },
        { name: 'synopsis', type: 'STRING' },
        { name: 'cast', type: 'STRING', mode: 'REPEATED' },
        { name: 'directors', type: 'STRING', mode: 'REPEATED' },
        { name: 'cinepoint_score', type: 'FLOAT' },
        { name: 'total_admissions', type: 'INTEGER' },
        { name: 'status', type: 'STRING' },
        { name: 'last_updated', type: 'TIMESTAMP' }
    ],
    box_office: [
        { name: 'movie_id', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'movie_title', type: 'STRING' },
        { name: 'date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'period', type: 'STRING', mode: 'REQUIRED' },
        { name: 'rank', type: 'INTEGER' },
        { name: 'admissions', type: 'INTEGER' },
        { name: 'total_admissions', type: 'INTEGER' },
        { name: 'showtimes', type: 'INTEGER' },
        { name: 'market_share', type: 'FLOAT' },
        { name: 'rank_change', type: 'INTEGER' },
        { name: 'admission_change', type: 'FLOAT' },
        { name: 'scraped_at', type: 'TIMESTAMP' }
    ],
    showtimes: [
        { name: 'movie_id', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'movie_title', type: 'STRING' },
        { name: 'date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'rank', type: 'INTEGER' },
        { name: 'showtime_count', type: 'INTEGER' },
        { name: 'showtime_change', type: 'INTEGER' },
        { name: 'market_share_percent', type: 'FLOAT' },
        { name: 'scraped_at', type: 'TIMESTAMP' }
    ],
    insights: [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'title', type: 'STRING' },
        { name: 'slug', type: 'STRING' },
        { name: 'excerpt', type: 'STRING' },
        { name: 'content', type: 'STRING' },
        { name: 'published_at', type: 'TIMESTAMP' },
        { name: 'category', type: 'STRING' },
        { name: 'image_url', type: 'STRING' },
        { name: 'scraped_at', type: 'TIMESTAMP' }
    ],
    sync_log: [
        { name: 'type', type: 'STRING' },
        { name: 'details', type: 'JSON' },
        { name: 'timestamp', type: 'TIMESTAMP' }
    ]
};

class BigQueryStorage {
    private bq: BigQuery;
    private dataset: string;
    private initialized: boolean = false;

    constructor() {
        this.bq = new BigQuery({ projectId: PROJECT_ID });
        this.dataset = DATASET_ID;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Create dataset if not exists
        const [datasets] = await this.bq.getDatasets();
        const exists = datasets.some(d => d.id === DATASET_ID);

        if (!exists) {
            console.log(`[BigQuery] Creating dataset: ${DATASET_ID}`);
            await this.bq.createDataset(DATASET_ID, { location: 'asia-southeast1' });
        }

        // Create tables if not exist
        const dataset = this.bq.dataset(DATASET_ID);
        for (const [tableName, schema] of Object.entries(SCHEMAS)) {
            const table = dataset.table(tableName);
            const [tableExists] = await table.exists();
            if (!tableExists) {
                console.log(`[BigQuery] Creating table: ${tableName}`);
                await dataset.createTable(tableName, { schema });
            }
        }

        this.initialized = true;
        console.log('[BigQuery] Initialized successfully');
    }

    private getTable(name: string): Table {
        return this.bq.dataset(DATASET_ID).table(name);
    }

    // Movies
    async upsertMovies(movies: CinepointMovie[]): Promise<void> {
        await this.initialize();
        const rows = movies.map(m => ({
            id: m.id,
            title: m.title,
            original_title: m.originalTitle || null,
            poster_url: m.posterUrl,
            backdrop_url: m.backdropUrl || null,
            genre: m.genre,
            duration: m.duration,
            release_date: m.releaseDate || null,
            country: m.country,
            rating: m.rating,
            synopsis: m.synopsis,
            cast: m.cast,
            directors: m.directors,
            cinepoint_score: m.cinepointScore || null,
            total_admissions: m.totalAdmissions || null,
            status: m.status,
            last_updated: m.lastUpdated
        }));

        // Use MERGE for upsert behavior - first delete existing, then insert
        // For simplicity, we'll just insert (with duplicates - can dedupe later)
        await this.getTable('movies').insert(rows, { ignoreUnknownValues: true });
        console.log(`[BigQuery] Inserted ${rows.length} movies`);
    }

    // Box Office
    async insertBoxOfficeRecords(records: BoxOfficeRecord[]): Promise<void> {
        await this.initialize();
        const rows = records.map(r => ({
            movie_id: r.movieId,
            movie_title: r.movieTitle,
            date: r.date,
            period: r.period,
            rank: r.rank,
            admissions: r.admissions,
            total_admissions: r.totalAdmissions,
            showtimes: r.showtimes || null,
            market_share: r.marketShare || null,
            rank_change: r.rankChange || null,
            admission_change: r.admissionChange || null,
            scraped_at: r.scrapedAt
        }));

        await this.getTable('box_office').insert(rows, { ignoreUnknownValues: true });
        console.log(`[BigQuery] Inserted ${rows.length} box office records`);
    }

    async getLatestBoxOfficeDate(period: string): Promise<string | null> {
        await this.initialize();
        const query = `
      SELECT MAX(date) as latest_date 
      FROM \`${PROJECT_ID}.${DATASET_ID}.box_office\` 
      WHERE period = @period
    `;
        const [rows] = await this.bq.query({ query, params: { period } });
        return rows[0]?.latest_date || null;
    }

    // Showtimes
    async insertShowtimeRankings(rankings: ShowtimeRanking[]): Promise<void> {
        await this.initialize();
        const rows = rankings.map(r => ({
            movie_id: r.movieId,
            movie_title: r.movieTitle,
            date: r.date,
            rank: r.rank,
            showtime_count: r.showtimeCount,
            showtime_change: r.showtimeChange,
            market_share_percent: r.marketSharePercent,
            scraped_at: r.scrapedAt
        }));

        await this.getTable('showtimes').insert(rows, { ignoreUnknownValues: true });
        console.log(`[BigQuery] Inserted ${rows.length} showtime rankings`);
    }

    async getLatestShowtimeDate(): Promise<string | null> {
        await this.initialize();
        const query = `
      SELECT MAX(date) as latest_date 
      FROM \`${PROJECT_ID}.${DATASET_ID}.showtimes\`
    `;
        const [rows] = await this.bq.query({ query });
        return rows[0]?.latest_date || null;
    }

    // Insights
    async upsertInsight(article: InsightArticle): Promise<void> {
        await this.initialize();
        const row = {
            id: article.id,
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            content: article.content,
            published_at: article.publishedAt,
            category: article.category,
            image_url: article.imageUrl || null,
            scraped_at: article.scrapedAt
        };

        await this.getTable('insights').insert([row], { ignoreUnknownValues: true });
    }

    async getInsightIds(): Promise<string[]> {
        await this.initialize();
        const query = `SELECT id FROM \`${PROJECT_ID}.${DATASET_ID}.insights\``;
        const [rows] = await this.bq.query({ query });
        return rows.map((r: any) => r.id);
    }

    // Sync logging
    async logSync(type: string, details: Record<string, any>): Promise<void> {
        await this.initialize();
        await this.getTable('sync_log').insert([{
            type,
            details: JSON.stringify(details),
            timestamp: new Date().toISOString()
        }]);
    }
}

// Singleton
let storageInstance: BigQueryStorage | null = null;

export function getStorage(): BigQueryStorage {
    if (!storageInstance) {
        storageInstance = new BigQueryStorage();
    }
    return storageInstance;
}

export { BigQueryStorage, PROJECT_ID, DATASET_ID };
