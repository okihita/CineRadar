import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

function getMockData() {
    return {
        nationalShare: [
            { chain: 'XXI', share_pct: 58.2, theatres: 280 },
            { chain: 'CGV', share_pct: 28.5, theatres: 120 },
            { chain: 'Cinépolis', share_pct: 13.3, theatres: 50 },
        ],
        cityShare: [
            { city: 'Jakarta', chain: 'XXI', share_pct: 52.0, theatre_count: 45 },
            { city: 'Jakarta', chain: 'CGV', share_pct: 32.0, theatre_count: 28 },
            { city: 'Jakarta', chain: 'Cinépolis', share_pct: 16.0, theatre_count: 14 },
            { city: 'Surabaya', chain: 'XXI', share_pct: 65.0, theatre_count: 18 },
            { city: 'Surabaya', chain: 'CGV', share_pct: 25.0, theatre_count: 7 },
        ],
        shareTrend: [
            { chain: 'XXI', month: '2024-07', share_pct: 60.1 },
            { chain: 'XXI', month: '2024-12', share_pct: 58.2 },
            { chain: 'CGV', month: '2024-07', share_pct: 26.8 },
            { chain: 'CGV', month: '2024-12', share_pct: 28.5 },
        ],
        priceComparison: [
            { chain: 'XXI', room_type: '2D', avg_price: 55000, min_price: 35000, max_price: 75000 },
            { chain: 'CGV', room_type: '2D', avg_price: 65000, min_price: 45000, max_price: 85000 },
            { chain: 'XXI', room_type: 'IMAX', avg_price: 120000, min_price: 100000, max_price: 150000 },
        ],
        priceTrend: [
            { chain: 'XXI', month: '2024-07', avg_price: 52000 },
            { chain: 'XXI', month: '2024-12', avg_price: 55000 },
            { chain: 'CGV', month: '2024-07', avg_price: 62000 },
            { chain: 'CGV', month: '2024-12', avg_price: 65000 },
        ],
        expansionEvents: [
            { chain: 'CGV', city: 'Makassar', event_type: 'Opening', event_date: '2024-11-15', theatre_name: 'CGV Trans Studio' },
            { chain: 'XXI', city: 'Medan', event_type: 'Renovation', event_date: '2024-10-01', theatre_name: 'XXI Sun Plaza' },
        ],
        chainDensity: [
            { city: 'Jakarta', population: 10500000, chain: 'XXI', theatres: 45, per_100k: 0.43 },
            { city: 'Jakarta', population: 10500000, chain: 'CGV', theatres: 28, per_100k: 0.27 },
        ],
        battlegrounds: [
            { city: 'Jakarta', gap: 20.0, breakdown: 'XXI:52.0, CGV:32.0, Cinépolis:16.0' },
            { city: 'Bandung', gap: 25.0, breakdown: 'XXI:55.0, CGV:30.0, Cinépolis:15.0' },
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

        const nationalShare = db.prepare(`SELECT chain, ROUND(AVG(share_pct), 1) as share_pct, SUM(theatre_count) as theatres FROM market_share WHERE month = (SELECT MAX(month) FROM market_share) GROUP BY chain ORDER BY share_pct DESC`).all();
        const cityShare = db.prepare(`SELECT c.name as city, ms.chain, ms.share_pct, ms.theatre_count FROM market_share ms JOIN cities c ON ms.city_id = c.city_id WHERE ms.month = (SELECT MAX(month) FROM market_share) ORDER BY c.name, ms.share_pct DESC`).all();
        const shareTrend = db.prepare(`SELECT chain, month, ROUND(AVG(share_pct), 1) as share_pct FROM market_share GROUP BY chain, month ORDER BY month, chain`).all();
        const priceComparison = db.prepare(`SELECT chain, room_type, avg_price, min_price, max_price FROM price_history WHERE month = (SELECT MAX(month) FROM price_history) ORDER BY chain, avg_price DESC`).all();
        const priceTrend = db.prepare(`SELECT chain, month, ROUND(AVG(avg_price), 0) as avg_price FROM price_history WHERE room_type = '2D' GROUP BY chain, month ORDER BY month, chain`).all();
        const expansionEvents = db.prepare(`SELECT e.chain, c.name as city, e.event_type, e.event_date, e.theatre_name FROM expansion_events e JOIN cities c ON e.city_id = c.city_id ORDER BY e.event_date DESC`).all();
        const chainDensity = db.prepare(`SELECT c.name as city, c.population, t.chain, COUNT(*) as theatres, ROUND(COUNT(*) * 100000.0 / c.population, 2) as per_100k FROM theatres t JOIN cities c ON t.city_id = c.city_id GROUP BY c.city_id, t.chain ORDER BY c.name, per_100k DESC`).all();
        const battlegrounds = db.prepare(`SELECT c.name as city, MAX(ms.share_pct) - MIN(ms.share_pct) as gap, GROUP_CONCAT(ms.chain || ':' || ms.share_pct, ', ') as breakdown FROM market_share ms JOIN cities c ON ms.city_id = c.city_id WHERE ms.month = (SELECT MAX(month) FROM market_share) GROUP BY c.city_id HAVING COUNT(DISTINCT ms.chain) >= 2 ORDER BY gap ASC LIMIT 10`).all();

        db.close();
        return NextResponse.json({ nationalShare, cityShare, shareTrend, priceComparison, priceTrend, expansionEvents, chainDensity, battlegrounds });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
