'use client';

import { useState, useEffect } from 'react';
import { Film, ChevronDown, ArrowLeft, LayoutGrid } from 'lucide-react';
import MovieSidebar from './MovieSidebar';
import CityShowtimes from './CityShowtimes';
import MovieCatalogGrid from './MovieCatalogGrid';

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

export interface AdmissionStats {
    total_admissions: number;
    showtimes: {
        time: string;
        city: string;
        theatre: string;
        capacity: number;
        admissions: number;
        occupancy_pct: number;
    }[];
    updated_at: string;
    history: { date: string; admissions: number }[];
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
    admissionStats?: AdmissionStats;
}

interface MovieBrowserProps {
    movies: Movie[];
    initialMovieId?: string;
}

export type ViewMode = 'catalog' | 'showtimes';

// Fetch movie schedule from Firestore
async function fetchMovieSchedule(movieId: string, date: string): Promise<Record<string, TheaterSchedule[]> | null> {
    try {
        const projectId = 'cineradar-481014';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/schedules/${date}/movies/${movieId}`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const doc = await response.json();
        const fields = doc.fields || {};

        // Parse the cities map from Firestore format
        const citiesMap = fields.cities?.mapValue?.fields || {};
        const schedules: Record<string, TheaterSchedule[]> = {};

        for (const [city, cityData] of Object.entries(citiesMap)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const theatersArray = (cityData as any)?.arrayValue?.values || [];
            schedules[city] = theatersArray.map((t: { mapValue?: { fields?: Record<string, unknown> } }) => {
                const tf = t.mapValue?.fields || {};
                return {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    theatre_id: (tf.theatre_id as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    theatre_name: (tf.theatre_name as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    merchant: (tf.merchant as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    address: (tf.address as any)?.stringValue || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    rooms: ((tf.rooms as any)?.arrayValue?.values || []).map((r: { mapValue?: { fields?: Record<string, unknown> } }) => {
                        const rf = r.mapValue?.fields || {};
                        return {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            category: (rf.category as any)?.stringValue || '',
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            price: (rf.price as any)?.stringValue || '',
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            showtimes: ((rf.showtimes as any)?.arrayValue?.values || []).map((s: { stringValue?: string }) => s.stringValue || ''),
                        };
                    }),
                };
            });
        }

        return schedules;
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return null;
    }
}

// Fetch admission stats from Firestore (Current day + 7 day history)
async function fetchMovieAdmissions(movieId: string, date: string): Promise<AdmissionStats | null> {
    try {
        const projectId = 'cineradar-481014';
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/daily_admissions`;

        // Helper to fetch a single date
        const fetchDate = async (d: string) => {
            const res = await fetch(`${baseUrl}/${d}/movies/${movieId}`);
            if (!res.ok) return null;
            return res.json();
        };

        // Generate last 7 dates
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(date);
            d.setDate(d.getDate() - i);
            dates.push(d.toLocaleDateString('en-CA'));
        }

        // Fetch all in parallel
        const results = await Promise.all(dates.map(d => fetchDate(d)));

        // Process today's data (first result)
        const todayDoc = results[0];
        const fields = todayDoc?.fields || {};

        // Helper parse integer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parseIntVal = (val: any) => parseInt(val?.integerValue || '0');

        const total = parseIntVal(fields.total_admissions);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = (fields.updated_at as any)?.stringValue || '';

        // Parse showtimes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const showtimes = ((fields.showtimes as any)?.arrayValue?.values || []).map((s: { mapValue?: { fields?: any } }) => {
            const f = s.mapValue?.fields || {};
            return {
                time: f.time?.stringValue || '',
                city: f.city?.stringValue || '',
                theatre: f.theatre?.stringValue || '',
                capacity: parseIntVal(f.capacity),
                admissions: parseIntVal(f.admissions),
                occupancy_pct: parseFloat(f.occupancy_pct?.doubleValue || '0'),
            };
        });

        // Process history
        const history = results.map((doc, i) => {
            const f = doc?.fields || {};
            return {
                date: dates[i],
                admissions: parseIntVal(f.total_admissions) // Returns 0 if doc missing
            };
        }).reverse(); // Sort oldest to newest

        return {
            total_admissions: total,
            showtimes,
            updated_at: updated,
            history
        };
    } catch (error) {
        console.error('Error fetching admissions:', error);
        return null;
    }
}

import { useTranslation } from '@/i18n';

export default function MovieBrowser({ movies, initialMovieId }: MovieBrowserProps) {
    const { t } = useTranslation();
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(() => {
        if (initialMovieId) {
            const found = movies.find(m => m.id === initialMovieId);
            if (found) return found;
        }
        return movies[0] || null;
    });
    const [movieWithSchedules, setMovieWithSchedules] = useState<Movie | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    // If user opened with initialMovieId, start in showtimes view; otherwise start in catalog grid
    const [viewMode, setViewMode] = useState<ViewMode>(() => initialMovieId ? 'showtimes' : 'catalog');
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

    // Fetch schedules when movie is selected
    useEffect(() => {
        if (!selectedMovie) {
            return;
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD

        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingSchedule(true);

        Promise.all([
            fetchMovieSchedule(selectedMovie.id, today),
            fetchMovieAdmissions(selectedMovie.id, today)
        ])
            .then(([schedules, admissionStats]) => {
                if (!cancelled) {
                    setMovieWithSchedules({
                        ...selectedMovie,
                        schedules: schedules || undefined,
                        admissionStats: admissionStats || undefined
                    });
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingSchedule(false);
                }
            });

        return () => {
            cancelled = true;
            setMovieWithSchedules(null);
        };
    }, [selectedMovie]);

    const handleSelectMovieFromCatalog = (movie: Movie) => {
        setSelectedMovie(movie);
        setViewMode('showtimes');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)]">
            {/* Navigation Tabs Bar */}
            <div className="py-2 px-3 sm:px-6 bg-black/40 border-b border-white/10 flex items-center justify-between gap-2 max-w-7xl w-full mx-auto">
                {/* Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-white/[0.05] rounded-xl border border-white/10 shadow-inner overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setViewMode('catalog')}
                        className={`px-3 py-1.5 rounded-lg text-sm sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                            viewMode === 'catalog'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{t('nav.allMovies', { count: movies.length })}</span>
                    </button>
                    <button
                        onClick={() => setViewMode('showtimes')}
                        className={`px-3 py-1.5 rounded-lg text-sm sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                            viewMode === 'showtimes'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Film className="w-3.5 h-3.5" />
                        <span>{t('nav.showtimes')}</span>
                    </button>
                </div>

                {/* Mobile Quick Selector when in Showtimes mode */}
                {viewMode === 'showtimes' && selectedMovie && (
                    <button
                        onClick={() => setIsMobileDrawerOpen(true)}
                        className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-white text-sm font-semibold shadow-md active:scale-95 transition-all max-w-[170px] truncate cursor-pointer"
                        aria-label={t('common.changeMovie')}
                    >
                        <span className="truncate font-bold">{selectedMovie.title}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
                    </button>
                )}
            </div>

            {/* Main Dynamic View Content */}
            {viewMode === 'catalog' ? (
                <MovieCatalogGrid
                    movies={movies}
                    onSelectMovie={handleSelectMovieFromCatalog}
                />
            ) : (
                <div className="flex flex-1 overflow-hidden relative">
                    {/* Desktop Persistent Sidebar */}
                    <aside className="hidden lg:block w-80 xl:w-88 flex-shrink-0 h-full border-r border-white/10 bg-black/40">
                        <MovieSidebar
                            movies={movies}
                            selectedMovie={selectedMovie}
                            onSelectMovie={setSelectedMovie}
                        />
                    </aside>

                    {/* Main Showtimes Pane */}
                    <main className="flex-1 flex flex-col overflow-hidden min-w-0 w-full bg-gray-950">
                        {/* Mobile Drill-Down Back Bar */}
                        <div className="lg:hidden flex items-center justify-between px-3.5 py-2.5 bg-black/50 border-b border-white/10">
                            <button
                                onClick={() => setViewMode('catalog')}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-300 hover:text-white bg-purple-500/15 border border-purple-500/30 px-3 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>{t('common.backToMovies')}</span>
                            </button>

                            <span className="text-sm text-gray-400 font-medium truncate max-w-[160px]">
                                {selectedMovie?.title}
                            </span>
                        </div>

                        {loadingSchedule ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center p-8">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4 text-2xl animate-spin shadow-lg">
                                        🎬
                                    </div>
                                    <p className="text-sm font-bold text-white">{t('common.loadingShowtimes')}</p>
                                    <p className="text-sm text-gray-500 mt-1">{t('common.loadingTelemetry')}</p>
                                </div>
                            </div>
                        ) : (
                            <CityShowtimes movie={movieWithSchedules} />
                        )}
                    </main>

                    {/* Mobile Slide-Over Drawer Modal */}
                    {isMobileDrawerOpen && (
                        <div className="lg:hidden fixed inset-0 z-50 flex">
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                                onClick={() => setIsMobileDrawerOpen(false)}
                            />
                            {/* Slide-over Drawer Panel */}
                            <div className="relative w-[85vw] max-w-sm bg-gray-950 h-full shadow-2xl z-10 flex flex-col border-r border-white/10">
                                <MovieSidebar
                                    movies={movies}
                                    selectedMovie={selectedMovie}
                                    onSelectMovie={(movie) => {
                                        setSelectedMovie(movie);
                                        setIsMobileDrawerOpen(false);
                                    }}
                                    onClose={() => setIsMobileDrawerOpen(false)}
                                    isMobile={true}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

