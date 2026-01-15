// Theater card component for displaying theatre details and showtimes

import { getTimeStyle, getTimeIcon, getTimeOfDay, TheaterSchedule } from '@/lib/showtime-utils';

interface TheaterCardProps {
    theater: TheaterSchedule;
    isBestValue: boolean;
    isMostShowtimes: boolean;
    showMostShowtimesBadge: boolean;
}

export default function TheaterCard({ theater, isBestValue, isMostShowtimes, showMostShowtimesBadge }: TheaterCardProps) {
    return (
        <div className="p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-white">{theater.theatre_name}</h4>
                        {isBestValue && (
                            <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                                💰 Best Value
                            </span>
                        )}
                        {isMostShowtimes && showMostShowtimesBadge && (
                            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                                🎬 Most Showtimes
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{theater.address}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-semibold ${theater.merchant === 'XXI' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    theater.merchant === 'CGV' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        theater.merchant === 'Cinépolis' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                    {theater.merchant}
                </span>
            </div>

            <div className="space-y-3">
                {theater.rooms.map((room, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg p-3 border-l-4 border-purple-500">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-300">{room.category}</span>
                            <span className="text-sm font-bold text-emerald-400">{room.price}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Past showtimes (grayed out) */}
                            {room.past_showtimes?.map((time: string, timeIdx: number) => (
                                <span
                                    key={`past-${timeIdx}`}
                                    className="px-3 py-1.5 text-sm rounded-lg font-medium 
                                    bg-gray-700/30 text-gray-500 line-through cursor-not-allowed"
                                    title="Past showtime"
                                >
                                    {time}
                                </span>
                            ))}
                            {/* Available showtimes */}
                            {room.showtimes?.map((time: string, timeIdx: number) => (
                                <span
                                    key={timeIdx}
                                    className={`px-3 py-1.5 text-sm rounded-lg font-medium cursor-pointer transition-all 
                                    bg-gradient-to-r ${getTimeStyle(time)} 
                                    hover:scale-105 hover:shadow-lg shadow-md`}
                                    title={`${getTimeIcon(time)} ${getTimeOfDay(time)}`}
                                >
                                    {time}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
