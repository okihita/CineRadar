import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // Total revenue by chain
        const revenueByChain = db.prepare(`
      SELECT t.chain,
             SUM(r.total_revenue) as total_revenue,
             SUM(r.ticket_revenue) as ticket_revenue,
             SUM(r.concession_revenue) as concession_revenue,
             SUM(r.tickets_sold) as tickets_sold,
             ROUND(AVG(r.avg_ticket_price), 0) as avg_ticket_price
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      GROUP BY t.chain
      ORDER BY total_revenue DESC
    `).all();

        // Revenue by city
        const revenueByCity = db.prepare(`
      SELECT c.name as city, c.region,
             SUM(r.total_revenue) as total_revenue,
             SUM(r.tickets_sold) as tickets_sold,
             ROUND(SUM(r.total_revenue) * 1.0 / SUM(r.tickets_sold), 0) as revenue_per_ticket
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      JOIN cities c ON t.city_id = c.city_id
      GROUP BY c.city_id
      ORDER BY total_revenue DESC
    `).all();

        // Daily revenue trend (last 30 days)
        const dailyTrend = db.prepare(`
      SELECT date,
             SUM(total_revenue) as total_revenue,
             SUM(tickets_sold) as tickets_sold
      FROM revenue_daily
      GROUP BY date
      ORDER BY date ASC
    `).all();

        // Top performing theatres (by RPS - Revenue Per Seat)
        const topTheatres = db.prepare(`
      SELECT t.name, t.chain, c.name as city,
             SUM(r.total_revenue) as total_revenue,
             SUM(r.tickets_sold) as tickets_sold,
             t.total_seats,
             ROUND(SUM(r.total_revenue) * 1.0 / (t.total_seats * 30), 0) as daily_rps
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      JOIN cities c ON t.city_id = c.city_id
      GROUP BY t.theatre_id
      ORDER BY daily_rps DESC
      LIMIT 10
    `).all();

        // Bottom performing (marketing opportunity)
        const bottomTheatres = db.prepare(`
      SELECT t.name, t.chain, c.name as city,
             SUM(r.total_revenue) as total_revenue,
             SUM(r.tickets_sold) as tickets_sold,
             t.total_seats,
             ROUND(SUM(r.total_revenue) * 1.0 / (t.total_seats * 30), 0) as daily_rps
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      JOIN cities c ON t.city_id = c.city_id
      GROUP BY t.theatre_id
      ORDER BY daily_rps ASC
      LIMIT 10
    `).all();

        // Price elasticity simulation (comparing high vs low price theatres)
        const priceElasticity = db.prepare(`
      SELECT 
        CASE 
          WHEN r.avg_ticket_price < 50000 THEN 'Budget (<50K)'
          WHEN r.avg_ticket_price < 75000 THEN 'Standard (50-75K)'
          WHEN r.avg_ticket_price < 100000 THEN 'Premium (75-100K)'
          ELSE 'Luxury (>100K)'
        END as price_tier,
        COUNT(DISTINCT r.theatre_id) as theatres,
        ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
        SUM(r.total_revenue) as total_revenue
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id AND s.show_date = r.date
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY price_tier
      ORDER BY r.avg_ticket_price
    `).all();

        // Summary stats
        const stats = db.prepare(`
      SELECT 
        SUM(total_revenue) as total_revenue,
        SUM(ticket_revenue) as ticket_revenue,
        SUM(concession_revenue) as concession_revenue,
        SUM(tickets_sold) as tickets_sold,
        ROUND(AVG(avg_ticket_price), 0) as avg_ticket_price,
        COUNT(DISTINCT theatre_id) as theatres
      FROM revenue_daily
    `).get();

        db.close();

        return NextResponse.json({
            stats,
            revenueByChain,
            revenueByCity,
            dailyTrend,
            topTheatres,
            bottomTheatres,
            priceElasticity,
        });
    } catch (error) {
        console.error('Error reading revenue data:', error);
        return NextResponse.json({
            error: 'Failed to load revenue data',
            details: String(error)
        }, { status: 500 });
    }
}
