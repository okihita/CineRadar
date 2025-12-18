import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

function getMockData() {
    return {
        genreByRegion: [
            { genre: 'Horror', region: 'Java', avg_occupancy: 78.5, revenue: 25000000000, showtimes: 3500 },
            { genre: 'Horror', region: 'Sumatra', avg_occupancy: 72.3, revenue: 8500000000, showtimes: 1200 },
            { genre: 'Comedy', region: 'Java', avg_occupancy: 75.2, revenue: 22000000000, showtimes: 3200 },
            { genre: 'Action', region: 'Java', avg_occupancy: 68.5, revenue: 18000000000, showtimes: 2800 },
        ],
        topGenres: [
            { genre: 'Horror', avg_occupancy: 76.5, revenue: 35000000000 },
            { genre: 'Comedy', avg_occupancy: 72.3, revenue: 28000000000 },
            { genre: 'Action', avg_occupancy: 65.8, revenue: 22000000000 },
            { genre: 'Romance', avg_occupancy: 58.2, revenue: 12000000000 },
            { genre: 'Drama', avg_occupancy: 52.5, revenue: 8000000000 },
        ],
        seasonalTrend: [
            { genre: 'Horror', month: '2024-10', avg_occupancy: 82.5 },
            { genre: 'Horror', month: '2024-11', avg_occupancy: 78.2 },
            { genre: 'Horror', month: '2024-12', avg_occupancy: 76.5 },
            { genre: 'Comedy', month: '2024-10', avg_occupancy: 68.5 },
            { genre: 'Comedy', month: '2024-12', avg_occupancy: 75.2 },
        ],
        socialSentiment: [
            { title: 'SIKSA NERAKA', genre: 'Horror', avg_mentions: 8500, sentiment: 0.82, best_rank: 1 },
            { title: 'AGAK LAEN 2', genre: 'Comedy', avg_mentions: 6200, sentiment: 0.78, best_rank: 2 },
            { title: 'AVATAR 3', genre: 'Sci-Fi', avg_mentions: 5800, sentiment: 0.85, best_rank: 3 },
        ],
        sentimentTrend: [
            { title: 'SIKSA NERAKA', date: '2024-12-15', twitter_mentions: 8200, sentiment_score: 0.81 },
            { title: 'SIKSA NERAKA', date: '2024-12-16', twitter_mentions: 8800, sentiment_score: 0.83 },
            { title: 'SIKSA NERAKA', date: '2024-12-17', twitter_mentions: 8500, sentiment_score: 0.82 },
        ],
        regionalPrefs: [
            { region: 'Java', genre: 'Horror', occupancy: 78.5, vs_national: 8.2 },
            { region: 'Sumatra', genre: 'Comedy', occupancy: 75.8, vs_national: 6.5 },
            { region: 'Sulawesi', genre: 'Action', occupancy: 72.3, vs_national: 5.8 },
        ],
        predictions: [
            { title: 'SIKSA NERAKA', genre: 'Horror', popularity: 0.92, hype_score: 8.5, predicted_performance: 'High' },
            { title: 'AGAK LAEN 2', genre: 'Comedy', popularity: 0.85, hype_score: 6.2, predicted_performance: 'High' },
            { title: 'AVATAR 3', genre: 'Sci-Fi', popularity: 0.88, hype_score: 5.8, predicted_performance: 'Medium' },
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

        const genreByRegion = db.prepare(`SELECT genre, region, ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy, SUM(revenue) as revenue, SUM(showtime_count) as showtimes FROM genre_trends WHERE month = (SELECT MAX(month) FROM genre_trends) GROUP BY genre, region ORDER BY genre, avg_occupancy DESC`).all();
        const topGenres = db.prepare(`SELECT genre, ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy, SUM(revenue) as revenue FROM genre_trends WHERE month = (SELECT MAX(month) FROM genre_trends) GROUP BY genre ORDER BY avg_occupancy DESC`).all();
        const seasonalTrend = db.prepare(`SELECT genre, month, ROUND(AVG(avg_occupancy) * 100, 1) as avg_occupancy FROM genre_trends GROUP BY genre, month ORDER BY month, genre`).all();
        const socialSentiment = db.prepare(`SELECT m.title, m.genre, AVG(ss.twitter_mentions) as avg_mentions, ROUND(AVG(ss.sentiment_score), 2) as sentiment, MIN(ss.trending_rank) as best_rank FROM social_sentiment ss JOIN movies m ON ss.movie_id = m.movie_id WHERE ss.date >= date('now', '-7 days') GROUP BY m.movie_id ORDER BY avg_mentions DESC`).all();
        const sentimentTrend = db.prepare(`SELECT m.title, ss.date, ss.twitter_mentions, ss.sentiment_score FROM social_sentiment ss JOIN movies m ON ss.movie_id = m.movie_id WHERE m.popularity > 0.7 ORDER BY ss.date, m.title`).all();
        const regionalPrefs = db.prepare(`SELECT region, genre, ROUND(AVG(avg_occupancy) * 100, 1) as occupancy, ROUND(AVG(avg_occupancy) * 100 - (SELECT AVG(gt2.avg_occupancy) * 100 FROM genre_trends gt2 WHERE gt2.genre = genre_trends.genre), 1) as vs_national FROM genre_trends WHERE month = (SELECT MAX(month) FROM genre_trends) GROUP BY region, genre HAVING vs_national > 5 ORDER BY vs_national DESC LIMIT 15`).all();
        const predictions = db.prepare(`SELECT m.title, m.genre, m.popularity, ROUND(AVG(ss.sentiment_score) * AVG(ss.twitter_mentions) / 1000, 1) as hype_score, CASE WHEN AVG(ss.sentiment_score) > 0.7 AND AVG(ss.twitter_mentions) > 3000 THEN 'High' WHEN AVG(ss.sentiment_score) > 0.5 AND AVG(ss.twitter_mentions) > 1500 THEN 'Medium' ELSE 'Low' END as predicted_performance FROM movies m JOIN social_sentiment ss ON m.movie_id = ss.movie_id WHERE ss.date >= date('now', '-7 days') GROUP BY m.movie_id ORDER BY hype_score DESC`).all();

        db.close();
        return NextResponse.json({ genreByRegion, topGenres, seasonalTrend, socialSentiment, sentimentTrend, regionalPrefs, predictions });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
