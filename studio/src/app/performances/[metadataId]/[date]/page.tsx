import { DailyPerformanceDetail } from '@/features/performances';
import { firestoreRestClient } from "@/lib/firestore-rest";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
    params: Promise<{ metadataId: string; date: string }>;
};

interface MovieMeta {
    title?: string;
    poster?: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { metadataId, date } = await params;

    const movieMeta = await firestoreRestClient.getDocument<MovieMeta>("movies", metadataId);
    const title = movieMeta?.title || 'Movie Performance';
    const poster = movieMeta?.poster;

    return {
        title: `${title} - ${date} | CineRadar Admin`,
        description: `Daily performance analysis for ${title} on ${date}.`,
        openGraph: {
            title: `${title} (${date})`,
            images: poster ? [poster] : ['/opengraph-image'],
        },
    };
}

export default async function DailyPerformancePage({
    params,
}: {
    params: Promise<{ metadataId: string; date: string }>;
}) {
    const { metadataId, date } = await params;
    return <DailyPerformanceDetail movieId={metadataId} date={date} />;
}
