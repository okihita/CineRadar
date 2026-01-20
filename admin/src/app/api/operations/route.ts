import { NextResponse } from 'next/server';

function getMockData() {
    return {
        capacityUtilization: [
            { name: 'Grand Indonesia XXI', chain: 'XXI', city: 'Jakarta', total_seats: 2400, showtimes: 85, avg_occupancy: 78.5, avg_filled: 1884 },
            { name: 'Plaza Senayan XXI', chain: 'XXI', city: 'Jakarta', total_seats: 1800, showtimes: 72, avg_occupancy: 72.3, avg_filled: 1301 },
            { name: 'CGV Grand Indonesia', chain: 'CGV', city: 'Jakarta', total_seats: 1600, showtimes: 68, avg_occupancy: 70.1, avg_filled: 1122 },
        ],
        peakHours: [
            { hour: 10, showtimes: 450, avg_occupancy: 35.2, total_tickets: 8500 },
            { hour: 12, showtimes: 520, avg_occupancy: 48.5, total_tickets: 12800 },
            { hour: 14, showtimes: 580, avg_occupancy: 52.3, total_tickets: 15200 },
            { hour: 16, showtimes: 620, avg_occupancy: 58.8, total_tickets: 18500 },
            { hour: 18, showtimes: 680, avg_occupancy: 72.5, total_tickets: 25800 },
            { hour: 19, showtimes: 720, avg_occupancy: 82.3, total_tickets: 32500 },
            { hour: 20, showtimes: 650, avg_occupancy: 75.8, total_tickets: 28200 },
            { hour: 21, showtimes: 480, avg_occupancy: 62.5, total_tickets: 18500 },
        ],
        dayOfWeek: [
            { day_name: 'Sunday', day_num: 0, showtimes: 1850, avg_occupancy: 78.5 },
            { day_name: 'Monday', day_num: 1, showtimes: 1200, avg_occupancy: 45.2 },
            { day_name: 'Tuesday', day_num: 2, showtimes: 1180, avg_occupancy: 42.8 },
            { day_name: 'Wednesday', day_num: 3, showtimes: 1220, avg_occupancy: 48.5 },
            { day_name: 'Thursday', day_num: 4, showtimes: 1280, avg_occupancy: 52.3 },
            { day_name: 'Friday', day_num: 5, showtimes: 1650, avg_occupancy: 68.8 },
            { day_name: 'Saturday', day_num: 6, showtimes: 1920, avg_occupancy: 82.5 },
        ],
        roomUtilization: [
            { room_type: 'IMAX', showtimes: 850, avg_occupancy: 85.2, avg_price: 120000, total_tickets: 42500 },
            { room_type: '4DX', showtimes: 620, avg_occupancy: 78.5, avg_price: 100000, total_tickets: 28500 },
            { room_type: 'Premiere', showtimes: 1200, avg_occupancy: 72.3, avg_price: 85000, total_tickets: 52000 },
            { room_type: '2D', showtimes: 8500, avg_occupancy: 58.5, avg_price: 55000, total_tickets: 285000 },
        ],
        concessionTiming: [
            { hour: 10, concession_revenue: 45000000, ticket_revenue: 180000000, concession_ratio: 25.0 },
            { hour: 14, concession_revenue: 85000000, ticket_revenue: 320000000, concession_ratio: 26.6 },
            { hour: 19, concession_revenue: 180000000, ticket_revenue: 580000000, concession_ratio: 31.0 },
        ],
        staffSchedule: [
            { shift: 'Morning (10-12)', avg_occupancy: 38.5, showtimes: 1200, recommendation: 'Minimal Staff' },
            { shift: 'Afternoon (12-15)', avg_occupancy: 52.3, showtimes: 1800, recommendation: 'Regular Staff' },
            { shift: 'Evening (15-18)', avg_occupancy: 62.5, showtimes: 2200, recommendation: 'Regular Staff' },
            { shift: 'Prime (18-21)', avg_occupancy: 78.5, showtimes: 2800, recommendation: 'Full Staff' },
            { shift: 'Late (21+)', avg_occupancy: 55.2, showtimes: 800, recommendation: 'Regular Staff' },
        ],
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
