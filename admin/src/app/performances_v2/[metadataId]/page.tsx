import { PerformanceDetail } from '@/features/performances_v2';

export default async function MovieDetailPageV2({
    params,
}: {
    params: Promise<{ metadataId: string }>;
}) {
    const { metadataId } = await params;
    return <PerformanceDetail movieId={metadataId} />;
}
