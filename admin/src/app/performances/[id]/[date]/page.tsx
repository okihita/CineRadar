import { DailyPerformanceDetail } from '@/features/performances';

export default async function DailyMoviePerformancePage({
    params,
}: {
    params: Promise<{ id: string, date: string }>;
}) {
    const { id, date } = await params;
    return <DailyPerformanceDetail movieId={id} date={date} />;
}
