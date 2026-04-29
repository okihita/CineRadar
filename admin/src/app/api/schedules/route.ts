import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { ScheduleResponse, MovieSchedule, TheatreSchedule } from '@/features/schedules/types';
import { getTodayJakarta } from '@/lib/timeUtils';
import { normalizeMerchant } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date') || getTodayJakarta();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        // Collection path: schedules_v2/{date}/movies (v2 is the canonical source)
        const path = `schedules_v2/${date}/movies`;

        const moviesRaw = await firestoreRestClient.getSubCollection(path);

        // Normalize: schedules_v2 documents use Firestore document id as the identifier.
        // Map to MovieSchedule shape so consumers always see movie_id.
        // Merchants are derived from actual theatre data when the top-level field is missing.
        const movies: MovieSchedule[] = moviesRaw.map((doc) => {
            const cities = (doc.cities as MovieSchedule['cities']) || {};

            // Derive merchants from actual theatre data — always more accurate than the top-level field
            let merchants = (doc.merchants as string[]) || [];
            if (cities) {
                const chainSet = new Set<string>(merchants);
                for (const theatres of Object.values(cities)) {
                    for (const t of theatres as TheatreSchedule[]) {
                        const chain = normalizeMerchant(t.merchant);
                        if (chain) chainSet.add(chain);
                    }
                }
                merchants = Array.from(chainSet);
            }

            return {
                movie_id: doc.id as string,
                title: (doc.title as string) || '',
                poster: (doc.poster as string) || '',
                genres: (doc.genres as string[]) || [],
                age_category: (doc.age_category as string) || '',
                merchants,
                is_presale: (doc.is_presale as boolean) || false,
                date: (doc.date as string) || date,
                uploaded_at: (doc.uploaded_at as string) || '',
                cities,
            };
        });

        return NextResponse.json({
            success: true,
            date,
            count: movies.length,
            movies,
        } as ScheduleResponse);

    } catch (error) {
        console.error('Error fetching schedules:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
