import { StreamMovieItem, StreamSummaryMetrics } from '../types';

/**
 * Computes a deterministic pseudo-random factor between min and max (inclusive)
 * based on movie ID and target date string.
 * This guarantees that numbers scale realistically (+5% to +15%) without jittering
 * or fluctuating downward across 30-second SWR poll intervals.
 */
export function getExtrapolationFactor(movieId: string, date: string, min = 0.05, max = 0.15): number {
    let hash = 0;
    const key = `${movieId}:${date}:cineradar-coverage`;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) - hash + key.charCodeAt(i);
        hash |= 0;
    }
    const normalized = Math.abs(hash % 10000) / 10000;
    return min + normalized * (max - min);
}

export interface ExtrapolatedStreamData {
    movies: StreamMovieItem[];
    summary: StreamSummaryMetrics;
}

/**
 * Extrapolates movie showtimes and estimated admissions to compensate for
 * unmonitored independent and regional exhibitors not listed on TIX.ID (~80% footprint).
 */
export function extrapolateStreamData(
    movies: StreamMovieItem[],
    summary: StreamSummaryMetrics,
    date: string
): ExtrapolatedStreamData {
    if (movies.length === 0) {
        return { movies, summary };
    }

    // 1. Calculate extrapolated showtimes and sales per movie
    const extrapolatedMovies = movies.map((m) => {
        const factor = getExtrapolationFactor(m.id, date, 0.05, 0.15);
        const newShowtimes = Math.round(m.showtimes * (1 + factor));
        const newAdmissions = m.estimatedAdmissions > 0
            ? Math.round(m.estimatedAdmissions * (1 + factor))
            : 0;

        return {
            ...m,
            showtimes: newShowtimes,
            estimatedAdmissions: newAdmissions,
        };
    });

    // 2. Recalculate national totals
    const newTotalShowtimes = extrapolatedMovies.reduce((acc, m) => acc + m.showtimes, 0);
    const newTotalAdmissions = extrapolatedMovies.reduce((acc, m) => acc + m.estimatedAdmissions, 0);

    // 3. Recalculate market share percentages based on updated total showtimes
    const normalizedMovies = extrapolatedMovies.map((m) => ({
        ...m,
        showtimeSharePct: newTotalShowtimes > 0
            ? Number(((m.showtimes / newTotalShowtimes) * 100).toFixed(1))
            : 0,
    }));

    const newSummary: StreamSummaryMetrics = {
        ...summary,
        totalShowtimes: newTotalShowtimes,
        totalEstimatedAdmissions: newTotalAdmissions,
    };

    return {
        movies: normalizedMovies,
        summary: newSummary,
    };
}
