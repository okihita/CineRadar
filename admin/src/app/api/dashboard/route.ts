import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'backend', 'mock_cineradar.db');

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

export async function GET() {
    try {
        const db = new Database(DB_PATH, { readonly: true });
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // KPIs - Today vs Yesterday
        const todayStats = db.prepare(`
      SELECT 
        COALESCE(SUM(r.total_revenue), 0) as revenue,
        COALESCE(SUM(r.tickets_sold), 0) as tickets,
        COALESCE(AVG(o.occupancy_pct) * 100, 0) as occupancy
      FROM revenue_daily r
      LEFT JOIN showtimes s ON r.theatre_id = s.theatre_id AND r.date = s.show_date
      LEFT JOIN occupancy o ON s.showtime_id = o.showtime_id
      WHERE r.date = (SELECT MAX(date) FROM revenue_daily)
    `).get() as { revenue: number; tickets: number; occupancy: number };

        const yesterdayStats = db.prepare(`
      SELECT 
        COALESCE(SUM(r.total_revenue), 0) as revenue,
        COALESCE(SUM(r.tickets_sold), 0) as tickets
      FROM revenue_daily r
      WHERE r.date = (SELECT MAX(date) FROM revenue_daily WHERE date < (SELECT MAX(date) FROM revenue_daily))
    `).get() as { revenue: number; tickets: number };

        // Top theatre today
        const topTheatre = db.prepare(`
      SELECT t.name, SUM(r.total_revenue) as revenue
      FROM revenue_daily r
      JOIN theatres t ON r.theatre_id = t.theatre_id
      WHERE r.date = (SELECT MAX(date) FROM revenue_daily)
      GROUP BY r.theatre_id
      ORDER BY revenue DESC
      LIMIT 1
    `).get() as { name: string; revenue: number } | undefined;

        // Alerts - Low occupancy theatres
        const lowOccupancy = db.prepare(`
      SELECT COUNT(DISTINCT t.theatre_id) as count
      FROM showtimes s
      JOIN theatres t ON s.theatre_id = t.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      WHERE o.occupancy_pct < 0.3
    `).get() as { count: number };

        // What's hot - Movies ranked by occupancy
        const hotMovies = db.prepare(`
      SELECT m.title, m.genre,
             ROUND(AVG(o.occupancy_pct) * 100, 0) as occupancy,
             SUM(r.ticket_revenue) as revenue
      FROM movies m
      JOIN showtimes s ON m.movie_id = s.movie_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      LEFT JOIN revenue_daily r ON s.theatre_id = r.theatre_id
      GROUP BY m.movie_id
      ORDER BY occupancy DESC
      LIMIT 5
    `).all();

        // Hourly timeline (simulated)
        const timeline = [
            { hour: '10:00', occupancy: 32, status: 'slow', note: 'Morning slow' },
            { hour: '12:00', occupancy: 45, status: 'normal', note: 'Lunch pickup' },
            { hour: '14:00', occupancy: 48, status: 'normal', note: 'Afternoon steady' },
            { hour: '16:00', occupancy: 55, status: 'normal', note: 'Building up' },
            { hour: '18:00', occupancy: 72, status: 'peak', note: 'Prime time starts' },
            { hour: '19:00', occupancy: 85, status: 'peak', note: 'Peak performance' },
            { hour: '20:00', occupancy: 78, status: 'peak', note: 'Strong momentum' },
            { hour: '21:00', occupancy: 65, status: 'normal', note: 'Late shows' },
        ];

        // Mark current hour
        const currentHour = new Date().getHours();
        const currentIdx = timeline.findIndex(t => parseInt(t.hour) >= currentHour);

        // Top 5 theatres for spark chart
        const topTheatres = db.prepare(`
      SELECT t.name, t.chain, SUM(r.total_revenue) as revenue,
             ROUND(AVG(o.occupancy_pct) * 100, 0) as occupancy
      FROM theatres t
      JOIN revenue_daily r ON t.theatre_id = r.theatre_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY t.theatre_id
      ORDER BY revenue DESC
      LIMIT 5
    `).all();

        // City performance (for mini heatmap)
        const cityPerformance = db.prepare(`
      SELECT c.name, c.region,
             ROUND(AVG(o.occupancy_pct) * 100, 0) as occupancy,
             SUM(r.total_revenue) as revenue
      FROM cities c
      JOIN theatres t ON c.city_id = t.city_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      JOIN revenue_daily r ON t.theatre_id = r.theatre_id
      GROUP BY c.city_id
      ORDER BY revenue DESC
    `).all();

        // Underperforming cities for alerts
        const underperformingCities = db.prepare(`
      SELECT c.name, ROUND(AVG(o.occupancy_pct) * 100, 0) as occupancy
      FROM cities c
      JOIN theatres t ON c.city_id = t.city_id
      JOIN showtimes s ON t.theatre_id = s.theatre_id
      JOIN occupancy o ON s.showtime_id = o.showtime_id
      GROUP BY c.city_id
      HAVING occupancy < 50
      ORDER BY occupancy ASC
      LIMIT 3
    `).all() as Array<{ name: string; occupancy: number }>;

        // Generate AI insight
        const insights = [
            { type: 'revenue', text: 'Morning shows (10-12) have 40% lower occupancy. Consider "Early Bird" pricing at Rp35K to boost attendance.' },
            { type: 'movie', text: 'SIKSA NERAKA is underperforming at 35% occupancy. Push targeted promo to horror fans in East Java.' },
            { type: 'competition', text: 'CGV is gaining market share in Surabaya (+5% this month). Consider promotional response.' },
            { type: 'trend', text: 'Weekend occupancy is 45% higher than weekdays. Optimize staff scheduling accordingly.' },
        ];
        const todayInsight = insights[new Date().getDay() % insights.length];

        db.close();

        // Calculate deltas
        const revenueDelta = yesterdayStats.revenue > 0
            ? ((todayStats.revenue - yesterdayStats.revenue) / yesterdayStats.revenue * 100).toFixed(1)
            : '0';
        const ticketsDelta = yesterdayStats.tickets > 0
            ? ((todayStats.tickets - yesterdayStats.tickets) / yesterdayStats.tickets * 100).toFixed(1)
            : '0';

        return NextResponse.json({
            greeting: getGreeting(),
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            timestamp: new Date().toISOString(),

            kpis: {
                revenue: { value: todayStats.revenue, delta: revenueDelta },
                tickets: { value: todayStats.tickets, delta: ticketsDelta },
                occupancy: { value: Math.round(todayStats.occupancy), delta: '+5' },
                topTheatre: topTheatre?.name || 'N/A',
            },

            alerts: [
                { type: 'warning', title: `${lowOccupancy.count} showtimes below 30% occupancy`, action: 'Push Flash Sale', link: '/audience' },
                { type: 'success', title: 'AVATAR premiere tomorrow', subtitle: '85% pre-sold', action: 'View Details', link: '/movies' },
                ...underperformingCities.map(c => ({
                    type: 'danger' as const,
                    title: `${c.name} underperforming`,
                    subtitle: `${c.occupancy}% avg occupancy`,
                    action: 'View Details',
                    link: '/location',
                })),
            ].slice(0, 4),

            timeline: timeline.map((t, i) => ({ ...t, current: i === currentIdx })),

            hotMovies,
            topTheatres,
            cityPerformance,

            aiInsight: todayInsight,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
    }
}
