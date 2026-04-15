import { ShowtimeSnapshot, ForensicAggregation } from '../types/performance';

/**
 * Shared logic for calculating forensic metrics (Sold, Capacity, OCR, Audit Progress)
 * used across different hierarchical levels.
 */
export function calculateForensicAggregation(showtimes: ShowtimeSnapshot[]): ForensicAggregation {
    let totalSold = 0;
    let totalSeats = 0;
    let auditedCount = 0;

    showtimes.forEach(st => {
        totalSold += (st.audience_count ?? st.sold_seats ?? 0);
        totalSeats += (st.total_seats ?? 0);
        if (st.audience_count !== undefined) {
            auditedCount += 1;
        }
    });

    const trueOccupancyPct = totalSeats > 0 ? (totalSold / totalSeats) * 100 : 0;

    return {
        total_sold: totalSold,
        total_seats: totalSeats,
        showtime_count: showtimes.length,
        audited_count: auditedCount,
        true_occupancy_pct: trueOccupancyPct
    };
}
