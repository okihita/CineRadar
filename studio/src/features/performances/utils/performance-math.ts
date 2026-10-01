import { ShowtimeSnapshot, ForensicAggregation } from '../types/performance';
import { DEFAULT_TICKET_PRICE } from './format';

/**
 * Resolves the unit ticket price for a showtime snapshot.
 * Prioritizes explicitly scraped price, followed by room category tier, falling back to national ATP.
 */
export function resolveTicketPrice(showtime: ShowtimeSnapshot): number {
    if (typeof showtime.price === 'number' && showtime.price > 0) {
        return showtime.price;
    }

    const category = (showtime.room_category || '').toLowerCase();
    if (category.includes('premiere') || category.includes('velvet') || category.includes('gold')) {
        return 100000;
    }
    if (category.includes('imax')) {
        return 75000;
    }
    if (category.includes('4dx') || category.includes('ultra xd') || category.includes('screenx')) {
        return 65000;
    }

    return DEFAULT_TICKET_PRICE;
}

/**
 * Shared logic for calculating forensic metrics (Sold, Capacity, OCR, Gross Revenue, Audit Progress)
 * used across different hierarchical levels.
 */
export function calculateForensicAggregation(showtimes: ShowtimeSnapshot[]): ForensicAggregation {
    let totalSold = 0;
    let totalSeats = 0;
    let auditedCount = 0;
    let totalGrossRevenue = 0;

    showtimes.forEach(st => {
        const sold = (st.audience_count ?? st.sold_seats ?? 0);
        totalSold += sold;
        totalSeats += (st.total_seats ?? 0);
        if (st.audience_count !== undefined) {
            auditedCount += 1;
        }
        const unitPrice = resolveTicketPrice(st);
        totalGrossRevenue += sold * unitPrice;
    });

    const trueOccupancyPct = totalSeats > 0 ? (totalSold / totalSeats) * 100 : 0;

    return {
        total_sold: totalSold,
        total_seats: totalSeats,
        showtime_count: showtimes.length,
        audited_count: auditedCount,
        true_occupancy_pct: trueOccupancyPct,
        total_gross_revenue: totalGrossRevenue
    };
}
