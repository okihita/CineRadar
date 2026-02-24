import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface RawShowtimeResponse {
    showtimeId: string;
    movieTitle: string;
    theatreName: string;
    city: string;
    roomCategory: string;
    merchant: string;
    showtime: string;
    date: string;
    occupancyPct: number;
    totalSeats: number;
    soldSeats: number;
    scrapedAt: string;
    rawApiResponse: object | null;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ showtimeId: string }> }
) {
    const { showtimeId } = await params;
    const { searchParams } = new URL(request.url);

    const movieId = searchParams.get('movieId');
    const date = searchParams.get('date');

    if (!movieId || !date) {
        return NextResponse.json(
            { error: 'movieId and date query parameters required' },
            { status: 400 }
        );
    }

    try {
        const doc = await firestoreRestClient.getDocument(
            `movie_performance/${movieId}/days/${date}/showtimes`,
            showtimeId
        );

        if (!doc) {
            return NextResponse.json(
                { error: 'Showtime not found' },
                { status: 404 }
            );
        }

        const data = doc as Record<string, unknown>;

        const response: RawShowtimeResponse = {
            showtimeId: String(data.showtime_id),
            movieTitle: String(data.movie_title),
            theatreName: String(data.theatre_name),
            city: String(data.city),
            roomCategory: String(data.room_category),
            merchant: String(data.merchant),
            showtime: String(data.showtime),
            date: String(data.date),
            occupancyPct: Number(data.occupancy_pct),
            totalSeats: Number(data.total_seats),
            soldSeats: Number(data.sold_seats),
            scrapedAt: String(data.scraped_at),
            rawApiResponse: (data.raw_api_response as object | null) || null,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching showtime raw data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch showtime data' },
            { status: 500 }
        );
    }
}
