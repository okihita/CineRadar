'use client';

import { useMemo } from 'react';
import { TrendingUp, BarChart3, Target, Ticket, Lightbulb, Sparkles, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from '@/i18n';

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
    genres?: string[];
    poster?: string;
    age_category?: string;
    country?: string;
    merchants?: string[];
    cities?: string[];
    is_presale?: boolean;
    schedules?: Record<string, TheaterSchedule[]>;
}

interface MovieInsightsProps {
    movie: Movie;
    allMovies?: Movie[];
}

// Performance tier calculation
function getPerformanceTier(movie: Movie, allMovies: Movie[] = []): {
    tier: 'blockbuster' | 'strong' | 'moderate' | 'limited' | 'presale';
    score: number;
    percentile: number;
} {
    if (movie.is_presale) {
        return { tier: 'presale', score: 0, percentile: 0 };
    }

    const nonPresale = (allMovies || []).filter(m => !m.is_presale);
    const movieCitiesCount = movie.cities?.length || 0;
    const maxCities = Math.max(1, ...(nonPresale.length > 0 ? nonPresale.map(m => m.cities?.length || 0) : [movieCitiesCount || 1]));
    const cityScore = Math.min(1, movieCitiesCount / maxCities);

    // Calculate showtime density if available
    let showtimeScore = 0;
    if (movie.schedules) {
        const totalShowtimes = Object.values(movie.schedules).reduce((acc, theaters) => {
            return acc + (theaters || []).reduce((sum, t) => {
                return sum + (t.rooms || []).reduce((s, r) => s + (r.showtimes?.length || 0), 0);
            }, 0);
        }, 0);
        const allShowtimes = (allMovies || []).filter(m => m.schedules).map(m => {
            return Object.values(m.schedules!).reduce((acc, theaters) => {
                return acc + (theaters || []).reduce((sum, t) => {
                    return sum + (t.rooms || []).reduce((s, r) => s + (r.showtimes?.length || 0), 0);
                }, 0);
            }, 0);
        });
        const maxShowtimes = Math.max(...allShowtimes, 1);
        showtimeScore = Math.min(1, totalShowtimes / maxShowtimes);
    }

    // Calculate theatre diversity
    const merchantCount = movie.merchants?.length || 0;
    const chainDiversity = Math.min(1, merchantCount / 3);

    // Weighted score
    const score = (cityScore * 0.5) + (showtimeScore * 0.35) + (chainDiversity * 0.15);

    // Calculate percentile
    const allScores = nonPresale.map(m => {
        const cs = (m.cities?.length || 0) / maxCities;
        return cs;
    }).sort((a, b) => a - b);
    const percentile = allScores.length > 0
        ? Math.round((allScores.filter(s => s <= cityScore).length / allScores.length) * 100)
        : 50;

    // Determine tier
    let tier: 'blockbuster' | 'strong' | 'moderate' | 'limited' = 'limited';
    if (score > 0.7) tier = 'blockbuster';
    else if (score > 0.4) tier = 'strong';
    else if (score > 0.2) tier = 'moderate';

    return { tier, score: Math.round(score * 100), percentile };
}

// Generate insights
function generateInsights(movie: Movie, allMovies: Movie[] = []): {
    description: string;
    prediction: string;
    factors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
    recommendations: string[];
} {
    const perf = getPerformanceTier(movie, allMovies);
    const factors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[] = [];
    const recommendations: string[] = [];

    const genres = movie.genres || [];
    const cities = movie.cities || [];
    const merchants = movie.merchants || [];
    const title = movie.title || 'This film';
    const merchantStr = merchants.length > 0 ? merchants.join(', ') : 'leading cinema';

    // Genre analysis
    const popularGenres = ['Action', 'Comedy', 'Horror', 'Drama'];
    const hasPopularGenre = genres.some(g => popularGenres.includes(g));
    if (genres.length > 0) {
        if (hasPopularGenre) {
            factors.push({
                factor: 'Genre Appeal',
                impact: 'positive',
                detail: `${genres.join(', ')} resonates strongly with Indonesian moviegoers`
            });
        } else {
            factors.push({
                factor: 'Niche Genre',
                impact: 'neutral',
                detail: `${genres.join(', ')} appeals to specialized audience demographics`
            });
        }
    }

    // Coverage analysis
    if (cities.length > 50) {
        factors.push({
            factor: 'Wide Distribution',
            impact: 'positive',
            detail: `Playing across ${cities.length} cities indicates strong nationwide demand`
        });
    } else if (cities.length > 20) {
        factors.push({
            factor: 'Moderate Distribution',
            impact: 'neutral',
            detail: `Available in ${cities.length} cities, representative of mainstream theatrical runs`
        });
    } else {
        factors.push({
            factor: 'Selective Release',
            impact: 'negative',
            detail: `Current footprint in ${cities.length} cities represents limited market exposure`
        });
        recommendations.push('Check nearby metro areas if your local cinema does not list schedules');
    }

    // Chain analysis
    if (merchants.length >= 3) {
        factors.push({
            factor: 'Multi-Chain Support',
            impact: 'positive',
            detail: `Screens across ${merchantStr} for maximum audience reach`
        });
    } else if (merchants.length === 1) {
        factors.push({
            factor: 'Exclusive Chain Deal',
            impact: 'neutral',
            detail: `Currently exclusive to ${merchants[0]} theatres`
        });
    }

    // Age rating analysis
    if (movie.age_category === 'SU') {
        factors.push({
            factor: 'All-Ages (SU)',
            impact: 'positive',
            detail: 'Universal rating captures family, teen, and children demographics'
        });
    } else if (movie.age_category === '13+') {
        factors.push({
            factor: 'Teen-Friendly (13+)',
            impact: 'positive',
            detail: 'Optimal rating tier for weekend youth and student attendance'
        });
    } else if (movie.age_category === '17+' || movie.age_category === '21+' || movie.age_category === 'D') {
        factors.push({
            factor: 'Mature Demographic',
            impact: 'neutral',
            detail: 'Targeted to mature viewers; strong conversion for evening/late slots'
        });
    }

    // Origin analysis
    if (movie.country?.includes('Indonesia') || movie.country?.includes('ID')) {
        factors.push({
            factor: 'Domestic Production',
            impact: 'positive',
            detail: 'Local Indonesian releases consistently exhibit high box-office loyalty'
        });
    } else if (movie.country?.includes('US') || movie.country?.includes('USA')) {
        factors.push({
            factor: 'Hollywood Release',
            impact: 'neutral',
            detail: 'Established global franchise appeal with steady weekend draw'
        });
    }

    // Pre-sale status
    if (movie.is_presale) {
        factors.push({
            factor: 'Pre-Sale Momentum',
            impact: 'positive',
            detail: 'Advance ticket sales enabled with high reservation velocity'
        });
        recommendations.push('Reserve prime middle-row seats early to avoid sold-out shows');
    }

    // Showtime density analysis
    if (movie.schedules) {
        const totalShowtimes = Object.values(movie.schedules).reduce((acc, theaters) => {
            return acc + (theaters || []).reduce((sum, t) => {
                return sum + (t.rooms || []).reduce((s, r) => s + (r.showtimes?.length || 0), 0);
            }, 0);
        }, 0);

        if (totalShowtimes > 500) {
            factors.push({
                factor: 'High Screen Allocation',
                impact: 'positive',
                detail: `${totalShowtimes.toLocaleString()} daily screenings indicates top exhibitor priority`
            });
        } else if (totalShowtimes > 100) {
            factors.push({
                factor: 'Standard Screen Capacity',
                impact: 'neutral',
                detail: `${totalShowtimes.toLocaleString()} daily screenings available across regions`
            });
        }
    }

    // Generate description
    let description = '';
    if (movie.is_presale) {
        description = `${title} is currently in its pre-sale window, building advance anticipation. Screening across ${cities.length} cities in ${merchantStr} theatres.`;
    } else if (perf.tier === 'blockbuster') {
        description = `${title} is dominating cinema screens with top-tier theatrical distribution across ${cities.length} cities nationwide.`;
    } else if (perf.tier === 'strong') {
        description = `${title} commands solid nationwide distribution with strong showtime density across ${cities.length} cities.`;
    } else {
        description = `${title} maintains a focused distribution footprint across ${cities.length} cities in Indonesia.`;
    }

    // Generate prediction
    let prediction = '';
    if (movie.is_presale) {
        prediction = `Expect peak opening weekend demand. Current presale availability in ${cities.length} cities indicates strong exhibitor confidence.`;
    } else if (perf.tier === 'blockbuster') {
        prediction = `Top market performer with ${perf.percentile}th percentile coverage. Strong occupancy expected across prime evening slots for the next 2-3 weeks.`;
    } else if (perf.tier === 'strong') {
        prediction = `Solid multi-week run projected. Outperforming ${perf.percentile}% of current titles, expected to retain main auditoriums through next weekend.`;
    } else if (perf.tier === 'moderate') {
        prediction = `Stable release trajectory. Screen count may taper after opening cycle, so advance booking is recommended for popular time slots.`;
    } else {
        prediction = `Compact theatrical window likely. May rotate out of smaller city venues sooner; recommend watching within the current week.`;
    }

    // Add peak evening recommendation
    if (movie.schedules) {
        const showtimes = Object.values(movie.schedules).flatMap(theaters =>
            (theaters || []).flatMap(t => (t.rooms || []).flatMap(r => r.showtimes || []))
        );
        const eveningShows = showtimes.filter(t => {
            const hour = parseInt(t.split(':')[0], 10);
            return hour >= 18 && hour <= 21;
        }).length;
        if (showtimes.length > 0 && eveningShows > showtimes.length * 0.3) {
            recommendations.push('Peak evening slots (18:00–21:00) represent high occupancy — book ahead');
        }
    }

    return { description, prediction, factors, recommendations };
}

export default function MovieInsights({ movie, allMovies = [] }: MovieInsightsProps) {
    const { t } = useTranslation();
    const insights = useMemo(() => generateInsights(movie, allMovies), [movie, allMovies]);
    const performance = useMemo(() => getPerformanceTier(movie, allMovies), [movie, allMovies]);

    const tierConfig = {
        blockbuster: {
            badgeClass: 'from-amber-500 via-orange-500 to-rose-600 shadow-amber-500/20 text-white',
            label: 'Blockbuster Scale',
            icon: TrendingUp,
        },
        strong: {
            badgeClass: 'from-emerald-500 to-teal-600 shadow-emerald-500/20 text-white',
            label: 'Strong Performer',
            icon: BarChart3,
        },
        moderate: {
            badgeClass: 'from-blue-500 to-indigo-600 shadow-blue-500/20 text-white',
            label: 'Moderate Release',
            icon: BarChart3,
        },
        limited: {
            badgeClass: 'from-gray-600 to-slate-700 shadow-gray-500/20 text-gray-100',
            label: 'Selective Distribution',
            icon: Target,
        },
        presale: {
            badgeClass: 'from-purple-500 to-pink-600 shadow-purple-500/20 text-white',
            label: 'Pre-Sale Active',
            icon: Ticket,
        }
    };

    const currentTier = tierConfig[performance.tier] || tierConfig.moderate;
    const TierIcon = currentTier.icon;

    return (
        <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/10 p-4 sm:p-5 backdrop-blur-md shadow-xl">
            {/* Header: AI Badge & Tier */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{t('insights.title')}</h3>
                        <p className="text-[11px] text-gray-400">{t('insights.subtitle')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${currentTier.badgeClass} font-bold text-xs shadow-lg flex items-center gap-1.5`}>
                        <TierIcon className="w-3.5 h-3.5" />
                        <span>{currentTier.label}</span>
                    </div>
                    {performance.tier !== 'presale' && performance.percentile > 0 && (
                        <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                            {t('insights.topCoverage', { percentile: Math.max(1, 100 - performance.percentile) })}
                        </span>
                    )}
                </div>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* AI Overview */}
                <div className="p-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-xl border border-white/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>{t('insights.marketOverview')}</span>
                        </div>
                        <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{insights.description}</p>
                    </div>
                </div>

                {/* Prediction / Demand Projection */}
                <div className="p-3.5 bg-gradient-to-br from-purple-900/20 via-pink-950/20 to-transparent hover:from-purple-900/30 transition-all rounded-xl border border-purple-500/20 flex flex-col justify-between shadow-inner">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-pink-300">
                            <TierIcon className="w-3.5 h-3.5" />
                            <span>{t('insights.demandProjection')}</span>
                        </div>
                        <p className="text-gray-200 text-xs sm:text-sm leading-relaxed">{insights.prediction}</p>
                    </div>
                </div>

                {/* Contributing Factors */}
                <div className="p-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                        <Info className="w-3.5 h-3.5" />
                        <span>{t('insights.factors')}</span>
                    </div>
                    <div className="space-y-2">
                        {insights.factors.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                {f.impact === 'positive' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                ) : f.impact === 'negative' ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5 mx-1" />
                                )}
                                <span className="text-gray-300 leading-snug">
                                    <strong className="font-semibold text-white mr-1">{f.factor}:</strong>
                                    {f.detail}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommendations & Tips */}
                {insights.recommendations.length > 0 && (
                    <div className="p-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                            <span>{t('insights.recommendations')}</span>
                        </div>
                        <ul className="space-y-2">
                            {insights.recommendations.map((rec, i) => (
                                <li key={i} className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-yellow-400 font-bold">•</span>
                                    <span className="leading-snug">{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
