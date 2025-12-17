import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // Capacity utilization by theatre
        const capacityUtilization = db.prepare(`
      SELECT t.name, t.chain, c.name as city,
             t.total_seats,
             COUNT(DISTINCT s.showtime_id) as showtimes,
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
             ROUND(t.total_seats * AVG(o.occupancy_pct), 0) as avg_filled
      FROM theatres t
      JOIN cities c ON t.city_id = c.city_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY t.theatre_id
      ORDER BY avg_occupancy DESC
      LIMIT 20
    `).all();

        // Peak hours analysis
        const peakHours = db.prepare(`
      SELECT 
        CAST(substr(s.show_time, 1, 2) AS INTEGER) as hour,
        COUNT(*) as showtimes,
        ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
        SUM(o.seats_sold) as total_tickets
      FROM showtimes s
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY hour
      ORDER BY hour
    `).all();

        // Day of week analysis
        const dayOfWeek = db.prepare(`
      SELECT 
        CASE CAST(strftime('%w', s.show_date) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day_name,
        CAST(strftime('%w', s.show_date) AS INTEGER) as day_num,
        COUNT(*) as showtimes,
        ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy
      FROM showtimes s
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY day_num
      ORDER BY day_num
    `).all();

        // Room utilization by type
        const roomUtilization = db.prepare(`
      SELECT s.room_type,
             COUNT(*) as showtimes,
             ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
             ROUND(AVG(s.price), 0) as avg_price,
             SUM(o.seats_sold) as total_tickets
      FROM showtimes s
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY s.room_type
      ORDER BY avg_occupancy DESC
    `).all();

        // Concession timing (peak hours = more concession sales assumption)
        const concessionTiming = db.prepare(`
      SELECT 
        CAST(substr(s.show_time, 1, 2) AS INTEGER) as hour,
        SUM(r.concession_revenue) as concession_revenue,
        SUM(r.ticket_revenue) as ticket_revenue,
        ROUND(SUM(r.concession_revenue) * 100.0 / SUM(r.ticket_revenue), 1) as concession_ratio
      FROM showtimes s
      JOIN revenue_daily r ON s.theatre_id = r.theatre_id AND s.show_date = r.date
      GROUP BY hour
      ORDER BY hour
    `).all();

        // Staff scheduling recommendation (based on occupancy patterns)
        const staffSchedule = db.prepare(`
      SELECT 
        CASE 
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 12 THEN 'Morning (10-12)'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 15 THEN 'Afternoon (12-15)'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 18 THEN 'Evening (15-18)'
          WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 21 THEN 'Prime (18-21)'
          ELSE 'Late (21+)'
        END as shift,
        ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
        COUNT(*) as showtimes,
        CASE 
          WHEN AVG(o.occupancy_pct) > 0.7 THEN 'Full Staff'
          WHEN AVG(o.occupancy_pct) > 0.5 THEN 'Regular Staff'
          ELSE 'Minimal Staff'
        END as recommendation
      FROM showtimes s
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY shift
      ORDER BY 
        CASE shift 
          WHEN 'Morning (10-12)' THEN 1 
          WHEN 'Afternoon (12-15)' THEN 2
          WHEN 'Evening (15-18)' THEN 3
          WHEN 'Prime (18-21)' THEN 4
          ELSE 5
        END
    `).all();

        db.close();

        return NextResponse.json({
            capacityUtilization,
            peakHours,
            dayOfWeek,
            roomUtilization,
            concessionTiming,
            staffSchedule,
        });
    } catch (error) {
        console.error('Error reading operations data:', error);
        return NextResponse.json({ error: 'Failed to load operations data' }, { status: 500 });
    }
}
