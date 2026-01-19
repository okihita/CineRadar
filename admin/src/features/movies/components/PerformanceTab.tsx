/**
 * Performance Tab Component
 * 
 * Shows movie performance data with historical drill-down:
 * 1. Select Movie (Root)
 * 2. Select Date (History)
 * 3. View Stats & Showtimes (Daily Details)
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin, Clock, Loader2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MovieMetadata {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
}

interface DailyPerformance {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface ShowtimeSnapshot {
    id: string;
    showtime_id: string;
    movie_title: string;
    theatre_name: string;
    city: string;
    room_category: string;
    merchant: string;
    showtime: string;
    total_seats: number;
    sold_seats: number;
    occupancy_pct: number;
}

export function PerformanceTab() {
    const [movies, setMovies] = useState<MovieMetadata[]>([]);
    const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
    const [history, setHistory] = useState<DailyPerformance[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);

    const [loadingMovies, setLoadingMovies] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch Movies List
    useEffect(() => {
        async function fetchMovies() {
            try {
                const res = await fetch('/api/performance');
                const data = await res.json();
                if (data.success) {
                    setMovies(data.movies);
                    if (data.movies.length > 0) {
                        setSelectedMovieId(data.movies[0].id);
                    }
                } else {
                    setError(data.error || 'Failed to load movies');
                }
            } catch (e) {
                setError(String(e));
            } finally {
                setLoadingMovies(false);
            }
        }
        fetchMovies();
    }, []);

    // 2. Fetch History when Movie changes
    useEffect(() => {
        if (!selectedMovieId) return;

        async function fetchHistory() {
            setLoadingHistory(true);
            try {
                const res = await fetch(`/api/performance/${selectedMovieId}/history`);
                const data = await res.json();
                if (data.success) {
                    setHistory(data.history);
                    if (data.history.length > 0) {
                        // Auto-select most recent date
                        setSelectedDate(data.history[0].date);
                    } else {
                        setSelectedDate(null);
                        setHistory([]);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [selectedMovieId]);

    // 3. Fetch Showtimes when Date changes
    useEffect(() => {
        if (!selectedMovieId || !selectedDate) {
            setShowtimes([]);
            return;
        }

        async function fetchShowtimes() {
            setLoadingDetails(true);
            try {
                // Encode date if needed, though YYYY-MM-DD is safe
                const res = await fetch(`/api/performance/${selectedMovieId}/days/${selectedDate}`);
                const data = await res.json();
                if (data.success) {
                    setShowtimes(data.showtimes);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingDetails(false);
            }
        }
        fetchShowtimes();
    }, [selectedMovieId, selectedDate]);

    // Derived state
    const selectedStats = history.find(d => d.date === selectedDate);
    const scrapedPct = selectedStats
        ? Math.min(100, Math.round((selectedStats.total_showtimes / 50) * 100))
        : 0; // Simple heuristic

    if (loadingMovies) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading movies...</span>
            </div>
        );
    }

    if (movies.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No movies initialized yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Movie Selector */}
                <Card className="flex-1">
                    <CardHeader className="pb-3 px-4 pt-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                            <Target className="w-4 h-4" />
                            Select Movie
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <select
                            value={selectedMovieId || ''}
                            onChange={(e) => setSelectedMovieId(e.target.value)}
                            className="w-full p-2 rounded-md border bg-background text-foreground text-sm"
                        >
                            {movies.map((movie) => (
                                <option key={movie.id} value={movie.id}>
                                    {movie.title}
                                </option>
                            ))}
                        </select>
                    </CardContent>
                </Card>

                {/* Date Selector */}
                <Card className="flex-1">
                    <CardHeader className="pb-3 px-4 pt-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            Select Date
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {loadingHistory ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : history.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No history available</span>
                        ) : (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {history.map((day) => (
                                    <Badge
                                        key={day.date}
                                        variant={selectedDate === day.date ? "default" : "outline"}
                                        className={cn(
                                            "cursor-pointer hover:bg-primary/90 whitespace-nowrap",
                                            selectedDate === day.date ? "" : "hover:text-primary-foreground"
                                        )}
                                        onClick={() => setSelectedDate(day.date)}
                                    >
                                        {day.date}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : selectedStats ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Target className="w-3 h-3" />
                                    AVG OCCUPANCY
                                </div>
                                <p className="text-2xl font-bold">
                                    {selectedStats.avg_occupancy_pct.toFixed(1)}%
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Armchair className="w-3 h-3" />
                                    TOTAL SEATS
                                </div>
                                <p className="text-2xl font-bold">
                                    {selectedStats.total_seats.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Users className="w-3 h-3" />
                                    SEATS SOLD
                                </div>
                                <p className="text-2xl font-bold">
                                    {selectedStats.total_sold.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <MapPin className="w-3 h-3" />
                                    CITIES
                                </div>
                                <p className="text-2xl font-bold">
                                    {selectedStats.cities?.length || 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Showtimes Table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex justify-between">
                                <span>Showtimes Breakdown</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    {showtimes.length} showtimes found
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showtimes.length === 0 ? (
                                <p className="text-muted-foreground text-sm py-4 text-center">
                                    No showtime data available for this date
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2 px-2">
                                                    <Clock className="w-3 h-3 inline mr-1" />
                                                    Time
                                                </th>
                                                <th className="py-2 px-2">Theatre</th>
                                                <th className="py-2 px-2">City</th>
                                                <th className="py-2 px-2">Room</th>
                                                <th className="py-2 px-2">Occupancy</th>
                                                <th className="py-2 px-2 text-right">Seats</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showtimes.slice(0, 50).map((st) => (
                                                <tr key={st.id} className="border-b border-border/50 hover:bg-muted/30">
                                                    <td className="py-2 px-2 font-mono">{st.showtime}</td>
                                                    <td className="py-2 px-2">{st.theatre_name}</td>
                                                    <td className="py-2 px-2 text-muted-foreground">{st.city}</td>
                                                    <td className="py-2 px-2 text-muted-foreground">{st.room_category}</td>
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary"
                                                                    style={{ width: `${st.occupancy_pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs">{st.occupancy_pct}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-mono">
                                                        {st.sold_seats}/{st.total_seats}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {showtimes.length > 50 && (
                                        <p className="text-center text-muted-foreground text-xs py-2">
                                            Showing 50 of {showtimes.length} showtimes
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        Select a movie and date to view performance details.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
