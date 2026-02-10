import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, CalendarRange, MapPin } from "lucide-react";

interface ScheduleStatsProps {
    totalMovies: number;
    totalShowtimes: number;
    totalTheatres: number; // calculated from aggregating cities
}

export function ScheduleStats({ totalMovies, totalShowtimes, totalTheatres }: ScheduleStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Movies
                    </CardTitle>
                    <Film className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalMovies}</div>
                    <p className="text-xs text-muted-foreground">
                        Scheduled for this date
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Showtimes
                    </CardTitle>
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalShowtimes.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                        Individual screenings
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Active Theatres
                    </CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalTheatres}</div>
                    <p className="text-xs text-muted-foreground">
                        Across all cities
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
