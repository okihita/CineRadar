import { CastMember, MovieSummary } from '../types/performance';

/**
 * Formats genres, age_category, director, etc. into a string.
 * Handles strings, arrays of strings, and arrays of objects { name: string }.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatMetadataField(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
        return field
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'name' in item) return item.name;
                return '';
            })
            .filter(Boolean)
            .join(', ');
    }
    if (typeof field === 'object' && 'name' in field) return field.name;
    return String(field);
}

/**
 * Builds a MovieSummary from raw Firestore movie metadata + performance doc.
 * Shared by the API route and the DailyPerformanceDetail server component.
 */
export function buildMovieSummary(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movieMeta: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    perfDoc: any,
    movieId: string,
): MovieSummary | null {
    if (!movieMeta) return null;

    return {
        ...((perfDoc as object) || {}),
        id: movieId,
        movie_id: movieId,
        title: (movieMeta.name as string) || 'Unknown Title',
        poster:
            (movieMeta.poster as string) ||
            (movieMeta.poster_path as string) ||
            '',
        genres: formatMetadataField(movieMeta.genres),
        age_category: formatMetadataField(movieMeta.age_category),
        director: formatMetadataField(movieMeta.director),
        production_house: formatMetadataField(movieMeta.production_company),
        actors: Array.isArray(movieMeta.casts)
            ? (movieMeta.casts as CastMember[])
                .filter((c) => c.cast_type === 'Actor')
                .map((c) => c.name || c.actor_name)
                .filter(Boolean) as string[]
            : [],
        last_updated: perfDoc?.last_swept_at || '',
        marketing: perfDoc?.marketing || undefined,
    } as unknown as MovieSummary;
}
