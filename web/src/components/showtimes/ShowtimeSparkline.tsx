'use client';

interface ShowtimeSparklineProps {
    showtimes: string[];
}

export default function ShowtimeSparkline({ showtimes = [] }: ShowtimeSparklineProps) {
    // Count showtimes per hour bucket (10:00 to 23:00 -> 14 buckets)
    const hourCounts = Array(14).fill(0);
    let totalCount = 0;

    showtimes.forEach(time => {
        if (!time || typeof time !== 'string') return;
        const parts = time.split(':');
        const hour = parseInt(parts[0], 10);
        if (!isNaN(hour)) {
            if (hour >= 10 && hour <= 23) {
                hourCounts[hour - 10]++;
                totalCount++;
            } else if (hour < 10 && hour >= 8) {
                // Early morning mapped to 10:00 slot
                hourCounts[0]++;
                totalCount++;
            } else if (hour === 0 || hour === 24) {
                // Midnight show mapped to late night slot
                hourCounts[13]++;
                totalCount++;
            }
        }
    });

    const max = Math.max(...hourCounts, 1);
    const hasData = totalCount > 0;

    return (
        <div className="flex items-end gap-[3px] h-7 w-full max-w-[150px] pt-1" role="img" aria-label={`Hourly showtime density (${totalCount} total showtimes)`}>
            {hourCounts.map((count, i) => {
                const hour = i + 10;
                const formattedHour = `${hour.toString().padStart(2, '0')}:00`;
                const heightPercent = hasData && count > 0 ? Math.max((count / max) * 100, 20) : 12;

                return (
                    <div
                        key={i}
                        className="group/bar relative flex-1 flex items-end h-full cursor-pointer"
                    >
                        <div
                            className={`w-full rounded-t-[2px] transition-all duration-300 ${
                                count > 0
                                    ? 'bg-gradient-to-t from-purple-500 via-pink-500 to-rose-400 group-hover/bar:from-purple-400 group-hover/bar:to-rose-300 shadow-[0_0_6px_rgba(236,72,153,0.3)] group-hover/bar:shadow-[0_0_10px_rgba(236,72,153,0.6)]'
                                    : 'bg-white/10 group-hover/bar:bg-white/20'
                            }`}
                            style={{
                                height: `${heightPercent}%`,
                                minHeight: count > 0 ? '6px' : '3px'
                            }}
                        />
                        {/* Custom Micro-Tooltip */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-950/95 border border-white/20 rounded text-sm font-mono text-white whitespace-nowrap opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-opacity z-30 shadow-lg">
                            {formattedHour}: <span className="font-bold text-pink-400">{count}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


