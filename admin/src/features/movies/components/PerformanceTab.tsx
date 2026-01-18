/**
 * Performance Tab Component
 * 
 * Shows movie performance data:
 * - Movie selector dropdown
 * - Scrape progress bar
 * - Occupancy summary KPIs
 * - Showtimes breakdown table
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, Armchair, MapPin, Clock, Loader2 } from 'lucide-react';

interface MovieSummary {
    id: string;
    movie_id: string;
    title: string;
    poster: string;
    date: string;
    cities: string[];
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    last_updated: string;
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
    const [movies, setMovies] = useState<MovieSummary[]>([]);
    const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<MovieSummary | null>(null);
    const [showtimes, setShowtimes] = useState<ShowtimeSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch movies list
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
                setLoading(false);
            }
        }
        fetchMovies();
    }, []);

    // Fetch selected movie details
    useEffect(() => {
        if (!selectedMovieId) return;

        async function fetchDetails() {
            setLoadingDetails(true);
            try {
                const res = await fetch(`/api/performance/${selectedMovieId}`);
                const data = await res.json();
                if (data.success) {
                    setSelectedMovie(data.summary);
                    setShowtimes(data.showtimes);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingDetails(false);
            }
        }
        fetchDetails();
    }, [selectedMovieId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading performance data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-4">
                    <p className="text-destructive">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (movies.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No performance data available yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Run the movie performance scraper to collect data.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const scrapedPct = selectedMovie
        ? Math.min(100, Math.round((selectedMovie.total_showtimes / 50) * 100))
        : 0;

    return (
        <div className="space-y-6">
            {/* Movie Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Select Movie
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <select
                        value={selectedMovieId || ''}
                        onChange={(e) => setSelectedMovieId(e.target.value)}
                        className="w-full p-2 rounded-md border bg-background text-foreground"
                    >
                        {movies.map((movie) => (
                            <option key={movie.id} value={movie.id}>
                                {movie.title} ({movie.total_showtimes} showtimes, {movie.avg_occupancy_pct}% avg)
                            </option>
                        ))}
                    </select>
                </CardContent>
            </Card>

            {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : selectedMovie && (
                <>
                    {/* Scrape Progress */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Today&apos;s Scrape Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Scraped: {selectedMovie.total_showtimes} showtimes</span>
                                    <span>{scrapedPct}%</span>
                                </div>
                                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${scrapedPct}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Target className="w-3 h-3" />
                                    AVG OCCUPANCY
                                </div>
                                <p className="text-2xl font-bold">
                                    {selectedMovie.avg_occupancy_pct.toFixed(1)}%
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
                                    {selectedMovie.total_seats.toLocaleString()}
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
                                    {selectedMovie.total_sold.toLocaleString()}
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
                                    {selectedMovie.cities?.length || 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Showtimes Table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Showtimes Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {showtimes.length === 0 ? (
                                <p className="text-muted-foreground text-sm py-4 text-center">
                                    No showtime data available
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
                                            {showtimes.slice(0, 20).map((st) => (
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
                                    {showtimes.length > 20 && (
                                        <p className="text-center text-muted-foreground text-xs py-2">
                                            Showing 20 of {showtimes.length} showtimes
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
