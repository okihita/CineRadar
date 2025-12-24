
import { NextResponse } from 'next/server';
import { firestoreAdminClient } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

        // 1. Fetch seat snapshots for today
        // Note: In a real scenario, we might want to query by date
        // For now, we fetch recent snapshots and filter
        const snapshots = await firestoreAdminClient.getCollectionWithQuery('seat_snapshots', 'scraped_at', 500);

        // 2. Group by hour (e.g., "12:00", "13:00")
        const grouped: Record<string, any[]> = {};

        snapshots.forEach((snap: any) => {
            const time = snap.showtime || 'Unknown';
            // Extract hour from HH:MM format
            const hour = time !== 'Unknown' ? time.split(':')[0] + ':00' : 'Unknown';

            if (!grouped[hour]) grouped[hour] = [];
            grouped[hour].push({
                showtime_id: snap.showtime_id,
                time: time, // Keep original time for display
                movie: snap.movie_title,
                theatre: snap.theatre_name,
                status: 'success',
                occupancy: snap.occupancy_pct,
                layout: snap.layout
            });
        });

        // 3. Sort times
        const sortedTimes = Object.keys(grouped).sort();
        const result = sortedTimes.map(time => ({
            time,
            count: grouped[time].length,
            items: grouped[time]
        }));

        return NextResponse.json({
            date: today,
            timeline: result
        });
    } catch (error) {
        console.error('Error fetching JIT monitor data:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
