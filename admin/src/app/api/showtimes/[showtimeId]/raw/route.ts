import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';

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
    { params }: { params: { showtimeId: string } }
) {
    const { showtimeId } = params;
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
        const doc = await firestore
            .collection('movie_performance')
            .doc(movieId)
            .collection('days')
            .doc(date)
            .collection('showtimes')
            .doc(showtimeId)
            .get();

        if (!doc.exists) {
            return NextResponse.json(
                { error: 'Showtime not found' },
                { status: 404 }
            );
        }

        const data = doc.data() as any;

        const response: RawShowtimeResponse = {
            showtimeId: data.showtime_id,
            movieTitle: data.movie_title,
            theatreName: data.theatre_name,
            city: data.city,
            roomCategory: data.room_category,
            merchant: data.merchant,
            showtime: data.showtime,
            date: data.date,
            occupancyPct: data.occupancy_pct,
            totalSeats: data.total_seats,
            soldSeats: data.sold_seats,
            scrapedAt: data.scraped_at,
            rawApiResponse: data.raw_api_response || null,
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
