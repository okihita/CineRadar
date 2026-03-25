import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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
        
        const showtimes: any[] = [];

        for (const movie of moviesRaw) {
            const metadataId = movie.id as string;
            const cities = (movie.cities as Record<string, any[]>) || {};
            
            for (const [cityName, theatres] of Object.entries(cities)) {
                if (!Array.isArray(theatres)) continue;
                
                for (const theatre of theatres) {
                    if (theatre.theatre_id === theatreId) {
                        const rooms = theatre.rooms || [];
                        for (const room of rooms) {
                            const roomShowtimes = room.all_showtimes || [];
                            for (const showtime of roomShowtimes) {
                                showtimes.push({
                                    ...showtime,
                                    metadata_id: metadataId,
                                    movie_title: movie.title,
                                    movie_poster: movie.poster,
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
        showtimes.sort((a, b) => (a.showtime || '').localeCompare(b.showtime || ''));

        return NextResponse.json(showtimes);
    } catch (error) {
        console.error(`Error fetching showtimes for theatre:`, error);
        return NextResponse.json(
            { error: 'Failed to fetch showtimes' },
            { status: 500 }
        );
    }
}
