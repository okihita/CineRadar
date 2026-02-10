import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CitySchedule } from "../types";
import { cn } from "@/lib/utils";

interface CityScheduleBreakdownProps {
    cityData: CitySchedule;
}

export function CityScheduleBreakdown({ cityData }: CityScheduleBreakdownProps) {
    const sortedCities = Object.keys(cityData || {}).sort();

    if (sortedCities.length === 0) {
        return <div className="text-muted-foreground text-sm italic">No showtimes found for this movie.</div>;
    }

    return (
        <div className="space-y-6">
            {sortedCities.map((city) => {
                const theatres = cityData[city] || [];
                return (
                    <div key={city} className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{city}</span>
                            <span className="text-xs font-normal text-muted-foreground">({theatres.length} theatres)</span>
                        </h4>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {theatres.map((theatre, idx) => {
                                const rooms = theatre.rooms || [];
                                return (
                                    <Card key={theatre.theatre_id || idx} className="overflow-hidden">
                                        <CardHeader className="p-3 bg-muted/30 pb-2">
                                            <CardTitle className="text-sm font-medium leading-tight truncate" title={theatre.theatre_name}>
                                                {theatre.theatre_name}
                                            </CardTitle>
                                            <div className="text-xs text-muted-foreground truncate">{theatre.merchant}</div>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-2 space-y-2">
                                            {rooms.map((room, roomIdx) => (
                                                <div key={roomIdx}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                            {room.category || "Standard"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">{room.price}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(room.all_showtimes || []).map((show, showIdx) => (
                                                            <Badge
                                                                key={show.showtime_id || showIdx}
                                                                variant={show.is_available ? "secondary" : "outline"}
                                                                className={cn(
                                                                    "text-[10px] px-1.5 py-0 h-5 font-mono cursor-default",
                                                                    !show.is_available && "opacity-50 line-through"
                                                                )}
                                                            >
                                                                {show.time}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
