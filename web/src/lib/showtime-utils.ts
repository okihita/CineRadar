import { TheaterSchedule } from '@/types';
import { formatRupiah } from '@/lib/utils';

// Time-of-day helper
export function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
    if (!time || typeof time !== 'string') return 'afternoon';
    const hour = parseInt(time.split(':')[0], 10);
    if (isNaN(hour)) return 'afternoon';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}

const TIME_STYLES = {
    morning: 'from-amber-500 to-yellow-400 text-black shadow-amber-500/30',
    afternoon: 'from-sky-500 to-blue-500 text-white shadow-blue-500/30',
    evening: 'from-purple-600 to-pink-600 text-white shadow-purple-500/30',
    night: 'from-indigo-700 to-purple-900 text-white shadow-indigo-500/30',
} as const;

export function getTimeStyle(time: string): string {
    const period = getTimeOfDay(time);
    return TIME_STYLES[period] || TIME_STYLES.afternoon;
}


// Format price (Re-export or wrap)
export function formatPrice(price: number): string {
    return formatRupiah(price);
}

// Calculate comprehensive aggregated stats for movie schedules
export function calculateShowtimeStats(schedules: Record<string, TheaterSchedule[]> = {}) {
    let totalTheatres = 0;
    const allShowtimes: string[] = [];
    const prices: number[] = [];

    Object.values(schedules).forEach(theaters => {
        totalTheatres += (theaters || []).length;
        (theaters || []).forEach(t => {
            (t.rooms || []).forEach(r => {
                if (Array.isArray(r.showtimes)) {
                    allShowtimes.push(...r.showtimes);
                }
                if (r.price && typeof r.price === 'string') {
                    const matches = r.price.match(/\d[\d.,]*/g);
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m.replace(/[.,]/g, ''), 10);
                            if (!isNaN(num) && num > 0 && num < 5_000_000) prices.push(num);
                        });
                    }
                }
            });
        });
    });

    const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null;

    return {
        totalTheatres,
        allShowtimes,
        priceRange,
    };
}

