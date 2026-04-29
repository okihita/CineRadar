import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { eachDayOfInterval, parseISO, format } from 'date-fns';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const moviesParam = searchParams.get('movies');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        if (!moviesParam) {
            return NextResponse.json({ success: false, error: 'Missing movies parameter' }, { status: 400 });
        }

        const movieIds = moviesParam.split(',').slice(0, 6); // max 6 movies
        
        let startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // Default last 7 days
        let endDate = new Date();

        if (startDateParam && endDateParam) {
            try {
                startDate = parseISO(startDateParam);
                endDate = parseISO(endDateParam);
            } catch {
                return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
            }
        }

        const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));

        // 1. Fetch Movie Metadata
        const metadataPromises = movieIds.map(async (id) => {
            const doc = await firestoreRestClient.getDocument('movies', id);
            return {
                id,
                title: doc?.name ? (doc.name as string) : (doc?.title as string) || `Movie ${id}`,
                poster: doc?.poster_path ? (doc.poster_path as string) : (doc?.poster as string) || ''
            };
        });
        const moviesMeta = await Promise.all(metadataPromises);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const moviesMap = moviesMeta.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {} as Record<string, any>);

        // 2. Fetch daily performance for each movie & each date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultsByDate: Record<string, Record<string, any>> = {};
        
        // Initialize results array with all dates
        dates.forEach(date => {
            resultsByDate[date] = { date };
        });

        const fetchPromises: Promise<void>[] = [];

        for (const movieId of movieIds) {
            for (const date of dates) {
                const fetchDaily = async () => {
                    const stats = await firestoreRestClient.getDocument(`movie_performance_v2/${movieId}/days`, date);
                    
                    if (!resultsByDate[date][movieId]) {
                        resultsByDate[date][movieId] = {
                            admissions: 0,
                            showtimes: 0,
                            occupancy: 0,
                            total_seats: 0
                        };
                    }

                    if (stats) {
                        resultsByDate[date][movieId] = {
                            admissions: (stats.total_sold as number) || 0,
                            showtimes: (stats.total_showtimes as number) || 0,
                            occupancy: (stats.avg_occupancy_pct as number) || 0,
                            total_seats: (stats.total_seats as number) || 0
                        };
                    } else {
                        // Fallback: Check if movie was scheduled on this day, might just have 0 sold
                        const schedule = await firestoreRestClient.getDocument(`schedules_v2/${date}/movies`, movieId);
                        if (schedule) {
                            let count = 0;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const citiesMap = (schedule.cities as Record<string, any[]>) || {};
                            Object.values(citiesMap).forEach((theatres) => {
                                theatres.forEach((theatre) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (theatre.rooms || []).forEach((room: any) => {
                                        count += (room.all_showtimes?.length || 0);
                                    });
                                });
                            });
                            resultsByDate[date][movieId].showtimes = count;
                        }
                    }
                };
                fetchPromises.push(fetchDaily());
            }
        }

        await Promise.all(fetchPromises);

        const chartData = dates.map(date => resultsByDate[date]);

        return NextResponse.json({
            success: true,
            movies: moviesMap,
            data: chartData,
            dates
        });

    } catch (error) {
        console.error('Error in /api/compare:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
