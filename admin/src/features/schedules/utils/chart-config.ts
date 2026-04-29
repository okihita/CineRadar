/**
 * Shared chart configuration for schedule showtime charts.
 * Eliminates duplicated Tooltip / axis styling across components.
 */

export const CHART_TIME_START = 9;
export const CHART_TIME_END = 23;
export const CHART_BUCKET_MINUTES = 5;

/** Shared Recharts Tooltip content style */
export const tooltipContentStyle: React.CSSProperties = {
    backgroundColor: 'var(--card)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
    fontSize: '12px',
    padding: '8px 12px',
};

export const tooltipItemStyle: React.CSSProperties = {
    color: 'var(--card-foreground)',
    padding: '2px 0',
};

export const tooltipLabelStyle: React.CSSProperties = {
    color: 'var(--muted-foreground)',
    marginBottom: '4px',
    fontWeight: 500,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tooltipFormatter = (value: any, name: any) => [value, name === 'available' ? 'Available' : 'Closed'];

/** Shared axis props */
export const xAxisTickProps = { fontSize: 10 };
export const yAxisTickProps = { fontSize: 10 };
export const axisStroke = 'var(--muted-foreground)';

/**
 * Builds an empty bucket map from CHART_TIME_START to CHART_TIME_END
 * at CHART_BUCKET_MINUTES intervals.
 */
export function buildEmptyBuckets(): Map<string, { available: number; unavailable: number }> {
    const buckets = new Map<string, { available: number; unavailable: number }>();
    for (let h = CHART_TIME_START; h <= CHART_TIME_END; h++) {
        for (let m = 0; m < 60; m += CHART_BUCKET_MINUTES) {
            const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            buckets.set(timeStr, { available: 0, unavailable: 0 });
        }
    }
    return buckets;
}

/**
 * Rounds a time string to the nearest bucket and returns the bucket key,
 * or null if outside the chart range.
 */
export function timeToBucketKey(time: string): string | null {
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < CHART_TIME_START || h > CHART_TIME_END) return null;
    const mRounded = Math.floor(m / CHART_BUCKET_MINUTES) * CHART_BUCKET_MINUTES;
    return `${h.toString().padStart(2, '0')}:${mRounded.toString().padStart(2, '0')}`;
}

/**
 * Fills a bucket map from a CitySchedule. Iterates cities → theatres → rooms → showtimes.
 * Returns { total, available } counts.
 */
export function fillBucketsFromCities(
    buckets: Map<string, { available: number; unavailable: number }>,
    cities: Record<string, unknown[]> | null | undefined,
): { total: number; available: number } {
    if (!cities) return { total: 0, available: 0 };

    let total = 0;
    let available = 0;

    for (const theatres of Object.values(cities)) {
        if (!Array.isArray(theatres)) continue;
        for (const theatre of theatres) {
            const t = theatre as { rooms?: Array<{ all_showtimes?: Array<{ time: string; is_available: boolean }> }> };
            for (const room of t.rooms || []) {
                for (const show of room.all_showtimes || []) {
                    if (!show.time) continue;
                    const bucketKey = timeToBucketKey(show.time);
                    const bucket = bucketKey ? buckets.get(bucketKey) : undefined;
                    if (bucket) {
                        if (show.is_available) {
                            bucket.available++;
                            available++;
                        } else {
                            bucket.unavailable++;
                        }
                        total++;
                    }
                }
            }
        }
    }

    return { total, available };
}
