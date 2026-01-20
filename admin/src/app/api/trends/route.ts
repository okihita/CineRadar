import { NextResponse } from 'next/server';

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
    return NextResponse.json(getMockData());
}
