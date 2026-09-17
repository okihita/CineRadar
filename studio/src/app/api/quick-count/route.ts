import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { getTodayJakarta, isValidDateFormat } from '@/lib/timeUtils';
import { auth } from '@/auth';
import { normalizeMerchant } from '@/lib/constants';
import { StreamMovieItem, StreamSummaryMetrics, StreamCircuitBreakdown } from '@/features/stream/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TheatreRoom {
    all_showtimes?: unknown[];
}

interface TheatreEntry {
    theatre_id?: string;
    theatre_name?: string;
    name?: string;
    merchant?: string;
    rooms?: TheatreRoom[];
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const targetDate = dateParam && isValidDateFormat(dateParam) ? dateParam : getTodayJakarta();

        // 1. DISCOVERY: Only fetch movies screening TODAY (1 single collection call, ~2s)
        const scheduledMoviesRaw = await firestoreRestClient.getSubCollection(`schedules_v2/${targetDate}/movies`);

        // Check if date is Thursday (Day 4 in JS getDay)
        let isThursday = false;
        try {
            const d = new Date(`${targetDate}T00:00:00`);
            isThursday = d.getDay() === 4;
        } catch {
            isThursday = false;
        }

        if (!scheduledMoviesRaw || scheduledMoviesRaw.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    date: targetDate,
                    movies: [],
                    summary: {
                        date: targetDate,
                        totalShowtimes: 0,
                        totalEstimatedAdmissions: 0,
                        totalMonitoredSeats: 0,
                        nationalAvgOccupancyPct: 0,
                        activeMoviesCount: 0,
                        circuits: [],
                        lastSweptAt: null,
                    },
                },
            });
        }

        // 2. PARSE SCHEDULES: Extract accurate showtimes and circuit footprints
        interface PreparsedMovie {
            id: string;
            title: string;
            poster: string;
            genres?: string;
            ageCategory?: string;
            isPresale: boolean;
            showtimes: number;
            merchants: string[];
            citiesCount: number;
        }

        const preparsed: PreparsedMovie[] = [];
        let nationalShowtimes = 0;
        const circuitShowtimesMap: Record<string, { showtimes: number; theatres: Set<string> }> = {
            XXI: { showtimes: 0, theatres: new Set() },
            CGV: { showtimes: 0, theatres: new Set() },
            Cinépolis: { showtimes: 0, theatres: new Set() },
            FLIX: { showtimes: 0, theatres: new Set() },
        };

        for (const doc of scheduledMoviesRaw) {
            const id = String(doc.id);
            const title = (doc.title as string) || '';
            const poster = (doc.poster as string) || '';
            const genres = Array.isArray(doc.genres) ? doc.genres.join(', ') : undefined;
            const ageCategory = (doc.age_category as string) || undefined;
            const isPresale = Boolean(doc.is_presale);
            const cities = (doc.cities as Record<string, TheatreEntry[]>) || {};

            let movieShows = 0;
            const movieMerchants = new Set<string>();

            for (const theatres of Object.values(cities)) {
                for (const t of theatres) {
                    const normMerchant = normalizeMerchant(t.merchant);
                    if (normMerchant) {
                        movieMerchants.add(normMerchant);
                    }
                    const rooms = t.rooms || [];
                    for (const r of rooms) {
                        const showsCount = (r.all_showtimes || []).length;
                        movieShows += showsCount;
                        if (normMerchant && circuitShowtimesMap[normMerchant]) {
                            circuitShowtimesMap[normMerchant].showtimes += showsCount;
                            const theatreKey = t.theatre_id || t.theatre_name || t.name || 'theatre';
                            circuitShowtimesMap[normMerchant].theatres.add(theatreKey);
                        }
                    }
                }
            }

            if (movieShows > 0) {
                nationalShowtimes += movieShows;
                preparsed.push({
                    id,
                    title,
                    poster,
                    genres,
                    ageCategory,
                    isPresale,
                    showtimes: movieShows,
                    merchants: Array.from(movieMerchants),
                    citiesCount: Object.keys(cities).length,
                });
            }
        }

        // Sort by showtimes descending to prioritize primary theatrical titles
        preparsed.sort((a, b) => b.showtimes - a.showtimes);

        // 3. TARGETED ENRICHMENT: Only query performance stats for active movies screening today
        const enrichedMovies: StreamMovieItem[] = await Promise.all(
            preparsed.map(async (m) => {
                let sold = 0;
                let seats = 0;
                let avgOccupancyPct = 0;
                let lastSweptAt: string | undefined = undefined;

                try {
                    const perfDoc = await firestoreRestClient.getDocument<{
                        total_sold?: number;
                        total_seats?: number;
                        avg_occupancy_pct?: number;
                        last_swept_at?: string;
                    }>(`movie_performance_v2/${m.id}/days`, targetDate);

                    if (perfDoc) {
                        sold = perfDoc.total_sold || 0;
                        seats = perfDoc.total_seats || 0;
                        avgOccupancyPct = perfDoc.avg_occupancy_pct || (seats > 0 ? (sold / seats) * 100 : 0);
                        lastSweptAt = perfDoc.last_swept_at;
                    }
                } catch {
                    // Fallback to schedule-only data if performance document has not yet been swept
                }

                const sharePct = nationalShowtimes > 0 ? (m.showtimes / nationalShowtimes) * 100 : 0;

                return {
                    id: m.id,
                    rank: 0,
                    title: m.title,
                    poster: m.poster,
                    showtimes: m.showtimes,
                    showtimeSharePct: Number(sharePct.toFixed(1)),
                    estimatedAdmissions: sold,
                    totalSeats: seats,
                    avgOccupancyPct: Number(avgOccupancyPct.toFixed(1)),
                    merchants: m.merchants.length > 0 ? m.merchants : ['XXI'],
                    citiesCount: m.citiesCount,
                    genres: m.genres,
                    ageCategory: m.ageCategory,
                    isPremiere: isThursday && !m.isPresale,
                    lastSweptAt,
                };
            })
        );

        // Deterministic Sort: Admissions DESC -> Showtimes DESC -> Title ASC
        enrichedMovies.sort((a, b) => {
            if (b.estimatedAdmissions !== a.estimatedAdmissions) {
                return b.estimatedAdmissions - a.estimatedAdmissions;
            }
            if (b.showtimes !== a.showtimes) {
                return b.showtimes - a.showtimes;
            }
            return a.title.localeCompare(b.title);
        });

        // Assign Ranks
        enrichedMovies.forEach((m, idx) => {
            m.rank = idx + 1;
        });

        // National summary rollups
        let totalNationalSold = 0;
        let totalNationalSeats = 0;
        const sweepTimestamps: string[] = [];

        enrichedMovies.forEach((m) => {
            totalNationalSold += m.estimatedAdmissions;
            totalNationalSeats += m.totalSeats;
            if (m.lastSweptAt) sweepTimestamps.push(m.lastSweptAt);
        });

        const circuits: StreamCircuitBreakdown[] = (['XXI', 'CGV', 'Cinépolis', 'FLIX'] as const).map((chain) => {
            const entry = circuitShowtimesMap[chain];
            const sharePct = nationalShowtimes > 0 ? (entry.showtimes / nationalShowtimes) * 100 : 0;
            return {
                name: chain,
                showtimes: entry.showtimes,
                theatres: entry.theatres.size,
                sharePct: Number(sharePct.toFixed(1)),
            };
        });

        const nationalAvgOccupancy = totalNationalSeats > 0 ? (totalNationalSold / totalNationalSeats) * 100 : 0;

        const summary: StreamSummaryMetrics = {
            date: targetDate,
            totalShowtimes: nationalShowtimes,
            totalEstimatedAdmissions: totalNationalSold,
            totalMonitoredSeats: totalNationalSeats,
            nationalAvgOccupancyPct: Number(nationalAvgOccupancy.toFixed(1)),
            activeMoviesCount: enrichedMovies.length,
            circuits,
            lastSweptAt: sweepTimestamps.length > 0 ? sweepTimestamps.sort().reverse()[0] : null,
        };

        return NextResponse.json({
            success: true,
            data: {
                date: targetDate,
                movies: enrichedMovies,
                summary,
            },
        });
    } catch (error) {
        console.error('Error in /api/quick-count:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
