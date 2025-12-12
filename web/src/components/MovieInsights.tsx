'use client';

import { useMemo } from 'react';

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

interface MovieInsightsProps {
    movie: Movie;
    allMovies: Movie[];
}

// Performance tier calculation
function getPerformanceTier(movie: Movie, allMovies: Movie[]): {
    tier: 'blockbuster' | 'strong' | 'moderate' | 'limited' | 'presale';
    score: number;
    percentile: number;
} {
    if (movie.is_presale) {
        return { tier: 'presale', score: 0, percentile: 0 };
    }

    // Calculate coverage score based on cities
    const maxCities = Math.max(...allMovies.filter(m => !m.is_presale).map(m => m.cities.length));
    const cityScore = movie.cities.length / maxCities;

    // Calculate showtime density if available
    let showtimeScore = 0;
    if (movie.schedules) {
        const totalShowtimes = Object.values(movie.schedules).reduce((acc, theaters) => {
            return acc + theaters.reduce((sum, t) => {
                return sum + t.rooms.reduce((s, r) => s + r.showtimes.length, 0);
            }, 0);
        }, 0);
        const allShowtimes = allMovies.filter(m => m.schedules).map(m => {
            return Object.values(m.schedules!).reduce((acc, theaters) => {
                return acc + theaters.reduce((sum, t) => {
                    return sum + t.rooms.reduce((s, r) => s + r.showtimes.length, 0);
                }, 0);
            }, 0);
        });
        const maxShowtimes = Math.max(...allShowtimes, 1);
        showtimeScore = totalShowtimes / maxShowtimes;
    }

    // Calculate theatre diversity
    const chainDiversity = movie.merchants.length / 3; // Max 3 chains

    // Weighted score
    const score = (cityScore * 0.5) + (showtimeScore * 0.35) + (chainDiversity * 0.15);

    // Calculate percentile
    const allScores = allMovies.filter(m => !m.is_presale).map(m => {
        const cs = m.cities.length / maxCities;
        return cs;
    }).sort((a, b) => a - b);
    const percentile = Math.round((allScores.filter(s => s <= cityScore).length / allScores.length) * 100);

    // Determine tier
    let tier: 'blockbuster' | 'strong' | 'moderate' | 'limited' = 'limited';
    if (score > 0.7) tier = 'blockbuster';
    else if (score > 0.4) tier = 'strong';
    else if (score > 0.2) tier = 'moderate';

    return { tier, score: Math.round(score * 100), percentile };
}

// Generate insights
function generateInsights(movie: Movie, allMovies: Movie[]): {
    description: string;
    prediction: string;
    factors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
    recommendations: string[];
} {
    const perf = getPerformanceTier(movie, allMovies);
    const factors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[] = [];
    const recommendations: string[] = [];

    // Genre analysis
    const popularGenres = ['Action', 'Comedy', 'Horror', 'Drama'];
    const hasPopularGenre = movie.genres.some(g => popularGenres.includes(g));
    if (hasPopularGenre) {
        factors.push({
            factor: 'Genre Appeal',
            impact: 'positive',
            detail: `${movie.genres.join(', ')} resonates well with Indonesian audiences`
        });
    } else {
        factors.push({
            factor: 'Niche Genre',
            impact: 'neutral',
            detail: `${movie.genres.join(', ')} has a more targeted audience`
        });
    }

    // Coverage analysis
    if (movie.cities.length > 50) {
        factors.push({
            factor: 'Wide Distribution',
            impact: 'positive',
            detail: `Playing in ${movie.cities.length} cities indicates strong distributor confidence`
        });
    } else if (movie.cities.length > 20) {
        factors.push({
            factor: 'Moderate Distribution',
            impact: 'neutral',
            detail: `Available in ${movie.cities.length} cities, typical for mid-tier releases`
        });
    } else {
        factors.push({
            factor: 'Limited Release',
            impact: 'negative',
            detail: `Only ${movie.cities.length} cities may limit box office potential`
        });
        recommendations.push('Consider checking if expansion to more cities is planned');
    }

    // Chain analysis
    if (movie.merchants.length >= 3) {
        factors.push({
            factor: 'Multi-Chain Support',
            impact: 'positive',
            detail: `Showing on ${movie.merchants.join(', ')} maximizes audience reach`
        });
    } else if (movie.merchants.length === 1) {
        factors.push({
            factor: 'Exclusive Distribution',
            impact: 'neutral',
            detail: `Only available at ${movie.merchants[0]}, may be an exclusive deal`
        });
    }

    // Age rating analysis
    if (movie.age_category === 'SU') {
        factors.push({
            factor: 'Family Friendly',
            impact: 'positive',
            detail: 'All-ages rating opens up family and children audience segments'
        });
    } else if (movie.age_category === 'D') {
        factors.push({
            factor: 'Adult Content',
            impact: 'neutral',
            detail: 'D rating limits to adult audiences but often drives horror/thriller fans'
        });
    }

    // Origin analysis
    if (movie.country.includes('Indonesia') || movie.country.includes('ID')) {
        factors.push({
            factor: 'Local Production',
            impact: 'positive',
            detail: 'Indonesian films often outperform international releases domestically'
        });
    } else if (movie.country.includes('US') || movie.country.includes('USA')) {
        factors.push({
            factor: 'Hollywood Release',
            impact: 'neutral',
            detail: 'American productions have established audience base'
        });
    }

    // Pre-sale status
    if (movie.is_presale) {
        factors.push({
            factor: 'Pre-Sale Active',
            impact: 'positive',
            detail: 'High anticipation indicated by advance ticket sales availability'
        });
        recommendations.push('Book early for premium seats and popular showtimes');
    }

    // Showtime density analysis
    if (movie.schedules) {
        const totalShowtimes = Object.values(movie.schedules).reduce((acc, theaters) => {
            return acc + theaters.reduce((sum, t) => {
                return sum + t.rooms.reduce((s, r) => s + r.showtimes.length, 0);
            }, 0);
        }, 0);

        if (totalShowtimes > 500) {
            factors.push({
                factor: 'High Showtime Volume',
                impact: 'positive',
                detail: `${totalShowtimes.toLocaleString()} showtimes indicates strong demand`
            });
        } else if (totalShowtimes > 100) {
            factors.push({
                factor: 'Standard Scheduling',
                impact: 'neutral',
                detail: `${totalShowtimes.toLocaleString()} showtimes is typical for this release tier`
            });
        }
    }

    // Generate description
    let description = '';
    if (movie.is_presale) {
        description = `${movie.title} is currently in pre-sale phase, generating buzz ahead of release. ${movie.cities.length} cities will screen this ${movie.genres.join('/')} film across ${movie.merchants.join(', ')} theatres.`;
    } else if (perf.tier === 'blockbuster') {
        description = `${movie.title} is dominating Indonesian cinemas with top-tier distribution. This ${movie.genres.join('/')} ${movie.country} production is screening in ${movie.cities.length} cities, making it one of the widest releases currently.`;
    } else if (perf.tier === 'strong') {
        description = `${movie.title} shows strong market performance with solid coverage across major Indonesian cities. This ${movie.genres.join('/')} film is available in ${movie.cities.length} cities through ${movie.merchants.join(' and ')}.`;
    } else {
        description = `${movie.title} has a focused release strategy, targeting ${movie.cities.length} cities in Indonesia. This ${movie.genres.join('/')} production may appeal to specific audience segments.`;
    }

    // Generate prediction
    let prediction = '';
    if (movie.is_presale) {
        prediction = `📈 Expect high opening weekend demand. Current pre-sale availability in ${movie.cities.length} cities suggests distributor anticipates strong performance. Secure tickets early for preferred showtimes.`;
    } else if (perf.tier === 'blockbuster') {
        prediction = `🔥 Trending as a top performer. With ${perf.percentile}th percentile coverage, likely to maintain strong box office through next 2-3 weeks. Consider off-peak hours to avoid crowds.`;
    } else if (perf.tier === 'strong') {
        prediction = `📊 Solid theatrical run expected. Currently outperforming ${perf.percentile}% of releases. Should maintain screens for 2+ weeks in major cities.`;
    } else if (perf.tier === 'moderate') {
        prediction = `📉 Standard release trajectory. May see reduced showtimes after opening week. Book soon if interested to ensure availability.`;
    } else {
        prediction = `⚠️ Limited release window likely. With focused distribution, this title may leave theatres sooner. Watch within the next 1-2 weeks if interested.`;
    }

    // Add recommendations
    if (movie.schedules) {
        const showtimes = Object.values(movie.schedules).flatMap(theaters =>
            theaters.flatMap(t => t.rooms.flatMap(r => r.showtimes))
        );
        const eveningShows = showtimes.filter(t => {
            const hour = parseInt(t.split(':')[0], 10);
            return hour >= 18 && hour <= 21;
        }).length;
        if (eveningShows > showtimes.length * 0.3) {
            recommendations.push('Peak evening slots (6-9 PM) fill fastest - book in advance');
        }
    }

    return { description, prediction, factors, recommendations };
}

export default function MovieInsights({ movie, allMovies }: MovieInsightsProps) {
    const insights = useMemo(() => generateInsights(movie, allMovies), [movie, allMovies]);
    const performance = useMemo(() => getPerformanceTier(movie, allMovies), [movie, allMovies]);

    const tierColors = {
        blockbuster: 'from-amber-500 to-orange-600',
        strong: 'from-emerald-500 to-teal-600',
        moderate: 'from-blue-500 to-indigo-600',
        limited: 'from-gray-500 to-slate-600',
        presale: 'from-purple-500 to-pink-600'
    };

    const tierLabels = {
        blockbuster: '🔥 Blockbuster',
        strong: '📈 Strong Performer',
        moderate: '📊 Moderate Release',
        limited: '🎯 Limited Release',
        presale: '🎟️ Pre-Sale'
    };

    return (
        <div className="mt-4">
            {/* Performance Badge */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierColors[performance.tier]} text-white font-semibold text-sm shadow-lg`}>
                    {tierLabels[performance.tier]}
                </div>
                {performance.tier !== 'presale' && (
                    <div className="text-sm text-gray-400">
                        Top {100 - performance.percentile}% of current releases
                    </div>
                )}
            </div>
            {/* 2-Column Grid for Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* AI Description */}
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <span>🤖</span>
                        <h4 className="font-semibold text-white text-sm">AI Analysis</h4>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{insights.description}</p>
                </div>

                {/* Prediction */}
                <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-1">
                        <span>🔮</span>
                        <h4 className="font-semibold text-white text-sm">Prediction</h4>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">{insights.prediction}</p>
                </div>

                {/* Contributing Factors */}
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <span>📊</span>
                        <h4 className="font-semibold text-white text-sm">Key Factors</h4>
                    </div>
                    <div className="space-y-1">
                        {insights.factors.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={`mt-0.5 ${f.impact === 'positive' ? 'text-emerald-400' :
                                        f.impact === 'negative' ? 'text-red-400' : 'text-amber-400'
                                    }`}>
                                    {f.impact === 'positive' ? '▲' : f.impact === 'negative' ? '▼' : '●'}
                                </span>
                                <span className="text-gray-300">
                                    <span className="font-medium text-white">{f.factor}:</span> {f.detail}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommendations */}
                {insights.recommendations.length > 0 && (
                    <div className="p-3 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <span>💡</span>
                            <h4 className="font-semibold text-white text-sm">Tips</h4>
                        </div>
                        <ul className="space-y-1">
                            {insights.recommendations.map((rec, i) => (
                                <li key={i} className="text-gray-300 text-xs flex items-start gap-1">
                                    <span className="text-cyan-400">→</span>
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
