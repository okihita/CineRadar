import { NextResponse } from 'next/server';

function getMockData() {
    return {
        stats: { total_revenue: 85000000000, ticket_revenue: 68000000000, concession_revenue: 17000000000, tickets_sold: 1250000, avg_ticket_price: 54400, theatres: 450 },
        revenueByChain: [
            { chain: 'XXI', total_revenue: 52000000000, ticket_revenue: 42000000000, concession_revenue: 10000000000, tickets_sold: 780000, avg_ticket_price: 53800 },
            { chain: 'CGV', total_revenue: 24000000000, ticket_revenue: 19000000000, concession_revenue: 5000000000, tickets_sold: 320000, avg_ticket_price: 59400 },
            { chain: 'Cinépolis', total_revenue: 9000000000, ticket_revenue: 7000000000, concession_revenue: 2000000000, tickets_sold: 150000, avg_ticket_price: 46700 },
        ],
        revenueByCity: [
            { city: 'Jakarta', region: 'Java', total_revenue: 32000000000, tickets_sold: 520000, revenue_per_ticket: 61500 },
            { city: 'Surabaya', region: 'Java', total_revenue: 12000000000, tickets_sold: 210000, revenue_per_ticket: 57100 },
            { city: 'Bandung', region: 'Java', total_revenue: 8500000000, tickets_sold: 165000, revenue_per_ticket: 51500 },
            { city: 'Medan', region: 'Sumatra', total_revenue: 5200000000, tickets_sold: 105000, revenue_per_ticket: 49500 },
        ],
        dailyTrend: Array.from({ length: 30 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - 29 + i);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return {
                date: date.toISOString().split('T')[0],
                total_revenue: isWeekend ? 3500000000 + Math.random() * 500000000 : 2200000000 + Math.random() * 400000000,
                tickets_sold: isWeekend ? 55000 + Math.floor(Math.random() * 8000) : 38000 + Math.floor(Math.random() * 5000),
            };
        }),
        topTheatres: [
            { name: 'Grand Indonesia XXI', chain: 'XXI', city: 'Jakarta', total_revenue: 4200000000, tickets_sold: 68000, total_seats: 2400, daily_rps: 58300 },
            { name: 'Plaza Senayan XXI', chain: 'XXI', city: 'Jakarta', total_revenue: 3500000000, tickets_sold: 58000, total_seats: 1800, daily_rps: 64800 },
        ],
        bottomTheatres: [
            { name: 'XXI Kupang', chain: 'XXI', city: 'Kupang', total_revenue: 180000000, tickets_sold: 4200, total_seats: 450, daily_rps: 13300 },
            { name: 'CGV Ternate', chain: 'CGV', city: 'Ternate', total_revenue: 150000000, tickets_sold: 3500, total_seats: 380, daily_rps: 13200 },
        ],
        priceElasticity: [
            { price_tier: 'Budget (<50K)', theatres: 85, avg_occupancy: 72.5, total_revenue: 12000000000 },
            { price_tier: 'Standard (50-75K)', theatres: 220, avg_occupancy: 62.3, total_revenue: 45000000000 },
            { price_tier: 'Premium (75-100K)', theatres: 110, avg_occupancy: 55.8, total_revenue: 22000000000 },
            { price_tier: 'Luxury (>100K)', theatres: 35, avg_occupancy: 48.2, total_revenue: 6000000000 },
        ],
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
