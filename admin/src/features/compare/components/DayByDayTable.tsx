import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Movie, abbreviateTitle } from '../types';

interface DayByDayTableProps {
    selectedMovieIds: string[];
    selectedMoviesDetails: Movie[];
    movieColorsMap: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartData: any[];
}

export function DayByDayTable({
    selectedMovieIds,
    selectedMoviesDetails,
    movieColorsMap,
    chartData,
}: DayByDayTableProps) {
    return (
        <Card className="col-span-full shadow-sm">
            <CardHeader>
                <CardTitle>Day-by-Day Progression</CardTitle>
                <CardDescription>
                    Detailed breakdown of admissions and showtimes per day.
                </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            {selectedMoviesDetails.map((movie) => (
                                <TableHead key={movie.id} className="text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: movieColorsMap[movie.id] }} />
                                            <span className="font-bold truncate max-w-[150px] text-foreground">
                                                {abbreviateTitle(movie.title)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">Adm / Shows</span>
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {chartData.map((dayData: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{dayData.date}</TableCell>
                                {selectedMovieIds.map((id) => {
                                    const admissions = dayData[`${id}_admissions`] || 0;
                                    const showtimes = dayData[`${id}_showtimes`] || 0;
                                    return (
                                        <TableCell key={id} className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium">{admissions.toLocaleString()}</span>
                                                <span className="text-xs text-muted-foreground">{showtimes.toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
