import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // Theatre density by city with population
        const theatreDensity = db.prepare(`
      SELECT c.name as city, c.region, c.population,
             COUNT(t.theatre_id) as theatres,
             ROUND(COUNT(t.theatre_id) * 100000.0 / c.population, 2) as per_100k,
             SUM(t.total_seats) as total_seats,
             ROUND(SUM(t.total_seats) * 1.0 / c.population * 1000, 2) as seats_per_1k
      FROM cities c
      LEFT JOIN theatres t ON c.city_id = t.city_id
      GROUP BY c.city_id
      ORDER BY per_100k DESC
    `).all();

        // Competitor proximity (theatres in same city by chain)
        const competitorProximity = db.prepare(`
      SELECT c.name as city,
             SUM(CASE WHEN t.chain = 'XXI' THEN 1 ELSE 0 END) as xxi,
             SUM(CASE WHEN t.chain = 'CGV' THEN 1 ELSE 0 END) as cgv,
             SUM(CASE WHEN t.chain = 'Cinépolis' THEN 1 ELSE 0 END) as cinepolis,
             COUNT(*) as total
      FROM theatres t
      JOIN cities c ON t.city_id = c.city_id
      GROUP BY c.city_id
      ORDER BY total DESC
    `).all();

        // Underserved markets (low theatres per capita)
        const underserved = db.prepare(`
      SELECT c.name as city, c.region, c.population,
             COUNT(t.theatre_id) as theatres,
             ROUND(COUNT(t.theatre_id) * 100000.0 / c.population, 2) as per_100k,
             c.population / 100000 - COUNT(t.theatre_id) as gap
      FROM cities c
      LEFT JOIN theatres t ON c.city_id = t.city_id
      GROUP BY c.city_id
      HAVING gap > 0
      ORDER BY gap DESC
    `).all();

        // Theatre age analysis
        const theatreAge = db.prepare(`
      SELECT 
        CASE 
          WHEN julianday('now') - julianday(opened_date) < 365 THEN 'New (<1 year)'
          WHEN julianday('now') - julianday(opened_date) < 365*3 THEN 'Recent (1-3 years)'
          WHEN julianday('now') - julianday(opened_date) < 365*7 THEN 'Established (3-7 years)'
          ELSE 'Legacy (>7 years)'
        END as age_group,
        COUNT(*) as count,
        AVG(total_seats) as avg_seats
      FROM theatres
      WHERE opened_date IS NOT NULL
      GROUP BY age_group
      ORDER BY 
        CASE age_group 
          WHEN 'New (<1 year)' THEN 1 
          WHEN 'Recent (1-3 years)' THEN 2
          WHEN 'Established (3-7 years)' THEN 3
          ELSE 4
        END
    `).all();

        // Expansion recommendations
        const recommendations = db.prepare(`
      SELECT c.name as city, c.region, c.population,
             COUNT(t.theatre_id) as current_theatres,
             ROUND(c.population / 100000.0, 1) as recommended_min,
             ROUND(c.population / 100000.0 - COUNT(t.theatre_id), 1) as additional_needed
      FROM cities c
      LEFT JOIN theatres t ON c.city_id = t.city_id
      GROUP BY c.city_id
      ORDER BY additional_needed DESC
      LIMIT 10
    `).all();

        db.close();

        return NextResponse.json({
            theatreDensity,
            competitorProximity,
            underserved,
            theatreAge,
            recommendations,
        });
    } catch (error) {
        console.error('Error reading location data:', error);
        return NextResponse.json({ error: 'Failed to load location data' }, { status: 500 });
    }
}
