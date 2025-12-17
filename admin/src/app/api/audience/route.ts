import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// Path to the mock SQLite database
const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // 1. Low-performing cities
        const lowPerformingCities = db.prepare(`
      SELECT c.name, c.region, 
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
             COUNT(DISTINCT t.theatre_id) as theatres
      FROM cities c
      JOIN theatres t ON c.city_id = t.city_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY c.city_id
      ORDER BY avg_occupancy ASC
    `).all();

        // 2. Bottom theatres
        const bottomTheatres = db.prepare(`
      SELECT t.name, t.chain, c.name as city,
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy
      FROM theatres t
      JOIN cities c ON t.city_id = c.city_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY t.theatre_id
      ORDER BY avg_occupancy ASC
      LIMIT 10
    `).all();

        // 3. Time slot analysis
        const timeSlots = db.prepare(`
      SELECT 
        CASE 
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 12 THEN 'Morning'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 15 THEN 'Afternoon'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 18 THEN 'Evening'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 21 THEN 'Prime'
          ELSE 'Late'
        END as time_slot,
        ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
        COUNT(*) as count
      FROM showtimes s
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY time_slot
      ORDER BY 
        CASE time_slot 
          WHEN 'Morning' THEN 1 
          WHEN 'Afternoon' THEN 2 
          WHEN 'Evening' THEN 3 
          WHEN 'Prime' THEN 4 
          ELSE 5 
        END
    `).all();

        // 4. Chain performance
        const chainPerformance = db.prepare(`
      SELECT t.chain,
             COUNT(DISTINCT t.theatre_id) as theatres,
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
             ROUND(AVG(s.price), 0) as avg_price
      FROM theatres t
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY t.chain
      ORDER BY avg_occupancy DESC
    `).all();

        // 5. Movies needing push
        const underperformingMovies = db.prepare(`
      SELECT m.title, m.genre,
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy
      FROM movies m
      JOIN showtimes s ON m.movie_id = s.movie_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY m.movie_id
      ORDER BY avg_occupancy ASC
      LIMIT 5
    `).all();

        // 6. Marketing triggers (today, low occupancy)
        const marketingTriggers = db.prepare(`
      SELECT 
        t.name as theatre,
        c.name as city,
        m.title as movie,
        s.show_time,
        s.room_type,
        ROUND(o.occupancy_pct * 100, 1) as occupancy,
        s.total_seats - o.seats_sold as empty_seats
      FROM showtimes s
      JOIN theatres t ON s.theatre_id = t.theatre_id
      JOIN cities c ON t.city_id = c.city_id
      JOIN movies m ON s.movie_id = m.movie_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      WHERE o.occupancy_pct < 0.3
      ORDER BY o.occupancy_pct ASC
      LIMIT 15
    `).all();

        // 7. Summary stats
        const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM cities) as cities,
        (SELECT COUNT(*) FROM theatres) as theatres,
        (SELECT COUNT(*) FROM movies) as movies,
        (SELECT COUNT(*) FROM showtimes) as showtimes,
        (SELECT ROUND(AVG(occupancy_pct) * 100, 1) FROM occupancy) as overall_occupancy
    `).get();

        db.close();

        return NextResponse.json({
            stats,
            lowPerformingCities,
            bottomTheatres,
            timeSlots,
            chainPerformance,
            underperformingMovies,
            marketingTriggers,
        });
    } catch (error) {
        console.error('Error reading mock database:', error);
        return NextResponse.json({
            error: 'Failed to load BI data. Run mock_data_generator.py first.',
            details: String(error)
        }, { status: 500 });
    }
}
