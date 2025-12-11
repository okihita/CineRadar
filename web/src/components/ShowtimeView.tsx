import { useState } from 'react';

interface ShowtimeViewProps {
    movieTitle: string;
    city: string;
    schedules: any[]; // Using any for now to match flexible JSON structure
    onClose: () => void;
}

export default function ShowtimeView({ movieTitle, city, schedules, onClose }: ShowtimeViewProps) {
    if (!schedules || schedules.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-400">No showtimes available for {city}</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-gray-900 w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gray-800/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{movieTitle}</h2>
                        <p className="text-purple-400 text-sm font-medium">
                            📍 Now Showing in {city} ({schedules.length} Theatres)
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {schedules.map((theatre: any) => (
                        <div key={theatre.theatre_id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-white">{theatre.theatre_name}</h3>
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                            theatre.merchant === 'XXI' ? 'bg-amber-600/80' : 
                                            theatre.merchant === 'CGV' ? 'bg-red-600/80' : 
                                            'bg-blue-600/80'
                                        }`}>
                                            {theatre.merchant}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-1">{theatre.address}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {theatre.rooms.map((room: any, idx: number) => (
                                    <div key={idx} className="bg-black/20 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-gray-300">{room.category}</span>
                                            <span className="text-xs text-gray-500">{room.price}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {room.showtimes.map((time: string) => (
                                                <button 
                                                    key={time}
                                                    className="px-3 py-1 bg-white/10 hover:bg-purple-600 hover:text-white rounded text-sm text-purple-300 transition-colors"
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
