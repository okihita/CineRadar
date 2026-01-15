// Filter bar for CityShowtimes (city jump, chain toggles, time legend)

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
        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-4">
                {/* City Quick Jump */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">🏙️ Jump to:</span>
                    <select
                        value={selectedCity}
                        onChange={(e) => onCityJump(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="" className="bg-gray-900">Select city...</option>
                        {cities.map(city => (
                            <option key={city} value={city} className="bg-gray-900">{city}</option>
                        ))}
                    </select>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-white/20" />

                {/* Chain Filters */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">🎬 Chains:</span>
                    {availableChains.map(chain => (
                        <button
                            key={chain}
                            onClick={() => toggleChain(chain)}
                            className={`px-3 py-1 text-xs rounded-full transition-all ${isChainEnabled(chain)
                                ? chain === 'XXI' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50 shadow-lg shadow-blue-500/20'
                                    : chain === 'CGV' ? 'bg-red-500/30 text-red-300 border border-red-500/50 shadow-lg shadow-red-500/20'
                                        : chain === 'Cinépolis' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 shadow-lg shadow-yellow-500/20'
                                            : 'bg-gray-500/30 text-gray-300 border border-gray-500/50'
                                : 'bg-white/5 text-gray-500 border border-white/10 line-through'
                                }`}
                        >
                            {chain}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-white/20" />

                {/* Time Legend */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>🌅 Morning</span>
                    <span>☀️ Afternoon</span>
                    <span>🌆 Evening</span>
                    <span>🌙 Night</span>
                </div>
            </div>
        </div>
    );
}
