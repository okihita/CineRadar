import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, CalendarRange, MapPin } from "lucide-react";

interface ScheduleStatsProps {
    totalMovies: number;
    totalShowtimes: number;
    totalAvailableShowtimes?: number;
    totalTheatres: number; // calculated from aggregating cities
}

export function ScheduleStats({ totalMovies, totalShowtimes, totalAvailableShowtimes, totalTheatres }: ScheduleStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:bg-muted/30 transition-colors border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Movies
                    </CardTitle>
                    <Film className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalMovies}</div>
                    <p className="text-sm text-muted-foreground">
                        Scheduled for this date
                    </p>
                </CardContent>
            </Card>
            <Card className="hover:bg-muted/30 transition-colors border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Showtimes
                    </CardTitle>
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{totalAvailableShowtimes?.toLocaleString() || totalShowtimes.toLocaleString()}</div>
                        {totalAvailableShowtimes !== undefined && (
                            <div className="text-sm font-medium text-muted-foreground">
                                / {totalShowtimes.toLocaleString()}
                            </div>
                        )}
                    </div>
                    {totalAvailableShowtimes !== undefined ? (
                        <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${(totalAvailableShowtimes / totalShowtimes) * 100}%` }}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {((totalAvailableShowtimes / totalShowtimes) * 100).toFixed(1)}% bookable
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                            Individual screenings
                        </p>
                    )}
                </CardContent>
            </Card>
            <Card className="hover:bg-muted/30 transition-colors border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Active Theatres
                    </CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalTheatres}</div>
                    <p className="text-sm text-muted-foreground">
                        Across all cities
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
