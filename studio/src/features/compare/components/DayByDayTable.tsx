import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Movie, abbreviateTitle, CompareChartDataItem } from '../types';

interface DayByDayTableProps {
    selectedMovieIds: string[];
    selectedMoviesDetails: Movie[];
    movieColorsMap: Record<string, string>;
    chartData: CompareChartDataItem[];
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
                                        <span className="text-sm text-muted-foreground">Adm / Shows</span>
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {chartData.map((dayData: CompareChartDataItem, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{dayData.date}</TableCell>
                                {selectedMovieIds.map((id) => {
                                    const admissions = dayData[`${id}_admissions`] || 0;
                                    const showtimes = dayData[`${id}_showtimes`] || 0;
                                    return (
                                        <TableCell key={id} className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium">{admissions.toLocaleString()}</span>
                                                <span className="text-sm text-muted-foreground">{showtimes.toLocaleString()}</span>
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
