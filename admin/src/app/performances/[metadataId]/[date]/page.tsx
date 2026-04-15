import { DailyPerformanceDetail } from '@/features/performances';

export default async function DailyPerformancePage({
    params,
}: {
    params: Promise<{ metadataId: string; date: string }>;
}) {
    const { metadataId, date } = await params;
    return <DailyPerformanceDetail movieId={metadataId} date={date} />;
}
