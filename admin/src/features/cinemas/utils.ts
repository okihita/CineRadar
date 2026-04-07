/**
 * Cinema feature utilities
 */
import type { Studio } from './hooks/useTheatreStudios';

/**
 * Derives a display name for a studio based on merchant-specific rules.
 */
export function getStudioDisplayName(studio: Studio, merchant?: string): string {
    const id = studio.studio_id;
    const category = studio.room_category || '';
    
    // Normalize merchant to uppercase for comparison
    const m = merchant?.toUpperCase();

    if (m === 'XXI') {
        // XXI usually just calls them "Studio 1", "Studio 2"
        // Sometimes they have a specific name like "IMAX" or "PREMIERE"
        if (category.includes('IMAX')) return `IMAX ${id}`;
        if (category.includes('PREMIERE')) return `PREMIERE ${id}`;
        return `Studio ${id}`;
    }

    if (m === 'CGV') {
        // CGV B2B IDs are long (e.g. 100112). 
        // If it's a long ID, we usually want to show the category first.
        if (id.length > 3) {
            return `${category || 'Studio'} ${id}`;
        }
        return `Studio ${id} ${category ? `(${category})` : ''}`;
    }

    if (m === 'FLIX' || m === 'CINÉPOLIS' || m === 'CINEPOLIS') {
        // For these chains, Category + ID is the most readable
        return `${category || 'Studio'} ${id}`;
    }

    // Default fallback
    return `Studio ${id} ${category ? `(${category})` : ''}`;
}
