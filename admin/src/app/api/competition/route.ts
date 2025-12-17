import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // Current market share by chain (national)
        const nationalShare = db.prepare(`
      SELECT chain,
             ROUND(AVG(share_pct), 1) as share_pct,
             SUM(theatre_count) as theatres
      FROM market_share
      WHERE month = (SELECT MAX(month) FROM market_share)
      GROUP BY chain
      ORDER BY share_pct DESC
    `).all();

        // Market share by city (latest month)
        const cityShare = db.prepare(`
      SELECT c.name as city, ms.chain, ms.share_pct, ms.theatre_count
      FROM market_share ms
      JOIN cities c ON ms.city_id = c.city_id
      WHERE ms.month = (SELECT MAX(month) FROM market_share)
      ORDER BY c.name, ms.share_pct DESC
    `).all();

        // Market share trend (12 months)
        const shareTrend = db.prepare(`
      SELECT chain, month, ROUND(AVG(share_pct), 1) as share_pct
      FROM market_share
      GROUP BY chain, month
      ORDER BY month, chain
    `).all();

        // Price comparison by chain and room type (latest month)
        const priceComparison = db.prepare(`
      SELECT chain, room_type, avg_price, min_price, max_price
      FROM price_history
      WHERE month = (SELECT MAX(month) FROM price_history)
      ORDER BY chain, avg_price DESC
    `).all();

        // Price trend by chain
        const priceTrend = db.prepare(`
      SELECT chain, month, ROUND(AVG(avg_price), 0) as avg_price
      FROM price_history
      WHERE room_type = '2D'
      GROUP BY chain, month
      ORDER BY month, chain
    `).all();

        // Expansion events (recent and upcoming)
        const expansionEvents = db.prepare(`
      SELECT e.chain, c.name as city, e.event_type, e.event_date, e.theatre_name
      FROM expansion_events e
      JOIN cities c ON e.city_id = c.city_id
      ORDER BY e.event_date DESC
    `).all();

        // Chain density by city (theatres per 100K population)
        const chainDensity = db.prepare(`
      SELECT c.name as city, c.population,
             t.chain,
             COUNT(*) as theatres,
             ROUND(COUNT(*) * 100000.0 / c.population, 2) as per_100k
      FROM theatres t
      JOIN cities c ON t.city_id = c.city_id
      GROUP BY c.city_id, t.chain
      ORDER BY c.name, per_100k DESC
    `).all();

        // Competitive battlegrounds (cities where chains compete closely)
        const battlegrounds = db.prepare(`
      SELECT c.name as city,
             MAX(ms.share_pct) - MIN(ms.share_pct) as gap,
             GROUP_CONCAT(ms.chain || ':' || ms.share_pct, ', ') as breakdown
      FROM market_share ms
      JOIN cities c ON ms.city_id = c.city_id
      WHERE ms.month = (SELECT MAX(month) FROM market_share)
      GROUP BY c.city_id
      HAVING COUNT(DISTINCT ms.chain) >= 2
      ORDER BY gap ASC
      LIMIT 10
    `).all();

        db.close();

        return NextResponse.json({
            nationalShare,
            cityShare,
            shareTrend,
            priceComparison,
            priceTrend,
            expansionEvents,
            chainDensity,
            battlegrounds,
        });
    } catch (error) {
        console.error('Error reading competition data:', error);
        return NextResponse.json({
            error: 'Failed to load competition data',
            details: String(error)
        }, { status: 500 });
    }
}
