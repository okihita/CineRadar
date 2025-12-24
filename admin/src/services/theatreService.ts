/**
 * Theatre Service - Abstracts data fetching from GCP Firestore
 */

import { firestoreRestClient } from '@/lib/firestore-rest';
import { Theatre, ScraperRun } from '@/types';

export interface TheatreService {
    getTheatres(): Promise<Theatre[]>;
    getScraperRuns(limitCount?: number): Promise<ScraperRun[]>;
}

export const firebaseTheatreService: TheatreService = {
    async getTheatres(): Promise<Theatre[]> {
        const docs = await firestoreRestClient.getCollection('theatres');
        return docs.map(doc => ({
            theatre_id: doc.id as string,
            ...doc
        })) as Theatre[];
    },

    async getScraperRuns(limitCount = 5): Promise<ScraperRun[]> {
        const docs = await firestoreRestClient.getCollectionWithQuery('scraper_runs', 'timestamp', limitCount);
        return docs as unknown as ScraperRun[];
    }
};

// Standalone exports for direct imports
export const getScraperRuns = (limitCount?: number) => firebaseTheatreService.getScraperRuns(limitCount);
export const getTheatres = () => firebaseTheatreService.getTheatres();

export default firebaseTheatreService;

