import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });

        // Genre performance by region
        const genreByRegion = db.prepare(`
      SELECT genre, region,
             ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy,
             SUM(revenue) as revenue,
             SUM(showtime_count) as showtimes
      FROM genre_trends
      WHERE month = (SELECT MAX(month) FROM genre_trends)
      GROUP BY genre, region
      ORDER BY genre, avg_occupancy DESC
    `).all();

        // Top genres nationally
        const topGenres = db.prepare(`
      SELECT genre,
             ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy,
             SUM(revenue) as revenue
      FROM genre_trends
      WHERE month = (SELECT MAX(month) FROM genre_trends)
      GROUP BY genre
      ORDER BY avg_occupancy DESC
    `).all();

        // Seasonal patterns (genre performance by month)
        const seasonalTrend = db.prepare(`
      SELECT genre, month, ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy
      FROM genre_trends
      GROUP BY genre, month
      ORDER BY month, genre
    `).all();

        // Social sentiment (current movies)
        const socialSentiment = db.prepare(`
      SELECT m.title, m.genre,
             AVG(ss.twitter_mentions) as avg_mentions,
             ROUND(AVG(ss.sentiment_score), 2) as sentiment,
             MIN(ss.trending_rank) as best_rank
      FROM social_sentiment ss
      JOIN movies m ON ss.movie_id = m.movie_id
      WHERE ss.date >= date('now', '-7 days')
      GROUP BY m.movie_id
      ORDER BY avg_mentions DESC
    `).all();

        // Sentiment trend (last 30 days for top movies)
        const sentimentTrend = db.prepare(`
      SELECT m.title, ss.date, ss.twitter_mentions, ss.sentiment_score
      FROM social_sentiment ss
      JOIN movies m ON ss.movie_id = m.movie_id
      WHERE m.popularity > 0.7
      ORDER BY ss.date, m.title
    `).all();

        // Regional preferences (which genre overperforms where)
        const regionalPrefs = db.prepare(`
      SELECT region, genre,
             ROUND(AVG(avg_occupancy) * 100, 1) as occupancy,
             ROUND(AVG(avg_occupancy) * 100 - 
               (SELECT AVG(gt2.avg_occupancy) * 100 FROM genre_trends gt2 WHERE gt2.genre = genre_trends.genre), 1
             ) as vs_national
      FROM genre_trends
      WHERE month = (SELECT MAX(month) FROM genre_trends)
      GROUP BY region, genre
      HAVING vs_national > 5
      ORDER BY vs_national DESC
      LIMIT 15
    `).all();

        // Opening weekend predictions (based on social buzz)
        const predictions = db.prepare(`
      SELECT m.title, m.genre, m.popularity,
             ROUND(AVG(ss.sentiment_score) * AVG(ss.twitter_mentions) / 1000, 1) as hype_score,
             CASE 
               WHEN AVG(ss.sentiment_score) > 0.7 AND AVG(ss.twitter_mentions) > 3000 THEN 'High'
               WHEN AVG(ss.sentiment_score) > 0.5 AND AVG(ss.twitter_mentions) > 1500 THEN 'Medium'
               ELSE 'Low'
             END as predicted_performance
      FROM movies m
      JOIN social_sentiment ss ON m.movie_id = ss.movie_id
      WHERE ss.date >= date('now', '-7 days')
      GROUP BY m.movie_id
      ORDER BY hype_score DESC
    `).all();

        db.close();

        return NextResponse.json({
            genreByRegion,
            topGenres,
            seasonalTrend,
            socialSentiment,
            sentimentTrend,
            regionalPrefs,
            predictions,
        });
    } catch (error) {
        console.error('Error reading trend data:', error);
        return NextResponse.json({
            error: 'Failed to load trend data',
            details: String(error)
        }, { status: 500 });
    }
}
