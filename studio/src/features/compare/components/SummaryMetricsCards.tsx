import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MonitorPlay, Percent } from 'lucide-react';
import { abbreviateTitle } from '../types';

interface SummaryMetricsCardsProps {
    selectedMovieIds: string[];
    movieColorsMap: Record<string, string>;
    summaryMetrics: Record<string, {
        totalAdmissions: number;
        totalShowtimes: number;
        avgOccupancy: number;
        admissionsPerShowtime: number;
    }>;
    compareData: {
        movies?: Record<string, { title: string }>;
    } | null;
}

function MetricCard({
    title,
    icon,
    metricKey,
    format,
    selectedMovieIds,
    movieColorsMap,
    summaryMetrics,
    compareData,
}: {
    title: string;
    icon: React.ReactNode;
    metricKey: 'totalAdmissions' | 'totalShowtimes' | 'admissionsPerShowtime' | 'avgOccupancy';
    format: (val: number) => string;
} & Pick<SummaryMetricsCardsProps, 'selectedMovieIds' | 'movieColorsMap' | 'summaryMetrics' | 'compareData'>) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {selectedMovieIds.map((id) => (
                        <div key={id} className="flex justify-between items-center text-sm gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[id] }} />
                                <span className="font-medium whitespace-nowrap truncate" title={compareData?.movies?.[id]?.title || id}>
                                    {abbreviateTitle(compareData?.movies?.[id]?.title || id)}
                                </span>
                            </div>
                            <span className="font-bold">
                                {format(summaryMetrics[id]?.[metricKey] || 0)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export function SummaryMetricsCards({
    selectedMovieIds,
    movieColorsMap,
    summaryMetrics,
    compareData,
}: SummaryMetricsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                title="Total Admissions"
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                metricKey="totalAdmissions"
                format={(v) => v.toLocaleString()}
                selectedMovieIds={selectedMovieIds}
                movieColorsMap={movieColorsMap}
                summaryMetrics={summaryMetrics}
                compareData={compareData}
            />
            <MetricCard
                title="Total Showtimes"
                icon={<MonitorPlay className="h-4 w-4 text-muted-foreground" />}
                metricKey="totalShowtimes"
                format={(v) => v.toLocaleString()}
                selectedMovieIds={selectedMovieIds}
                movieColorsMap={movieColorsMap}
                summaryMetrics={summaryMetrics}
                compareData={compareData}
            />
            <MetricCard
                title="Avg Adm. / Showtime"
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                metricKey="admissionsPerShowtime"
                format={(v) => v.toFixed(1)}
                selectedMovieIds={selectedMovieIds}
                movieColorsMap={movieColorsMap}
                summaryMetrics={summaryMetrics}
                compareData={compareData}
            />
            <MetricCard
                title="Avg Occupancy"
                icon={<Percent className="h-4 w-4 text-muted-foreground" />}
                metricKey="avgOccupancy"
                format={(v) => `${v.toFixed(1)}%`}
                selectedMovieIds={selectedMovieIds}
                movieColorsMap={movieColorsMap}
                summaryMetrics={summaryMetrics}
                compareData={compareData}
            />
        </div>
    );
}
