/**
 * Firebase/Firestore Storage for Cinepoint Data
 * 
 * Uses the same Firebase project as CineRadar.
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase service account.
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import type {
    CinepointMovie,
    BoxOfficeRecord,
    ShowtimeRanking,
    InsightArticle
} from '../models/types.js';

// Collection names
const COLLECTIONS = {
    MOVIES: 'cinepoint_movies',
    BOX_OFFICE: 'cinepoint_box_office',
    SHOWTIMES: 'cinepoint_showtimes',
    INSIGHTS: 'cinepoint_insights',
    SYNC_LOG: 'cinepoint_sync_log'
} as const;

class FirebaseStorage {
    private db: Firestore;

    constructor() {
        // Initialize Firebase if not already done
        if (getApps().length === 0) {
            // Try FIREBASE_SERVICE_ACCOUNT (JSON string) first - matches CineRadar pattern
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (serviceAccountJson) {
                try {
                    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
                    initializeApp({ credential: cert(serviceAccount) });
                } catch (e) {
                    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + e);
                }
            } else {
                // Fall back to GOOGLE_APPLICATION_CREDENTIALS file path
                const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                if (serviceAccountPath) {
                    const serviceAccount = require(serviceAccountPath) as ServiceAccount;
                    initializeApp({ credential: cert(serviceAccount) });
                } else {
                    throw new Error('Either FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is required');
                }
            }
        }
        this.db = getFirestore();
    }

    // Movies
    async upsertMovie(movie: CinepointMovie): Promise<void> {
        const docRef = this.db.collection(COLLECTIONS.MOVIES).doc(String(movie.id));
        await docRef.set(movie, { merge: true });
    }

    async upsertMovies(movies: CinepointMovie[]): Promise<void> {
        const batch = this.db.batch();
        for (const movie of movies) {
            const docRef = this.db.collection(COLLECTIONS.MOVIES).doc(String(movie.id));
            batch.set(docRef, movie, { merge: true });
        }
        await batch.commit();
        console.log(`[Storage] Upserted ${movies.length} movies`);
    }

    async getMovie(movieId: number): Promise<CinepointMovie | null> {
        const doc = await this.db.collection(COLLECTIONS.MOVIES).doc(String(movieId)).get();
        return doc.exists ? (doc.data() as CinepointMovie) : null;
    }

    // Box Office
    async insertBoxOfficeRecord(record: BoxOfficeRecord): Promise<void> {
        // Use composite key: movieId_date_period
        const docId = `${record.movieId}_${record.date}_${record.period}`;
        const docRef = this.db.collection(COLLECTIONS.BOX_OFFICE).doc(docId);
        await docRef.set(record);
    }

    async insertBoxOfficeRecords(records: BoxOfficeRecord[]): Promise<void> {
        const batch = this.db.batch();
        for (const record of records) {
            const docId = `${record.movieId}_${record.date}_${record.period}`;
            const docRef = this.db.collection(COLLECTIONS.BOX_OFFICE).doc(docId);
            batch.set(docRef, record);
        }
        await batch.commit();
        console.log(`[Storage] Inserted ${records.length} box office records`);
    }

    async getLatestBoxOfficeDate(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<string | null> {
        const snapshot = await this.db
            .collection(COLLECTIONS.BOX_OFFICE)
            .where('period', '==', period)
            .orderBy('date', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return snapshot.docs[0].data().date as string;
    }

    // Showtimes
    async insertShowtimeRanking(ranking: ShowtimeRanking): Promise<void> {
        const docId = `${ranking.movieId}_${ranking.date}`;
        const docRef = this.db.collection(COLLECTIONS.SHOWTIMES).doc(docId);
        await docRef.set(ranking);
    }

    async insertShowtimeRankings(rankings: ShowtimeRanking[]): Promise<void> {
        const batch = this.db.batch();
        for (const ranking of rankings) {
            const docId = `${ranking.movieId}_${ranking.date}`;
            const docRef = this.db.collection(COLLECTIONS.SHOWTIMES).doc(docId);
            batch.set(docRef, ranking);
        }
        await batch.commit();
        console.log(`[Storage] Inserted ${rankings.length} showtime rankings`);
    }

    async getLatestShowtimeDate(): Promise<string | null> {
        const snapshot = await this.db
            .collection(COLLECTIONS.SHOWTIMES)
            .orderBy('date', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return snapshot.docs[0].data().date as string;
    }

    // Insights
    async upsertInsight(article: InsightArticle): Promise<void> {
        const docRef = this.db.collection(COLLECTIONS.INSIGHTS).doc(article.id);
        await docRef.set(article, { merge: true });
    }

    async getInsightIds(): Promise<string[]> {
        const snapshot = await this.db.collection(COLLECTIONS.INSIGHTS).select().get();
        return snapshot.docs.map(doc => doc.id);
    }

    // Sync logging
    async logSync(type: string, details: Record<string, any>): Promise<void> {
        await this.db.collection(COLLECTIONS.SYNC_LOG).add({
            type,
            ...details,
            timestamp: FieldValue.serverTimestamp()
        });
    }
}

// Singleton
let storageInstance: FirebaseStorage | null = null;

export function getStorage(): FirebaseStorage {
    if (!storageInstance) {
        storageInstance = new FirebaseStorage();
    }
    return storageInstance;
}

export { FirebaseStorage, COLLECTIONS };
