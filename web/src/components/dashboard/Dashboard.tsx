'use client';

import { useMemo } from 'react';
import TheatreMapExplorer from './TheatreMapExplorer';

interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
    }[];
}

interface Movie {
    id: string;
    title: string;
    genres: string[];
    poster: string;
    age_category: string;
    country: string;
    merchants: string[];
    cities: string[];
    is_presale?: boolean;
    schedules?: Record<string, TheaterSchedule[]>;
}

interface DashboardProps {
    movies: Movie[];
}

// Donut chart component
function DonutChart({ data, colors }: { data: { label: string; value: number }[]; colors: string[] }) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    // Pre-calculate cumulative angles
    const segments = data.reduce<{ startAngle: number; endAngle: number; value: number }[]>((acc, d, i) => {
        const prevEnd = i === 0 ? 0 : acc[i - 1].endAngle;
        const angle = (d.value / total) * 360;
        acc.push({ startAngle: prevEnd, endAngle: prevEnd + angle, value: d.value });
        return acc;
    }, []);

    return (
        <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {segments.map((seg, i) => {
                    const x1 = 50 + 40 * Math.cos((seg.startAngle * Math.PI) / 180);
                    const y1 = 50 + 40 * Math.sin((seg.startAngle * Math.PI) / 180);
                    const x2 = 50 + 40 * Math.cos((seg.endAngle * Math.PI) / 180);
                    const y2 = 50 + 40 * Math.sin((seg.endAngle * Math.PI) / 180);
                    const angle = seg.endAngle - seg.startAngle;
                    const largeArc = angle > 180 ? 1 : 0;

                    return (
                        <path
                            key={i}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={colors[i % colors.length]}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                        />
                    );
                })}
                <circle cx="50" cy="50" r="25" fill="#1a1a2e" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{total}</span>
            </div>
        </div>
    );
}

// Bar chart component
function BarChart({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
    return (
        <div className="space-y-2">
            {data.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-gray-400 truncate text-right" title={d.label}>
                        {d.label.length > 15 ? d.label.slice(0, 15) + '...' : d.label}
                    </div>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                        <div
                            className="h-full rounded transition-all"
                            style={{
                                width: `${(d.value / maxValue) * 100}%`,
                                background: d.color
                            }}
                        />
                    </div>
                    <div className="w-12 text-xs text-white text-right font-medium">{d.value}</div>
                </div>
            ))}
        </div>
    );
}

// Old IndonesiaMap removed - now using IndonesiaMapSVG component

export default function Dashboard({ movies }: DashboardProps) {
    // Calculate all stats
    const stats = useMemo(() => {
        // Chain distribution
        const chainCounts: Record<string, number> = {};
        const cityTheatreCounts: Record<string, number> = {};
        const genreCounts: Record<string, number> = {};
        const ageCounts: Record<string, number> = {};
        const hourCounts: number[] = Array(24).fill(0);
        const pricesByChain: Record<string, number[]> = {};
        const schedulesByCity: Record<string, TheaterSchedule[]> = {};
        let totalShowtimes = 0;
        let totalTheatres = 0;

        movies.forEach(movie => {
            // Genres
            movie.genres.forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });

            // Age ratings
            ageCounts[movie.age_category] = (ageCounts[movie.age_category] || 0) + 1;

            // Schedules
            if (movie.schedules) {
                Object.entries(movie.schedules).forEach(([city, theatres]) => {
                    cityTheatreCounts[city] = (cityTheatreCounts[city] || 0) + theatres.length;
                    totalTheatres += theatres.length;

                    // Aggregate schedules by city for map explorer
                    if (!schedulesByCity[city]) schedulesByCity[city] = [];
                    schedulesByCity[city].push(...theatres);

                    theatres.forEach(t => {
                        chainCounts[t.merchant] = (chainCounts[t.merchant] || 0) + 1;

                        t.rooms.forEach(r => {
                            // Showtimes
                            r.showtimes.forEach(time => {
                                const hour = parseInt(time.split(':')[0], 10);
                                if (hour >= 0 && hour < 24) hourCounts[hour]++;
                                totalShowtimes++;
                            });

                            // Prices
                            const matches = r.price.match(/\d+[.,]?\d*/g);
                            if (matches) {
                                matches.forEach(m => {
                                    const price = parseInt(m.replace(/[.,]/g, ''), 10);
                                    if (price > 0 && price < 500000) {
                                        if (!pricesByChain[t.merchant]) pricesByChain[t.merchant] = [];
                                        pricesByChain[t.merchant].push(price);
                                    }
                                });
                            }
                        });
                    });
                });
            }
        });

        // Calculate average prices by chain
        const avgPriceByChain = Object.entries(pricesByChain).map(([chain, prices]) => ({
            chain,
            avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
            min: Math.min(...prices),
            max: Math.max(...prices)
        })).sort((a, b) => a.avg - b.avg);

        // Top movies by coverage
        const moviesByCoverage = [...movies]
            .sort((a, b) => b.cities.length - a.cities.length)
            .slice(0, 10);

        // Top cities by theatres
        const topCities = Object.entries(cityTheatreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // Pre-sale movies
        const presaleMovies = movies.filter(m => m.is_presale);

        return {
            chainCounts,
            cityTheatreCounts,
            genreCounts,
            ageCounts,
            hourCounts,
            avgPriceByChain,
            moviesByCoverage,
            topCities,
            presaleMovies,
            totalMovies: movies.length,
            totalCities: Object.keys(cityTheatreCounts).length,
            totalTheatres,
            totalShowtimes,
            schedulesByCity
        };
    }, [movies]);

    const chainColors: Record<string, string> = {
        'XXI': '#3b82f6',
        'CGV': '#ef4444',
        'Cinépolis': '#eab308',
    };

    const genreColors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-900 to-black">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">📊 Market Insights</h1>
                <p className="text-gray-400">Bird&apos;s-eye view of Indonesia&apos;s cinema landscape</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Movies', value: stats.totalMovies, icon: '🎬', color: 'from-purple-500 to-pink-500' },
                    { label: 'Cities', value: stats.totalCities, icon: '🏙️', color: 'from-blue-500 to-cyan-500' },
                    { label: 'Theatres', value: stats.totalTheatres, icon: '🎭', color: 'from-amber-500 to-orange-500' },
                    { label: 'Showtimes', value: stats.totalShowtimes.toLocaleString(), icon: '🎟️', color: 'from-emerald-500 to-teal-500' },
                ].map((stat, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{stat.icon}</span>
                            <div>
                                <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                                    {stat.value}
                                </div>
                                <div className="text-xs text-gray-500">{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Chain Market Share */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">🎬 Chain Market Share</h3>
                    <div className="flex items-center gap-6">
                        <DonutChart
                            data={Object.entries(stats.chainCounts).map(([label, value]) => ({ label, value }))}
                            colors={Object.keys(stats.chainCounts).map(k => chainColors[k] || '#6b7280')}
                        />
                        <div className="space-y-2">
                            {Object.entries(stats.chainCounts).sort((a, b) => b[1] - a[1]).map(([chain, count]) => (
                                <div key={chain} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: chainColors[chain] || '#6b7280' }}
                                    />
                                    <span className="text-sm text-gray-300">{chain}</span>
                                    <span className="text-sm text-white font-medium">{count}</span>
                                    <span className="text-xs text-gray-500">
                                        ({Math.round(count / Object.values(stats.chainCounts).reduce((a, b) => a + b, 0) * 100)}%)
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Price by Chain */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">💰 Price by Chain</h3>
                    <div className="space-y-4">
                        {stats.avgPriceByChain.map((c, i) => (
                            <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-gray-300">{c.chain}</span>
                                    <span className="text-sm font-medium" style={{ color: chainColors[c.chain] || '#9ca3af' }}>
                                        Rp{(c.avg / 1000).toFixed(0)}k avg
                                    </span>
                                </div>
                                <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                                    <div
                                        className="absolute h-full rounded-full opacity-30"
                                        style={{
                                            left: `${(c.min / 200000) * 100}%`,
                                            right: `${100 - (c.max / 200000) * 100}%`,
                                            backgroundColor: chainColors[c.chain] || '#6b7280'
                                        }}
                                    />
                                    <div
                                        className="absolute w-1 h-full"
                                        style={{
                                            left: `${(c.avg / 200000) * 100}%`,
                                            backgroundColor: chainColors[c.chain] || '#6b7280'
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Rp{(c.min / 1000).toFixed(0)}k</span>
                                    <span>Rp{(c.max / 1000).toFixed(0)}k</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Movies by Coverage */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">🏆 Top Movies by Coverage</h3>
                    <BarChart
                        data={stats.moviesByCoverage.map((m, i) => ({
                            label: m.title,
                            value: m.cities.length,
                            color: `hsl(${280 - i * 15}, 70%, 60%)`
                        }))}
                        maxValue={Math.max(...stats.moviesByCoverage.map(m => m.cities.length))}
                    />
                </div>

                {/* Top Cities by Theatres */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">🏙️ Top Cities by Theatres</h3>
                    <BarChart
                        data={stats.topCities.map(([city, count], i) => ({
                            label: city,
                            value: count,
                            color: `hsl(${200 + i * 10}, 70%, 50%)`
                        }))}
                        maxValue={stats.topCities[0]?.[1] || 1}
                    />
                </div>
            </div>

            {/* Indonesia Map - 3 Column Explorer */}
            <div className="mb-8">
                <TheatreMapExplorer
                    cityData={Object.entries(stats.cityTheatreCounts).map(([city, theatres]) => ({ city, theatres }))}
                    schedulesByCity={stats.schedulesByCity}
                />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Peak Hours */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">⏰ Peak Showtime Hours</h3>
                    <div className="flex items-end gap-1 h-24">
                        {stats.hourCounts.slice(10, 24).map((count, i) => {
                            const maxCount = Math.max(...stats.hourCounts);
                            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-gradient-to-t from-purple-600 to-pink-500 rounded-t transition-all"
                                        style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                                        title={`${i + 10}:00 - ${count} showtimes`}
                                    />
                                    {i % 2 === 0 && (
                                        <span className="text-[10px] text-gray-500 mt-1">{i + 10}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Genre Distribution */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">🎭 Genre Distribution</h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.genreCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([genre, count], i) => (
                                <span
                                    key={genre}
                                    className="px-3 py-1 rounded-full text-sm font-medium"
                                    style={{
                                        backgroundColor: `${genreColors[i % genreColors.length]}30`,
                                        color: genreColors[i % genreColors.length],
                                        borderColor: `${genreColors[i % genreColors.length]}50`,
                                        borderWidth: '1px'
                                    }}
                                >
                                    {genre} ({count})
                                </span>
                            ))}
                    </div>
                </div>

                {/* Pre-sale Movies */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">🎟️ Pre-sale Movies</h3>
                    {stats.presaleMovies.length > 0 ? (
                        <div className="space-y-2">
                            {stats.presaleMovies.slice(0, 5).map((m, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-amber-500">🎟️</span>
                                    <span className="text-sm text-gray-300 truncate">{m.title}</span>
                                    <span className="text-xs text-gray-500">({m.cities.length} cities)</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No pre-sale movies currently</p>
                    )}
                </div>
            </div>

            {/* Age Rating */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">👤 Age Rating Distribution</h3>
                <div className="flex gap-4">
                    {Object.entries(stats.ageCounts).map(([rating, count]) => {
                        const color = rating === 'SU' ? '#22c55e' : rating === 'R' ? '#eab308' : rating === 'D' ? '#ef4444' : '#6b7280';
                        const total = Object.values(stats.ageCounts).reduce((a, b) => a + b, 0);
                        return (
                            <div key={rating} className="flex-1 text-center">
                                <div
                                    className="text-3xl font-bold mb-1"
                                    style={{ color }}
                                >
                                    {count}
                                </div>
                                <div className="text-sm text-gray-400">{rating}</div>
                                <div className="text-xs text-gray-500">{Math.round(count / total * 100)}%</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
