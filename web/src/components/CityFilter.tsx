'use client';

import { useState } from 'react';

interface CityFilterProps {
    cities: string[];
}

export default function CityFilter({ cities }: CityFilterProps) {
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [search, setSearch] = useState('');

    const filteredCities = cities.filter(city =>
        city.toLowerCase().includes(search.toLowerCase())
    );

    const handleCityChange = (city: string) => {
        setSelectedCity(city);
        // Dispatch custom event for movie grid to filter
        window.dispatchEvent(new CustomEvent('cityFilter', { detail: city }));
    };

    return (
        <div className="mb-8">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search cities..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-4 py-3 pl-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    />
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* City Dropdown */}
                <select
                    value={selectedCity}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '40px' }}
                >
                    <option value="" className="bg-slate-900">All Cities</option>
                    {filteredCities.map(city => (
                        <option key={city} value={city} className="bg-slate-900">
                            {city}
                        </option>
                    ))}
                </select>

                {selectedCity && (
                    <button
                        onClick={() => handleCityChange('')}
                        className="px-4 py-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                    >
                        <span>Clear Filter</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {selectedCity && (
                <div className="mt-4 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg inline-block">
                    <span className="text-purple-300">Showing movies in: </span>
                    <span className="text-white font-semibold">{selectedCity}</span>
                </div>
            )}
        </div>
    );
}
