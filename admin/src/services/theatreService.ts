/**
 * Theatre Service - Abstracts data fetching from Firebase
 * Following Dependency Inversion Principle
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Theatre, ScraperRun } from '@/types';

export interface TheatreService {
    getTheatres(): Promise<Theatre[]>;
    getScraperRuns(limitCount?: number): Promise<ScraperRun[]>;
}

/**
 * Firebase implementation of TheatreService
 */
export const firebaseTheatreService: TheatreService = {
    async getTheatres(): Promise<Theatre[]> {
        const theatresRef = collection(db, 'theatres');
        const snapshot = await getDocs(theatresRef);
        return snapshot.docs.map(doc => ({
            theatre_id: doc.id,
            ...doc.data()
        })) as Theatre[];
    },

    async getScraperRuns(limitCount = 5): Promise<ScraperRun[]> {
        const runsRef = collection(db, 'scraper_runs');
        const runsQuery = query(runsRef, orderBy('timestamp', 'desc'), limit(limitCount));
        const runsSnapshot = await getDocs(runsQuery);
        return runsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ScraperRun[];
    }
};

// Default export for easy importing
export default firebaseTheatreService;
