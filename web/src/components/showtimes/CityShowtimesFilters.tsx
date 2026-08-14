'use client';

import { MapPin, SlidersHorizontal } from 'lucide-react';
import { CHAIN_COLORS, ChainName } from '@/lib/constants';

interface CityShowtimesFiltersProps {
    cities: string[];
    selectedCity: string;
    onCityJump: (city: string) => void;
    availableChains: string[];
    isChainEnabled: (chain: string) => boolean;
    toggleChain: (chain: string) => void;
}

export default function CityShowtimesFilters({
    cities,
    selectedCity,
    onCityJump,
    availableChains,
    isChainEnabled,
    toggleChain,
}: CityShowtimesFiltersProps) {
    return (
        <div className="mb-6 p-3.5 sm:p-4 bg-white/[0.03] rounded-2xl border border-white/10 backdrop-blur-md shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                {/* Left side: City Jump & Chain Filters */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {/* City Quick Jump */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="city-jump-select" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            <span>Jump to:</span>
                        </label>
                        <div className="relative">
                            <select
                                id="city-jump-select"
                                value={selectedCity}
                                onChange={(e) => onCityJump(e.target.value)}
                                className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 pr-8 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:border-white/30 transition-all cursor-pointer appearance-none shadow-inner"
                            >
                                <option value="" className="bg-gray-900 text-gray-400">All Cities ({cities.length})</option>
                                {cities.map(city => (
                                    <option key={city} value={city} className="bg-gray-900 text-white">
                                        {city}
                                    </option>
                                ))}
                            </select>
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
                                ▼
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    {availableChains.length > 0 && (
                        <div className="hidden sm:block h-5 w-px bg-white/15" />
                    )}

                    {/* Chain Filters */}
                    {availableChains.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 mr-1">
                                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                                <span>Chains:</span>
                            </span>
                            {availableChains.map(chain => {
                                const isEnabled = isChainEnabled(chain);
                                const chainColor = CHAIN_COLORS[chain as ChainName] || '#9CA3AF';

                                return (
                                    <button
                                        key={chain}
                                        onClick={() => toggleChain(chain)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all duration-200 cursor-pointer ${
                                            isEnabled
                                                ? 'shadow-md backdrop-blur-sm'
                                                : 'opacity-40 bg-white/[0.02] border-white/10 text-gray-400 line-through hover:opacity-70'
                                        }`}
                                        style={isEnabled ? {
                                            backgroundColor: `${chainColor}20`,
                                            borderColor: `${chainColor}55`,
                                            color: '#ffffff',
                                        } : undefined}
                                        title={isEnabled ? `Click to hide ${chain}` : `Click to show ${chain}`}
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full transition-transform ${isEnabled ? 'scale-100' : 'scale-75 bg-gray-500'}`}
                                            style={isEnabled ? { backgroundColor: chainColor } : undefined}
                                        />
                                        {chain}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right side: Showtime Period Legend */}
                <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 w-full sm:w-auto text-[11px] text-gray-400">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Periods:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                        🌅 Morning
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300 font-medium">
                        ☀️ Afternoon
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium">
                        🌆 Evening
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium">
                        🌙 Night
                    </span>
                </div>
            </div>
        </div>
    );
}

