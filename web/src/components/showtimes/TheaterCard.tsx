// Theater card component for displaying theatre details and showtimes

import { getTimeStyle, getTimeIcon, getTimeOfDay } from '@/lib/showtime-utils';
import { TheaterSchedule } from '@/types';
import { CHAIN_COLORS, ChainName } from '@/lib/constants';

interface TheaterCardProps {
    theater: TheaterSchedule;
    isBestValue: boolean;
    isMostShowtimes: boolean;
    showMostShowtimesBadge: boolean;
}

export default function TheaterCard({ theater, isBestValue, isMostShowtimes, showMostShowtimesBadge }: TheaterCardProps) {
    const chainColor = CHAIN_COLORS[theater.merchant as ChainName] || '#9CA3AF';

    return (
        <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-white text-base tracking-tight">{theater.theatre_name}</h4>
                        {isBestValue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-500/30 shadow-sm">
                                💰 Best Value
                            </span>
                        )}
                        {isMostShowtimes && showMostShowtimesBadge && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-purple-500/15 text-purple-300 rounded-full border border-purple-500/30 shadow-sm">
                                🎬 Most Showtimes
                            </span>
                        )}
                    </div>
                    {theater.address && (
                        <p className="text-xs text-gray-400 line-clamp-1">{theater.address}</p>
                    )}
                </div>

                <span
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold border backdrop-blur-sm shadow-sm flex-shrink-0"
                    style={{
                        backgroundColor: `${chainColor}20`,
                        borderColor: `${chainColor}50`,
                        color: '#ffffff',
                    }}
                >
                    <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: chainColor }}
                    />
                    {theater.merchant}
                </span>
            </div>

            <div className="space-y-3">
                {(theater.rooms || []).map((room, idx) => (
                    <div key={idx} className="bg-white/[0.03] rounded-xl p-3.5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="text-xs font-semibold text-gray-300 tracking-wide uppercase">{room.category || 'Standard Hall'}</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">{room.price}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Past showtimes (grayed out) */}
                            {room.past_showtimes?.map((time: string, timeIdx: number) => (
                                <span
                                    key={`past-${timeIdx}`}
                                    className="px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium bg-white/[0.03] border border-white/5 text-gray-500 line-through cursor-not-allowed select-none"
                                    title="Past showtime"
                                >
                                    {time}
                                </span>
                            ))}
                            {/* Available showtimes */}
                            {(room.showtimes || []).map((time: string, timeIdx: number) => (
                                <span
                                    key={timeIdx}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm rounded-lg font-bold cursor-pointer transition-all duration-200 bg-gradient-to-r ${getTimeStyle(time)} hover:scale-105 hover:shadow-lg shadow-md active:scale-95`}
                                    title={`${getTimeIcon(time)} ${getTimeOfDay(time)} slot`}
                                >
                                    <span>{time}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

