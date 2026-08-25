import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: theatreId } = await params;
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
        }

        // Fetch all movie schedules for that date from schedules_v2
        // Sub-collection path: schedules_v2/{date}/movies
        const moviesRaw = await firestoreRestClient.getSubCollection(`schedules_v2/${date}/movies`);
        
        const showtimes: Record<string, unknown>[] = [];

        for (const movie of moviesRaw) {
            const metadataId = movie.id as string;
            const cities = (movie.cities as Record<string, unknown[]>) || {};
            
            for (const [cityName, theatres] of Object.entries(cities)) {
                if (!Array.isArray(theatres)) continue;
                
                for (const theatreItem of theatres) {
                    const theatre = theatreItem as Record<string, unknown>;
                    if (theatre.theatre_id === theatreId) {
                        const rooms = (theatre.rooms as Record<string, unknown>[]) || [];
                        for (const room of rooms) {
                            const roomShowtimes = (room.all_showtimes as Record<string, unknown>[]) || [];
                            for (const showtime of roomShowtimes) {
                                showtimes.push({
                                    ...showtime,
                                    metadata_id: metadataId,
                                    movie_title: movie.title as string,
                                    movie_poster: movie.poster as string,
                                    room_category: room.category,
                                    city: cityName,
                                    merchant: theatre.merchant,
                                    theatre_name: theatre.theatre_name,
                                    date
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort by showtime hour:minute
        showtimes.sort((a, b) => {
            const timeA = (a as Record<string, string>).showtime || '';
            const timeB = (b as Record<string, string>).showtime || '';
            return timeA.localeCompare(timeB);
        });

        return NextResponse.json(showtimes);
    } catch (error) {
        console.error(`Error fetching showtimes for theatre:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch showtimes' },
            { status: 500 }
        );
    }
}
