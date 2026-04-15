import { PerformanceDetail } from '@/features/performances';

export default async function MovieDetailPage({
    params,
}: {
    params: Promise<{ metadataId: string }>;
}) {
    const { metadataId } = await params;
    return <PerformanceDetail movieId={metadataId} />;
}
