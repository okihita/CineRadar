/**
 * Performance Detail Component
 * 
 * Shows details for a specific movie, including:
 * - Movie metadata (title, poster)
 * - Date selector (from history)
 * - Daily stats
 * - Showtimes list
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin, Clock, Loader2, Calendar, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    last_updated: string;
    genres?: string;
    age_category?: string;
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

interface PerformanceDetailProps {
    movieId: string;
}

export function PerformanceDetail({ movieId }: PerformanceDetailProps) {
    const router = useRouter();
    const [movie, setMovie] = useState<MovieSummary | null>(null);
    const [history, setHistory] = useState<DailyPerformance[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);

    // Loading states
    const [loadingMovie, setLoadingMovie] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true); // Start true, fetch immediately
    const [loadingShowtimes, setLoadingShowtimes] = useState(false);

    // 1. Fetch Movie Summary
    useEffect(() => {
        async function fetchMovie() {
            try {
                const res = await fetch(`/api/performance/${movieId}`);
                const data = await res.json();
                if (data.success) {
                    setMovie(data.summary);
                } else {
                    console.error('Failed to load movie:', data.error);
                }
            } catch (e) {
                console.error('Error fetching movie:', e);
            } finally {
                setLoadingMovie(false);
            }
        }
        fetchMovie();
    }, [movieId]);

    // 2. Fetch History
    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/performance/${movieId}/history`);
                const data = await res.json();
                if (data.success) {
                    setHistory(data.history);
                    // Select most recent date by default if available
                    if (data.history.length > 0) {
                        setSelectedDate(data.history[0].date);
                    }
                }
            } catch (e) {
                console.error('Error fetching history:', e);
            } finally {
                setLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [movieId]);

    // 3. Fetch Showtimes when Date changes
    useEffect(() => {
        if (!selectedDate) {
            setShowtimes([]);
            return;
        }

        async function fetchShowtimes() {
            setLoadingShowtimes(true);
            try {
                const res = await fetch(`/api/performance/${movieId}/days/${selectedDate}`);
                const data = await res.json();
                if (data.success) {
                    setShowtimes(data.showtimes);
                }
            } catch (e) {
                console.error('Error fetching showtimes:', e);
            } finally {
                setLoadingShowtimes(false);
            }
        }
        fetchShowtimes();
    }, [movieId, selectedDate]);

    // Derived state for current date stats
    const selectedStats = history.find(d => d.date === selectedDate);

    if (loadingMovie) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Target className="w-12 h-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Movie not found</h2>
                <Button onClick={() => router.push('/movies')}>Back to Movies</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header / Nav */}
            <div className="flex items-start gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/movies')}
                    className="mt-1"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>

                <div className="flex gap-4">
                    <div className="relative w-24 aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-sm">
                        {movie.poster ? (
                            <Image
                                src={movie.poster}
                                alt={movie.title}
                                fill
                                className="object-cover"
                                sizes="100px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Target className="w-6 h-6" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{movie.title}</h1>
                        <p className="text-sm text-muted-foreground/80 mt-1 max-w-xl">
                            {movie.genres || 'Genre N/A'} • {movie.age_category || 'Rating N/A'}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Badge variant="secondary" className="text-xs font-normal">
                                Updated: {new Date(movie.last_updated).toLocaleDateString()}
                            </Badge>
                        </div>
                    </div>
                </div>
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No history available</span>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                            {history.map((day) => (
                                <Badge
                                    key={day.date}
                                    variant={selectedDate === day.date ? "default" : "outline"}
                                    className={cn(
                                        "cursor-pointer hover:bg-primary/90 whitespace-nowrap px-3 py-1 text-sm font-medium transition-colors",
                                        selectedDate === day.date
                                            ? "ring-2 ring-offset-1 ring-primary"
                                            : "hover:text-primary-foreground hover:bg-primary"
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

            {/* Daily Stats & Showtimes */}
            {selectedStats ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-medium">
                                    <Target className="w-3 h-3" />
                                    OCCUPANCY
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    {selectedStats.avg_occupancy_pct.toFixed(1)}%
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
                                    {selectedStats.total_seats.toLocaleString()}
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
                                    {selectedStats.total_sold.toLocaleString()}
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
                                    {selectedStats.cities?.length || 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Showtimes Table */}
                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold">
                                Showtimes Breakdown
                            </CardTitle>
                            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {showtimes.length} results
                            </span>
                        </CardHeader>
                        <CardContent>
                            {loadingShowtimes ? (
                                <div className="py-12 flex justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
                                </div>
                            ) : showtimes.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground text-sm">
                                    No showtimes found for this date.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b text-left text-muted-foreground">
                                                <th className="py-3 px-4 font-medium w-24">
                                                    <Clock className="w-3 h-3 inline mr-1" />
                                                    Time
                                                </th>
                                                <th className="py-3 px-4 font-medium">Theatre</th>
                                                <th className="py-3 px-4 font-medium">City</th>
                                                <th className="py-3 px-4 font-medium">Room</th>
                                                <th className="py-3 px-4 font-medium w-48">Occupancy</th>
                                                <th className="py-3 px-4 font-medium text-right w-24">Seats</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showtimes.slice(0, 100).map((st) => (
                                                <tr key={st.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-medium text-foreground">{st.showtime}</td>
                                                    <td className="py-3 px-4 font-medium">{st.theatre_name}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{st.city}</td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                                            {st.room_category}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-500",
                                                                        st.occupancy_pct > 80 ? "bg-red-500" :
                                                                            st.occupancy_pct > 50 ? "bg-amber-500" : "bg-primary"
                                                                    )}
                                                                    style={{ width: `${st.occupancy_pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs w-10 text-right font-mono text-muted-foreground">
                                                                {st.occupancy_pct}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                                                        <span className="text-foreground font-medium">{st.sold_seats}</span>
                                                        <span className="opacity-50">/{st.total_seats}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {showtimes.length > 100 && (
                                <p className="text-center text-muted-foreground text-xs py-4">
                                    Showing top 100 of {showtimes.length} showtimes
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                !loadingHistory && (
                    <div className="py-12 text-center text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Select a date to view performance details for this movie.</p>
                    </div>
                )
            )}
        </div>
    );
}
