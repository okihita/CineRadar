import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

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
    if (isServerless) {
        return NextResponse.json(getMockData());
    }

    try {
        const path = await import('path');
        const Database = (await import('better-sqlite3')).default;
        const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');
        const db = new Database(DB_PATH, { readonly: true });

        const revenueByChain = db.prepare(`SELECT t.chain, SUM(r.total_revenue) as total_revenue, SUM(r.ticket_revenue) as ticket_revenue, SUM(r.concession_revenue) as concession_revenue, SUM(r.tickets_sold) as tickets_sold, ROUND(AVG(r.avg_ticket_price), 0) as avg_ticket_price FROM revenue_daily r JOIN theatres t ON r.theatre_id = t.theatre_id GROUP BY t.chain ORDER BY total_revenue DESC`).all();
        const revenueByCity = db.prepare(`SELECT c.name as city, c.region, SUM(r.total_revenue) as total_revenue, SUM(r.tickets_sold) as tickets_sold, ROUND(SUM(r.total_revenue) * 1.0 / SUM(r.tickets_sold), 0) as revenue_per_ticket FROM revenue_daily r JOIN theatres t ON r.theatre_id = t.theatre_id JOIN cities c ON t.city_id = c.city_id GROUP BY c.city_id ORDER BY total_revenue DESC`).all();
        const dailyTrend = db.prepare(`SELECT date, SUM(total_revenue) as total_revenue, SUM(tickets_sold) as tickets_sold FROM revenue_daily GROUP BY date ORDER BY date ASC`).all();
        const topTheatres = db.prepare(`SELECT t.name, t.chain, c.name as city, SUM(r.total_revenue) as total_revenue, SUM(r.tickets_sold) as tickets_sold, t.total_seats, ROUND(SUM(r.total_revenue) * 1.0 / (t.total_seats * 30), 0) as daily_rps FROM revenue_daily r JOIN theatres t ON r.theatre_id = t.theatre_id JOIN cities c ON t.city_id = c.city_id GROUP BY t.theatre_id ORDER BY daily_rps DESC LIMIT 10`).all();
        const bottomTheatres = db.prepare(`SELECT t.name, t.chain, c.name as city, SUM(r.total_revenue) as total_revenue, SUM(r.tickets_sold) as tickets_sold, t.total_seats, ROUND(SUM(r.total_revenue) * 1.0 / (t.total_seats * 30), 0) as daily_rps FROM revenue_daily r JOIN theatres t ON r.theatre_id = t.theatre_id JOIN cities c ON t.city_id = c.city_id GROUP BY t.theatre_id ORDER BY daily_rps ASC LIMIT 10`).all();
        const priceElasticity = db.prepare(`SELECT CASE WHEN r.avg_ticket_price < 50000 THEN 'Budget (<50K)' WHEN r.avg_ticket_price < 75000 THEN 'Standard (50-75K)' WHEN r.avg_ticket_price < 100000 THEN 'Premium (75-100K)' ELSE 'Luxury (>100K)' END as price_tier, COUNT(DISTINCT r.theatre_id) as theatres, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy, SUM(r.total_revenue) as total_revenue FROM revenue_daily r JOIN theatres t ON r.theatre_id = t.theatre_id JOIN showtimes s ON t.theatre_id = s.theatre_id AND s.show_date = r.date JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY price_tier ORDER BY r.avg_ticket_price`).all();
        const stats = db.prepare(`SELECT SUM(total_revenue) as total_revenue, SUM(ticket_revenue) as ticket_revenue, SUM(concession_revenue) as concession_revenue, SUM(tickets_sold) as tickets_sold, ROUND(AVG(avg_ticket_price), 0) as avg_ticket_price, COUNT(DISTINCT theatre_id) as theatres FROM revenue_daily`).get();

        db.close();
        return NextResponse.json({ stats, revenueByChain, revenueByCity, dailyTrend, topTheatres, bottomTheatres, priceElasticity });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
