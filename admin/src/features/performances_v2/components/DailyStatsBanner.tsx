import { Card, CardContent } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin } from 'lucide-react';

interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface DailyStatsBannerProps {
    stats: DailyPerformance;
}

export function DailyStatsBanner({ stats }: DailyStatsBannerProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                        <Target className="w-3 h-3" />
                        OCCUPANCY
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                        {stats.avg_occupancy_pct.toFixed(1)}%
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                        <Armchair className="w-3 h-3" />
                        TOTAL SEATS
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                        {stats.total_seats.toLocaleString()}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                        <Users className="w-3 h-3" />
                        SOLD
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                        {stats.total_sold.toLocaleString()}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                        <MapPin className="w-3 h-3" />
                        CITIES
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                        {stats.cities?.length || 0}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
