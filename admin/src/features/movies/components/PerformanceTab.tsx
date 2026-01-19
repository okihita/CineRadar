/**
 * Performance Tab Component
 * 
 * Shows all movies with posters and today's performance summary.
 * Click a movie card to drill down into date history and showtimes.
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin, Clock, Loader2, Calendar, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface TodayStats {
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
}

interface MovieWithStats {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    today?: TodayStats;
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
    const [movies, setMovies] = useState<MovieWithStats[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<MovieWithStats | null>(null);
    const [history, setHistory] = useState<DailyPerformance[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);

    const [loadingMovies, setLoadingMovies] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch Movies List with today's stats
    useEffect(() => {
        async function fetchMovies() {
            try {
                const res = await fetch('/api/performance');
                const data = await res.json();
                if (data.success) {
                    setMovies(data.movies);
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

    // 2. Fetch History when Movie is selected
    useEffect(() => {
        if (!selectedMovie) return;

        async function fetchHistory() {
            setLoadingHistory(true);
            try {
                const res = await fetch(`/api/performance/${selectedMovie!.id}/history`);
                const data = await res.json();
                if (data.success) {
                    setHistory(data.history);
                    if (data.history.length > 0) {
                        setSelectedDate(data.history[0].date);
                    } else {
                        setSelectedDate(null);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [selectedMovie]);

    // 3. Fetch Showtimes when Date changes
    useEffect(() => {
        if (!selectedMovie || !selectedDate) {
            setShowtimes([]);
            return;
        }

        async function fetchShowtimes() {
            setLoadingDetails(true);
            try {
                const res = await fetch(`/api/performance/${selectedMovie!.id}/days/${selectedDate}`);
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
    }, [selectedMovie, selectedDate]);

    // Derived state
    const selectedStats = history.find(d => d.date === selectedDate);

    // Loading state
    if (loadingMovies) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading movies...</span>
            </div>
        );
    }

    // Empty state
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

    // Detail View (when a movie is selected)
    if (selectedMovie) {
        return (
            <div className="space-y-6">
                {/* Back button + Movie title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setSelectedMovie(null);
                            setHistory([]);
                            setSelectedDate(null);
                            setShowtimes([]);
                        }}
                        className="p-2 rounded-md hover:bg-muted transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-semibold">{selectedMovie.title}</h2>
                </div>

                {/* Date Selector */}
                <Card>
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
                            Select a date to view performance details.
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // Grid View (default - all movies)
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Movie Performance</h2>
                <span className="text-sm text-muted-foreground">{movies.length} movies</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {movies.map((movie) => (
                    <Card
                        key={movie.id}
                        className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition overflow-hidden"
                        onClick={() => setSelectedMovie(movie)}
                    >
                        <div className="flex">
                            {/* Poster */}
                            <div className="w-20 h-28 relative flex-shrink-0 bg-muted">
                                {movie.poster ? (
                                    <Image
                                        src={movie.poster}
                                        alt={movie.title}
                                        fill
                                        className="object-cover"
                                        sizes="80px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <Target className="w-6 h-6" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <CardContent className="p-3 flex-1 min-w-0">
                                <h3 className="font-medium text-sm truncate mb-2">{movie.title}</h3>

                                {movie.today ? (
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Occupancy</span>
                                            <span className="font-medium">{movie.today.avg_occupancy_pct.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Showtimes</span>
                                            <span className="font-medium">{movie.today.total_showtimes}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Sold</span>
                                            <span className="font-medium">{movie.today.total_sold.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No data today</p>
                                )}
                            </CardContent>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
