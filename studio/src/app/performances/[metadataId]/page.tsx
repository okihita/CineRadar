import { PerformanceDetail } from '@/features/performances';
import { firestoreRestClient } from "@/lib/firestore-rest";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
    params: Promise<{ metadataId: string }>;
};

interface MovieMeta {
    title?: string;
    poster?: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { metadataId } = await params;

    const movieMeta = await firestoreRestClient.getDocument<MovieMeta>("movies", metadataId);
    const title = movieMeta?.title || 'Movie Detail';
    const poster = movieMeta?.poster;

    return {
        title: `${title} | CineRadar Admin`,
        description: `Full performance history and market intelligence for ${title}.`,
        openGraph: {
            title,
            images: poster ? [poster] : ['/opengraph-image'],
        },
    };
}

export default async function MovieDetailPage({
    params,
}: {
    params: Promise<{ metadataId: string }>;
}) {
    const { metadataId } = await params;
    return <PerformanceDetail movieId={metadataId} />;
}
