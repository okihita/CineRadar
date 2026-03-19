import { DailyPerformanceDetail } from '@/features/performances_v2';

export default async function DailyPerformanceDetailV2({
    params,
}: {
    params: Promise<{ metadataId: string; date: string }>;
}) {
    const { metadataId, date } = await params;
    return <DailyPerformanceDetail movieId={metadataId} date={date} />;
}
