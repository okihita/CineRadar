import { PerformanceDetail } from '@/features/performances';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MovieDetailPage({
    params,
}: {
    params: Promise<{ metadataId: string }>;
}) {
    const { metadataId } = await params;
    return <PerformanceDetail movieId={metadataId} />;
}
