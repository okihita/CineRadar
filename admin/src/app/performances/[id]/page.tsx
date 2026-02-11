import { PerformanceDetail } from '@/features/performances';

export default async function MovieDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <PerformanceDetail movieId={id} />;
}
