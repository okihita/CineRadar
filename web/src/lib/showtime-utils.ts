// Showtime utilities for CityShowtimes component

export interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
        past_showtimes?: string[];
    }[];
}

// Time-of-day helper
export function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}

export function getTimeStyle(time: string): string {
    const period = getTimeOfDay(time);
    switch (period) {
        case 'morning':
            return 'from-amber-500 to-yellow-400 text-black shadow-amber-500/50';
        case 'afternoon':
            return 'from-sky-500 to-blue-500 text-white shadow-blue-500/50';
        case 'evening':
            return 'from-purple-600 to-pink-600 text-white shadow-purple-500/50';
        case 'night':
            return 'from-indigo-800 to-purple-900 text-white shadow-indigo-500/50';
    }
}

export function getTimeIcon(time: string): string {
    const period = getTimeOfDay(time);
    switch (period) {
        case 'morning': return '🌅';
        case 'afternoon': return '☀️';
        case 'evening': return '🌆';
        case 'night': return '🌙';
    }
}

// Price range extractor
export function extractPriceRange(schedules: Record<string, TheaterSchedule[]>): { min: number; max: number } | null {
    const prices: number[] = [];
    Object.values(schedules).forEach(theaters => {
        theaters.forEach(t => {
            t.rooms.forEach(r => {
                // Extract numbers from price string like "Rp50.000 - Rp75.000"
                const matches = r.price.match(/\d+[.,]?\d*/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = parseInt(m.replace(/[.,]/g, ''), 10);
                        if (num > 0) prices.push(num);
                    });
                }
            });
        });
    });
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Format price
export function formatPrice(price: number): string {
    if (price >= 1000) {
        return `Rp${(price / 1000).toFixed(0)}k`;
    }
    return `Rp${price}`;
}

// Get all showtimes from schedules
export function getAllShowtimes(schedules: Record<string, TheaterSchedule[]>): string[] {
    const times: string[] = [];
    Object.values(schedules).forEach(theaters => {
        theaters.forEach(t => {
            t.rooms.forEach(r => {
                times.push(...r.showtimes);
            });
        });
    });
    return times;
}
