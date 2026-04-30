import { CastMember, MovieSummary } from '../types/performance';

/** Raw movie metadata as stored in Firestore */
interface MovieMetadata {
    name?: string;
    title?: string;
    poster?: string;
    poster_path?: string;
    genres?: string | Array<string | { name: string }>;
    age_category?: string | Array<string | { name: string }>;
    director?: string | Array<string | { name: string }>;
    production_company?: string | Array<string | { name: string }>;
    casts?: CastMember[];
    [key: string]: unknown;
}

/** Raw performance document from Firestore */
interface PerformanceDocument {
    last_swept_at?: string;
    marketing?: unknown;
    [key: string]: unknown;
}

type MetadataFieldValue = string | number | boolean | Array<string | { name: string }> | { name: string } | null | undefined;

/**
 * Formats genres, age_category, director, etc. into a string.
 * Handles strings, arrays of strings, and arrays of objects { name: string }.
 */
export function formatMetadataField(field: MetadataFieldValue): string {
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
    movieMeta: MovieMetadata | Record<string, unknown> | null,
    perfDoc: PerformanceDocument | Record<string, unknown> | null,
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
        genres: formatMetadataField(movieMeta.genres as MetadataFieldValue),
        age_category: formatMetadataField(movieMeta.age_category as MetadataFieldValue),
        director: formatMetadataField(movieMeta.director as MetadataFieldValue),
        production_house: formatMetadataField(movieMeta.production_company as MetadataFieldValue),
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
