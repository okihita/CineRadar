/**
 * Theatre Service - Abstracts data fetching via API routes
 * 
 * IMPORTANT: This runs on the CLIENT side.
 * Firestore calls with service account credentials must go through API routes.
 */

import { Theatre, ScraperRun, ApiResponse } from '@/types';

export interface TheatreService {
    getTheatres(): Promise<Theatre[]>;
    getScraperRuns(limitCount?: number): Promise<ScraperRun[]>;
}

export const firebaseTheatreService: TheatreService = {
    async getTheatres(): Promise<Theatre[]> {
        const response = await fetch('/api/theatres');
        if (!response.ok) {
            throw new Error(`Failed to fetch theatres: ${response.status}`);
        }
        const result = await response.json() as ApiResponse<Theatre[]>;
        if (result.success) {
            return result.data;
        }
        throw new Error(result.error || 'Failed to fetch theatres');
    },

    async getScraperRuns(limitCount = 5): Promise<ScraperRun[]> {
        const response = await fetch(`/api/scraper?limit=${limitCount}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch scraper runs: ${response.status}`);
        }
        const data = await response.json();
        return data.runs || [];
    }
};

export default firebaseTheatreService;
