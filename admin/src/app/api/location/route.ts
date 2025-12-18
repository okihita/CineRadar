import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

function getMockData() {
    return {
        theatreDensity: [
            { city: 'Jakarta', region: 'Java', population: 10500000, theatres: 87, per_100k: 0.83, total_seats: 52000, seats_per_1k: 4.95 },
            { city: 'Surabaya', region: 'Java', population: 2900000, theatres: 28, per_100k: 0.97, total_seats: 16800, seats_per_1k: 5.79 },
            { city: 'Bandung', region: 'Java', population: 2500000, theatres: 22, per_100k: 0.88, total_seats: 13200, seats_per_1k: 5.28 },
            { city: 'Medan', region: 'Sumatra', population: 2200000, theatres: 15, per_100k: 0.68, total_seats: 9000, seats_per_1k: 4.09 },
            { city: 'Makassar', region: 'Sulawesi', population: 1500000, theatres: 8, per_100k: 0.53, total_seats: 4800, seats_per_1k: 3.20 },
        ],
        competitorProximity: [
            { city: 'Jakarta', xxi: 45, cgv: 28, cinepolis: 14, total: 87 },
            { city: 'Surabaya', xxi: 18, cgv: 7, cinepolis: 3, total: 28 },
            { city: 'Bandung', xxi: 14, cgv: 5, cinepolis: 3, total: 22 },
        ],
        underserved: [
            { city: 'Kupang', region: 'Nusa Tenggara', population: 450000, theatres: 2, per_100k: 0.44, gap: 2.5 },
            { city: 'Jayapura', region: 'Papua', population: 320000, theatres: 2, per_100k: 0.63, gap: 1.2 },
        ],
        theatreAge: [
            { age_group: 'New (<1 year)', count: 25, avg_seats: 650 },
            { age_group: 'Recent (1-3 years)', count: 85, avg_seats: 580 },
            { age_group: 'Established (3-7 years)', count: 180, avg_seats: 520 },
            { age_group: 'Legacy (>7 years)', count: 160, avg_seats: 480 },
        ],
        recommendations: [
            { city: 'Kupang', region: 'Nusa Tenggara', population: 450000, current_theatres: 2, recommended_min: 4.5, additional_needed: 2.5 },
            { city: 'Jayapura', region: 'Papua', population: 320000, current_theatres: 2, recommended_min: 3.2, additional_needed: 1.2 },
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

        const theatreDensity = db.prepare(`SELECT c.name as city, c.region, c.population, COUNT(t.theatre_id) as theatres, ROUND(COUNT(t.theatre_id) * 100000.0 / c.population, 2) as per_100k, SUM(t.total_seats) as total_seats, ROUND(SUM(t.total_seats) * 1.0 / c.population * 1000, 2) as seats_per_1k FROM cities c LEFT JOIN theatres t ON c.city_id = t.city_id GROUP BY c.city_id ORDER BY per_100k DESC`).all();
        const competitorProximity = db.prepare(`SELECT c.name as city, SUM(CASE WHEN t.chain = 'XXI' THEN 1 ELSE 0 END) as xxi, SUM(CASE WHEN t.chain = 'CGV' THEN 1 ELSE 0 END) as cgv, SUM(CASE WHEN t.chain = 'Cinépolis' THEN 1 ELSE 0 END) as cinepolis, COUNT(*) as total FROM theatres t JOIN cities c ON t.city_id = c.city_id GROUP BY c.city_id ORDER BY total DESC`).all();
        const underserved = db.prepare(`SELECT c.name as city, c.region, c.population, COUNT(t.theatre_id) as theatres, ROUND(COUNT(t.theatre_id) * 100000.0 / c.population, 2) as per_100k, c.population / 100000 - COUNT(t.theatre_id) as gap FROM cities c LEFT JOIN theatres t ON c.city_id = t.city_id GROUP BY c.city_id HAVING gap > 0 ORDER BY gap DESC`).all();
        const theatreAge = db.prepare(`SELECT CASE WHEN julianday('now') - julianday(opened_date) < 365 THEN 'New (<1 year)' WHEN julianday('now') - julianday(opened_date) < 365*3 THEN 'Recent (1-3 years)' WHEN julianday('now') - julianday(opened_date) < 365*7 THEN 'Established (3-7 years)' ELSE 'Legacy (>7 years)' END as age_group, COUNT(*) as count, AVG(total_seats) as avg_seats FROM theatres WHERE opened_date IS NOT NULL GROUP BY age_group`).all();
        const recommendations = db.prepare(`SELECT c.name as city, c.region, c.population, COUNT(t.theatre_id) as current_theatres, ROUND(c.population / 100000.0, 1) as recommended_min, ROUND(c.population / 100000.0 - COUNT(t.theatre_id), 1) as additional_needed FROM cities c LEFT JOIN theatres t ON c.city_id = t.city_id GROUP BY c.city_id ORDER BY additional_needed DESC LIMIT 10`).all();

        db.close();
        return NextResponse.json({ theatreDensity, competitorProximity, underserved, theatreAge, recommendations });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
