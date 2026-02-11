/**
 * Executive Dashboard API
 * Aggregates data from multiple collections for the admin homepage
 *
 * GET /api/executive-dashboard
 *   → System health, business KPIs, market performance, and actionable alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

interface ScraperLog {
    date: string;
    created_at?: string;
    morning_run?: {
        status?: string;
        end_time?: string;
        movies_found?: number;
        theatres_total?: number;
        cities_covered?: number;
    };
    jit_runs?: Record<string, {
        showtimes_found?: number;
        jobs_published?: number;
        status?: string;
    }>;
    daily_summary?: {
        generated_at?: string;
        total_audience?: number;
        total_seats?: number;
        occupancy_pct?: number;
        showtime_count?: number;
        movie_count?: number;
        theatre_count?: number;
        city_count?: number;
    };
}

interface MovieDailyStats {
    date: string;
    total_showtimes: number;
    total_showtimes_scraped: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

export async function GET(request: NextRequest) {
    try {
        const today = getTodayJakarta();
        const { searchParams } = new URL(request.url);
        const dateOverride = searchParams.get('date');
        const effectiveDate = dateOverride || today;

        // Parallel fetch: scraper logs, theatres, and movie performance
        const [scraperLogDoc, theatres, movies] = await Promise.all([
            firestoreRestClient.getDocument('scraper_logs', effectiveDate),
            firestoreRestClient.getCollection('theatres'),
            firestoreRestClient.getCollection('movie_performance'),
        ]);

        let scraperLog: ScraperLog | null = (scraperLogDoc as unknown as ScraperLog) || null;

        // If no scraper log for today, try yesterday
        let fallbackDate = null;
        if (!scraperLog) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            fallbackDate = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
            const yesterdayDoc = await firestoreRestClient.getDocument('scraper_logs', fallbackDate);
            if (yesterdayDoc) {
                scraperLog = yesterdayDoc as unknown as ScraperLog;
            }
        }

        // Get today's stats for movies
        const moviesWithStats: Array<Record<string, unknown> & { today?: MovieDailyStats }> = [];
        const BATCH_SIZE = 10;

        for (let i = 0; i < movies.length; i += BATCH_SIZE) {
            const batch = movies.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (movie: Record<string, unknown>) => {
                    try {
                        const days = await firestoreRestClient.getSubCollection(
                            `movie_performance/${movie.movie_id}/days`
                        );

                        // Sort by date and get the most recent day that has actual data
                        const sortedDays = (days as unknown as MovieDailyStats[])
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const mostRecentDay = sortedDays.find((d) => d.total_showtimes_scraped > 0);

                        return {
                            ...movie,
                            today: mostRecentDay ? {
                                date: mostRecentDay.date,
                                total_showtimes: mostRecentDay.total_showtimes || 0,
                                total_showtimes_scraped: mostRecentDay.total_showtimes_scraped || 0,
                                avg_occupancy_pct: mostRecentDay.avg_occupancy_pct || 0,
                                total_seats: mostRecentDay.total_seats || 0,
                                total_sold: mostRecentDay.total_sold || 0,
                                cities: mostRecentDay.cities || [],
                            } : undefined,
                        };
                    } catch {
                        return movie;
                    }
                })
            );
            moviesWithStats.push(...results);
        }

        // Extract data from scraper log
        const dailySummary = scraperLog?.daily_summary;
        const morningRun = scraperLog?.morning_run;
        const jitRuns = scraperLog?.jit_runs;

        // Calculate JIT summary
        const jitEntries = jitRuns ? Object.entries(jitRuns) : [];
        const jitSummary = jitEntries.length > 0 ? {
            totalRuns: jitEntries.length,
            totalShowtimesFound: jitEntries.reduce((sum, [, entry]) => sum + (entry.showtimes_found || 0), 0),
            totalJobsPublished: jitEntries.reduce((sum, [, entry]) => sum + (entry.jobs_published || 0), 0),
            errorCount: jitEntries.filter(([, entry]) => entry.status === 'error').length,
            lastDispatch: jitEntries.sort(([a], [b]) => b.localeCompare(a))[0]?.[0],
        } : {
            totalRuns: 0,
            totalShowtimesFound: 0,
            totalJobsPublished: 0,
            errorCount: 0,
            lastDispatch: null,
        };

        // Get top movies by occupancy (use latest available date if no today data)
        const topMovies = moviesWithStats
            .filter(m => m.today && (m.today as MovieDailyStats).total_showtimes_scraped > 0)
            .sort((a, b) => (b.today as MovieDailyStats).avg_occupancy_pct - (a.today as MovieDailyStats).avg_occupancy_pct)
            .slice(0, 5)
            .map(m => ({
                title: m.title as string,
                genre: 'N/A', // Not available in current schema
                occupancy: Math.round((m.today as MovieDailyStats).avg_occupancy_pct),
                revenue: (m.today as MovieDailyStats).total_sold * 40000, // Avg ticket price estimate
            }));

        // Get cities list for theatre count
        const citiesList = [...new Set(theatres.map((t: Record<string, unknown>) => t.city as string))].sort();

        // Get top theatres (mock for now, would need to aggregate from movie_performance)
        const topTheatres: Array<{ name: string; chain: string; revenue: number; occupancy: number }> = [
            { name: 'Grand Indonesia XXI', chain: 'XXI', revenue: 890000000, occupancy: 78 },
            { name: 'Plaza Senayan XXI', chain: 'XXI', revenue: 720000000, occupancy: 72 },
            { name: 'CGV Grand Indonesia', chain: 'CGV', revenue: 680000000, occupancy: 70 },
            { name: 'Cinépolis Lippo Mall Puri', chain: 'Cinépolis', revenue: 540000000, occupancy: 68 },
            { name: 'XXI Pakuwon Mall', chain: 'XXI', revenue: 480000000, occupancy: 65 },
        ];

        // Get city performance (calculate from movie performance data)
        const cityPerformanceMap = new Map<string, { occupancySum: number; count: number; revenueSum: number }>();
        moviesWithStats.forEach(m => {
            if (m.today && m.today.cities) {
                m.today.cities.forEach((city: string) => {
                    const existing = cityPerformanceMap.get(city) || { occupancySum: 0, count: 0, revenueSum: 0 };
                    cityPerformanceMap.set(city, {
                        occupancySum: existing.occupancySum + m.today!.avg_occupancy_pct,
                        count: existing.count + 1,
                        revenueSum: existing.revenueSum + (m.today!.total_sold * 40000),
                    });
                });
            }
        });

        const cityPerformance: Array<{ name: string; region: string; occupancy: number; revenue: number }> = Array
            .from(cityPerformanceMap.entries())
            .map(([city, data]) => ({
                name: city,
                region: ['JAKARTA', 'SURABAYA', 'BANDUNG', 'SEMARANG', 'YOGYAKARTA'].includes(city) ? 'Java' : 'Other',
                occupancy: Math.round(data.occupancySum / data.count) || 0,
                revenue: data.revenueSum,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Calculate KPIs
        const totalAudience = dailySummary?.total_audience || 0;
        const avgOccupancy = dailySummary?.occupancy_pct || 0;
        const totalTickets = totalAudience;

        // Calculate total audience and avg occupancy from movie performance if daily summary is empty
        let totalTicketsAlt = 0;
        let totalOccupancySum = 0;
        let moviesWithDataCount = 0;

        if (totalAudience === 0) {
            moviesWithStats.forEach(m => {
                if (m.today) {
                    totalTicketsAlt += m.today.total_sold || 0;
                    totalOccupancySum += m.today.avg_occupancy_pct || 0;
                    moviesWithDataCount++;
                }
            });
        }
        const finalTotalTickets = totalTicketsAlt > 0 ? totalTicketsAlt : totalTickets;
        const finalRevenue = finalTotalTickets * 40000;
        const finalAvgOccupancy = totalAudience === 0 && moviesWithDataCount > 0
            ? totalOccupancySum / moviesWithDataCount
            : avgOccupancy;

        // Generate alerts
        const alerts: Array<{ type: string; title: string; subtitle?: string; action: string; link: string }> = [];

        // Scraper status alerts
        if (morningRun?.status === 'error' || !morningRun) {
            alerts.push({
                type: 'danger',
                title: 'Morning scrape failed or not run today',
                subtitle: fallbackDate ? `Using data from ${fallbackDate}` : 'No data available',
                action: 'View Scraper',
                link: '/scraper',
            });
        }

        // Low occupancy movies
        const lowOccupancyMovies = moviesWithStats
            .filter(m => m.today && m.today.avg_occupancy_pct < 40 && m.today.total_showtimes_scraped > 0)
            .slice(0, 3);

        if (lowOccupancyMovies.length > 0) {
            alerts.push({
                type: 'warning',
                title: `${lowOccupancyMovies.length} movies below 40% occupancy`,
                subtitle: lowOccupancyMovies.map(m => m.title).join(', '),
                action: 'View Details',
                link: '/performances',
            });
        }

        // JIT errors
        if (jitSummary.errorCount > 0) {
            alerts.push({
                type: 'warning',
                title: `${jitSummary.errorCount} JIT scrape failures detected`,
                subtitle: 'Check scraper monitor for details',
                action: 'View Scraper',
                link: '/scraper',
            });
        }

        // Success alert if all good
        if (alerts.length === 0 && morningRun?.status === 'success') {
            alerts.push({
                type: 'success',
                title: 'All systems operational',
                subtitle: `${dailySummary?.movie_count || moviesWithStats.length} movies tracked`,
                action: 'View Details',
                link: '/performances',
            });
        }

        // Generate timeline (mock based on occupancy)
        const hour = new Date().getHours();
        const timeline = [
            { hour: '10:00', occupancy: 32, status: 'slow', note: 'Morning slow' },
            { hour: '12:00', occupancy: 45, status: 'normal', note: 'Lunch pickup' },
            { hour: '14:00', occupancy: 48, status: 'normal', note: 'Afternoon steady' },
            { hour: '16:00', occupancy: 55, status: 'normal', note: 'Building up' },
            { hour: '18:00', occupancy: 72, status: 'peak', note: 'Prime time starts' },
            { hour: '19:00', occupancy: 85, status: 'peak', note: 'Peak performance' },
            { hour: '20:00', occupancy: 78, status: 'peak', note: 'Strong momentum' },
            { hour: '21:00', occupancy: 65, status: 'normal', note: 'Late shows' },
        ].map(t => ({
            ...t,
            current: t.hour.startsWith(`${String(hour).padStart(2, '0')}:`) ||
                (hour >= 19 && hour <= 21 && ['19:00', '20:00', '21:00'].includes(t.hour)),
        }));

        // AI insight
        const aiInsight = {
            type: 'revenue',
            text: finalAvgOccupancy < 50
                ? `Overall occupancy is ${Math.round(finalAvgOccupancy)}%. Consider targeted promotions for underperforming cities.`
                : `Strong performance at ${Math.round(finalAvgOccupancy)}% occupancy. Consider expanding screens for top-performing movies.`,
        };

        return NextResponse.json({
            greeting: getGreeting(),
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            timestamp: new Date().toISOString(),
            dataDate: fallbackDate || effectiveDate,
            usingFallback: !!fallbackDate,
            kpis: {
                revenue: { value: finalRevenue, delta: 'N/A' },
                tickets: { value: finalTotalTickets, delta: 'N/A' },
                occupancy: { value: Math.round(finalAvgOccupancy), delta: 'N/A' },
                topTheatre: topTheatres[0]?.name || 'N/A',
            },
            alerts,
            timeline,
            hotMovies: topMovies,
            topTheatres,
            cityPerformance,
            aiInsight,
            systemHealth: {
                morningScrapeStatus: morningRun?.status || 'not_run',
                jitTotalRuns: jitSummary.totalRuns,
                jitLastRun: jitSummary.lastDispatch,
                theatreCount: dailySummary?.theatre_count || theatres.length,
                cityCount: dailySummary?.city_count || citiesList.length,
                movieCount: dailySummary?.movie_count || movies.length,
            },
        });
    } catch (error) {
        console.error('Error fetching executive dashboard data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch executive dashboard data', details: String(error) },
            { status: 500 }
        );
    }
}
