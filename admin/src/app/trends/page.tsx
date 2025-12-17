'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Film, Twitter, Sparkles, MapPin, BarChart3 } from 'lucide-react';

interface TrendData {
    genreByRegion: Array<{ genre: string; region: string; avg_occupancy: number; revenue: number; showtimes: number }>;
    topGenres: Array<{ genre: string; avg_occupancy: number; revenue: number }>;
    seasonalTrend: Array<{ genre: string; month: string; avg_occupancy: number }>;
    socialSentiment: Array<{ title: string; genre: string; avg_mentions: number; sentiment: number; best_rank: number | null }>;
    sentimentTrend: Array<{ title: string; date: string; twitter_mentions: number; sentiment_score: number }>;
    regionalPrefs: Array<{ region: string; genre: string; occupancy: number; vs_national: number }>;
    predictions: Array<{ title: string; genre: string; popularity: number; hype_score: number; predicted_performance: string }>;
}

const GENRE_COLORS: Record<string, string> = {
    'Action': 'bg-red-500',
    'Comedy': 'bg-yellow-500',
    'Horror': 'bg-purple-500',
    'Animation': 'bg-blue-500',
    'Romance': 'bg-pink-500',
    'Sci-Fi': 'bg-cyan-500',
    'Drama': 'bg-emerald-500',
    'Thriller': 'bg-orange-500',
};

export default function TrendsPage() {
    const [data, setData] = useState<TrendData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/trends');
                const json = await res.json();
                if (json.error) setError(json.error);
                else setData(json);
            } catch { setError('Failed to load trend data'); }
            finally { setLoading(false); }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground text-sm">Loading trend data...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <Card className="max-w-md border-destructive">
                    <CardContent className="pt-6 text-center">
                        <p className="text-destructive mb-4">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-cyan-500" />
                    <h1 className="text-2xl font-bold">Trend Intelligence</h1>
                    <Badge variant="outline" className="ml-2">Mock Data</Badge>
                </div>
                <p className="text-muted-foreground text-sm">Genre performance, social sentiment, and predictions</p>
            </div>

            {/* Genre Performance */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Film className="w-4 h-4 text-purple-500" />
                        Genre Performance (National)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data.topGenres.map((genre, idx) => {
                            const color = GENRE_COLORS[genre.genre] || 'bg-gray-500';
                            return (
                                <div key={genre.genre} className="p-4 rounded-lg bg-muted/50 text-center">
                                    <div className={`w-10 h-10 rounded-full ${color} mx-auto mb-2 flex items-center justify-center`}>
                                        <span className="text-white text-lg font-bold">{idx + 1}</span>
                                    </div>
                                    <p className="font-medium">{genre.genre}</p>
                                    <p className={`text-2xl font-bold ${genre.avg_occupancy > 60 ? 'text-green-600' : genre.avg_occupancy > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {genre.avg_occupancy}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">occupancy</p>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Social Sentiment */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Twitter className="w-4 h-4 text-blue-400" />
                            Social Buzz (Last 7 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Movie</TableHead>
                                    <TableHead>Mentions</TableHead>
                                    <TableHead>Sentiment</TableHead>
                                    <TableHead>Trending</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.socialSentiment.map((movie) => (
                                    <TableRow key={movie.title}>
                                        <TableCell>
                                            <p className="font-medium text-sm truncate max-w-[150px]">{movie.title}</p>
                                            <Badge variant="outline" className="text-xs">{movie.genre}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">{Math.round(movie.avg_mentions).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-lg ${movie.sentiment > 0.7 ? '😊' : movie.sentiment > 0.5 ? '😐' : '😟'}`}>
                                                    {movie.sentiment > 0.7 ? '😊' : movie.sentiment > 0.5 ? '😐' : '😟'}
                                                </span>
                                                <span className="font-mono text-sm">{movie.sentiment}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {movie.best_rank ? (
                                                <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-pink-500">
                                                    #{movie.best_rank}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Opening Weekend Predictions */}
                <Card className="border-cyan-500/30">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-cyan-600">
                            <Sparkles className="w-4 h-4" />
                            Hype Score & Predictions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Movie</TableHead>
                                    <TableHead>Hype Score</TableHead>
                                    <TableHead>Prediction</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.predictions.map((pred) => (
                                    <TableRow key={pred.title}>
                                        <TableCell>
                                            <p className="font-medium text-sm truncate max-w-[150px]">{pred.title}</p>
                                            <Badge variant="outline" className="text-xs">{pred.genre}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                        style={{ width: `${Math.min(100, pred.hype_score * 10)}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-sm">{pred.hype_score}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                pred.predicted_performance === 'High' ? 'default' :
                                                    pred.predicted_performance === 'Medium' ? 'secondary' : 'outline'
                                            } className={
                                                pred.predicted_performance === 'High' ? 'bg-green-600' :
                                                    pred.predicted_performance === 'Medium' ? 'bg-amber-500' : ''
                                            }>
                                                {pred.predicted_performance}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-3">
                            💡 <strong>Formula:</strong> Hype = Sentiment × Mentions / 1000
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Regional Preferences */}
            <Card className="mb-6">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-500" />
                        Regional Overperformers
                        <span className="text-xs font-normal text-muted-foreground ml-2">(Genres that outperform national avg by &gt;5%)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {data.regionalPrefs.map((pref, idx) => {
                            const color = GENRE_COLORS[pref.genre] || 'bg-gray-500';
                            return (
                                <div key={idx} className="p-3 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-3 h-3 rounded-full ${color}`} />
                                        <span className="text-sm font-medium">{pref.genre}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{pref.region}</p>
                                    <p className="text-lg font-bold text-green-600">+{pref.vs_national}%</p>
                                    <p className="text-xs text-muted-foreground">vs national</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-sm text-green-700 dark:text-green-400">
                            💡 <strong>Actionable Insight:</strong> Horror movies overperform in East Java (+15%).
                            Consider more showtime allocation for horror releases in Surabaya & Malang.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Genre by Region Matrix */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-500" />
                        Genre × Region Performance Matrix
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead>Region</TableHead>
                                    {['Action', 'Comedy', 'Horror', 'Animation', 'Romance'].map(g => (
                                        <TableHead key={g} className="text-center">{g}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {['Jabodetabek', 'East Java', 'West Java', 'Sumatra', 'Central Java'].map(region => (
                                    <TableRow key={region}>
                                        <TableCell className="font-medium">{region}</TableCell>
                                        {['Action', 'Comedy', 'Horror', 'Animation', 'Romance'].map(genre => {
                                            const cell = data.genreByRegion.find(g => g.genre === genre && g.region === region);
                                            const occ = cell?.avg_occupancy || 0;
                                            return (
                                                <TableCell key={genre} className="text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-mono ${occ > 65 ? 'bg-green-500/20 text-green-600' :
                                                            occ > 55 ? 'bg-amber-500/20 text-amber-600' :
                                                                occ > 0 ? 'bg-red-500/20 text-red-600' : 'text-muted-foreground'
                                                        }`}>
                                                        {occ > 0 ? `${occ}%` : '-'}
                                                    </span>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
