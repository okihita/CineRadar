import { useMemo, useState } from 'react';
import { MovieWithStats } from './useScheduleData';
import { ChainName } from '@/lib/constants';

export interface FilterState {
    search: string;
    genres: Set<string>;
    chains: Set<ChainName>;
    presaleOnly: boolean;
}

export function useScheduleFilters(movies: MovieWithStats[]) {
    const [search, setSearch] = useState('');
    const [genres, setGenres] = useState<Set<string>>(new Set());
    const [chains, setChains] = useState<Set<ChainName>>(new Set());
    const [presaleOnly, setPresaleOnly] = useState(false);

    // Derive available filter options from the full movie list
    const availableGenres = useMemo(() => {
        const set = new Set<string>();
        for (const m of movies) {
            for (const g of m.genres || []) set.add(g);
        }
        return Array.from(set).sort();
    }, [movies]);

    const availableChains = useMemo(() => {
        const set = new Set<ChainName>();
        for (const m of movies) {
            for (const c of m.merchants || []) {
                if (['XXI', 'CGV', 'Cinépolis', 'FLIX'].includes(c)) {
                    set.add(c as ChainName);
                }
            }
        }
        return Array.from(set).sort();
    }, [movies]);

    // Filter movies
    const filteredMovies = useMemo(() => {
        const query = search.toLowerCase().trim();

        return movies.filter((m) => {
            // Search
            if (query && !m.title.toLowerCase().includes(query)) return false;

            // Genre filter
            if (genres.size > 0) {
                const movieGenres = new Set(m.genres || []);
                let hasMatch = false;
                for (const g of genres) {
                    if (movieGenres.has(g)) { hasMatch = true; break; }
                }
                if (!hasMatch) return false;
            }

            // Chain filter
            if (chains.size > 0) {
                const movieChains = new Set(m.merchants || []);
                let hasMatch = false;
                for (const c of chains) {
                    if (movieChains.has(c)) { hasMatch = true; break; }
                }
                if (!hasMatch) return false;
            }

            // Presale
            if (presaleOnly && !m.is_presale) return false;

            return true;
        });
    }, [movies, search, genres, chains, presaleOnly]);

    const hasActiveFilters = search !== '' || genres.size > 0 || chains.size > 0 || presaleOnly;

    const toggleGenre = (genre: string) => {
        setGenres((prev) => {
            const next = new Set(prev);
            if (next.has(genre)) next.delete(genre);
            else next.add(genre);
            return next;
        });
    };

    const toggleChain = (chain: ChainName) => {
        setChains((prev) => {
            const next = new Set(prev);
            if (next.has(chain)) next.delete(chain);
            else next.add(chain);
            return next;
        });
    };

    const clearFilters = () => {
        setSearch('');
        setGenres(new Set());
        setChains(new Set());
        setPresaleOnly(false);
    };

    return {
        search, setSearch,
        genres, toggleGenre,
        chains, toggleChain,
        presaleOnly, setPresaleOnly,
        availableGenres,
        availableChains,
        filteredMovies,
        hasActiveFilters,
        clearFilters,
    };
}
