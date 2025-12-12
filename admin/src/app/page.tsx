'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Theatre, ScraperRun } from '@/types';

export default function AdminDashboard() {
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch theatres
        const theatresSnap = await getDocs(collection(db, 'theatres'));
        const theatresData: Theatre[] = theatresSnap.docs.map(doc => {
          const data = doc.data();
          return {
            theatre_id: data.theatre_id || doc.id,
            name: data.name || '',
            merchant: data.merchant || '',
            city: data.city || '',
            address: data.address || '',
            lat: data.lat,
            lng: data.lng,
            place_id: data.place_id,
            room_types: data.room_types || [],
            last_seen: data.last_seen || '',
            created_at: data.created_at || '',
            updated_at: data.updated_at || ''
          };
        });
        setTheatres(theatresData);

        // Fetch recent scraper runs
        const runsQuery = query(
          collection(db, 'scraper_runs'),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const runsSnap = await getDocs(runsQuery);
        const runsData = runsSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as ScraperRun[];
        setRuns(runsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Get unique cities
  const cities = [...new Set(theatres.map(t => t.city))].sort();

  // Filter theatres
  const filteredTheatres = theatres.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !selectedCity || t.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  // Stats
  const stats = {
    totalTheatres: theatres.length,
    totalCities: cities.length,
    withGeocoding: theatres.filter(t => t.lat && t.lng).length,
    merchants: [...new Set(theatres.map(t => t.merchant))].length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-400">🎬 CineRadar Admin</h1>
          <span className="text-gray-400 text-sm">
            Last updated: {runs[0]?.timestamp || 'Never'}
          </span>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-purple-400">{stats.totalTheatres}</div>
            <div className="text-gray-400 text-sm">Total Theatres</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-blue-400">{stats.totalCities}</div>
            <div className="text-gray-400 text-sm">Cities</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-green-400">{stats.withGeocoding}</div>
            <div className="text-gray-400 text-sm">With Geocoding</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-amber-400">{stats.merchants}</div>
            <div className="text-gray-400 text-sm">Merchants</div>
          </div>
        </div>

        {/* Recent Scraper Runs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-8">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-lg font-semibold">📊 Recent Scraper Runs</h2>
          </div>
          <div className="p-4">
            {runs.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No scraper runs yet</div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${run.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-sm">{run.date}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <span>{run.movies} movies</span>
                      <span>{run.cities} cities</span>
                      <span>{run.theatres_synced} theatres</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Theatre List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap gap-4 items-center justify-between">
            <h2 className="text-lg font-semibold">🏠 Theatres ({filteredTheatres.length})</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search theatres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Theatre</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Chain</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">City</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Room Types</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Geocoded</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredTheatres.slice(0, 50).map((theatre) => (
                  <tr key={theatre.theatre_id} className="border-t border-gray-700 hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{theatre.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{theatre.address}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${theatre.merchant === 'XXI' ? 'bg-amber-600/80' :
                        theatre.merchant === 'CGV' ? 'bg-red-600/80' :
                          'bg-blue-600/80'
                        }`}>
                        {theatre.merchant}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{theatre.city}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {theatre.room_types?.slice(0, 3).map((type, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                            {type}
                          </span>
                        ))}
                        {theatre.room_types?.length > 3 && (
                          <span className="text-xs text-gray-500">+{theatre.room_types.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {theatre.lat && theatre.lng ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {theatre.last_seen?.split('T')[0] || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTheatres.length > 50 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                Showing 50 of {filteredTheatres.length} theatres
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
