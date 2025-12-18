import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

function getMockData() {
    return {
        stats: { cities: 83, theatres: 450, movies: 35, showtimes: 12500, overall_occupancy: 62.5 },
        lowPerformingCities: [
            { name: 'Kupang', region: 'Nusa Tenggara', avg_occupancy: 38.2, theatres: 2 },
            { name: 'Ternate', region: 'Maluku', avg_occupancy: 41.5, theatres: 1 },
            { name: 'Jayapura', region: 'Papua', avg_occupancy: 43.8, theatres: 2 },
        ],
        bottomTheatres: [
            { name: 'XXI Kupang', chain: 'XXI', city: 'Kupang', avg_occupancy: 32.5 },
            { name: 'CGV Ternate', chain: 'CGV', city: 'Ternate', avg_occupancy: 35.2 },
        ],
        timeSlots: [
            { time_slot: 'Morning', avg_occupancy: 42.5, count: 2500 },
            { time_slot: 'Afternoon', avg_occupancy: 55.8, count: 3200 },
            { time_slot: 'Evening', avg_occupancy: 68.2, count: 3800 },
            { time_slot: 'Prime', avg_occupancy: 78.5, count: 2500 },
            { time_slot: 'Late', avg_occupancy: 52.3, count: 500 },
        ],
        chainPerformance: [
            { chain: 'XXI', theatres: 280, avg_occupancy: 65.2, avg_price: 55000 },
            { chain: 'CGV', theatres: 120, avg_occupancy: 62.8, avg_price: 65000 },
            { chain: 'Cinépolis', theatres: 50, avg_occupancy: 58.5, avg_price: 60000 },
        ],
        underperformingMovies: [
            { title: 'FILM INDIE A', genre: 'Drama', avg_occupancy: 28.5 },
            { title: 'DOKUMENTER B', genre: 'Documentary', avg_occupancy: 32.1 },
        ],
        marketingTriggers: [
            { theatre: 'XXI Kupang', city: 'Kupang', movie: 'SIKSA NERAKA', show_time: '10:30', room_type: '2D', occupancy: 22.5, empty_seats: 180 },
            { theatre: 'CGV Ternate', city: 'Ternate', movie: 'AGAK LAEN 2', show_time: '11:00', room_type: '2D', occupancy: 25.8, empty_seats: 150 },
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

        const lowPerformingCities = db.prepare(`SELECT c.name, c.region, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy, COUNT(DISTINCT t.theatre_id) as theatres FROM cities c JOIN theatres t ON c.city_id = t.city_id JOIN showtimes s ON t.theatre_id = s.theatre_id JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY c.city_id ORDER BY avg_occupancy ASC`).all();
        const bottomTheatres = db.prepare(`SELECT t.name, t.chain, c.name as city, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy FROM theatres t JOIN cities c ON t.city_id = c.city_id JOIN showtimes s ON t.theatre_id = s.theatre_id JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY t.theatre_id ORDER BY avg_occupancy ASC LIMIT 10`).all();
        const timeSlots = db.prepare(`SELECT CASE WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 12 THEN 'Morning' WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 15 THEN 'Afternoon' WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 18 THEN 'Evening' WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 21 THEN 'Prime' ELSE 'Late' END as time_slot, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy, COUNT(*) as count FROM showtimes s JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY time_slot`).all();
        const chainPerformance = db.prepare(`SELECT t.chain, COUNT(DISTINCT t.theatre_id) as theatres, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy, ROUND(AVG(s.price), 0) as avg_price FROM theatres t JOIN showtimes s ON t.theatre_id = s.theatre_id JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY t.chain ORDER BY avg_occupancy DESC`).all();
        const underperformingMovies = db.prepare(`SELECT m.title, m.genre, ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy FROM movies m JOIN showtimes s ON m.movie_id = s.movie_id JOIN occupancy o ON s.showtime_id = o.showtime_id GROUP BY m.movie_id ORDER BY avg_occupancy ASC LIMIT 5`).all();
        const marketingTriggers = db.prepare(`SELECT t.name as theatre, c.name as city, m.title as movie, s.show_time, s.room_type, ROUND(o.occupancy_pct * 100, 1) as occupancy, s.total_seats - o.seats_sold as empty_seats FROM showtimes s JOIN theatres t ON s.theatre_id = t.theatre_id JOIN cities c ON t.city_id = c.city_id JOIN movies m ON s.movie_id = m.movie_id JOIN occupancy o ON s.showtime_id = o.showtime_id WHERE o.occupancy_pct < 0.3 ORDER BY o.occupancy_pct ASC LIMIT 15`).all();
        const stats = db.prepare(`SELECT (SELECT COUNT(*) FROM cities) as cities, (SELECT COUNT(*) FROM theatres) as theatres, (SELECT COUNT(*) FROM movies) as movies, (SELECT COUNT(*) FROM showtimes) as showtimes, (SELECT ROUND(AVG(occupancy_pct) * 100, 1) FROM occupancy) as overall_occupancy`).get();

        db.close();
        return NextResponse.json({ stats, lowPerformingCities, bottomTheatres, timeSlots, chainPerformance, underperformingMovies, marketingTriggers });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
