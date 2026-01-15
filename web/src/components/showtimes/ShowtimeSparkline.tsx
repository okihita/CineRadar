// Sparkline component for showtime density

interface ShowtimeSparklineProps {
    showtimes: string[];
}

export default function ShowtimeSparkline({ showtimes }: ShowtimeSparklineProps) {
    // Count showtimes per hour (10-23)
    const hourCounts = Array(14).fill(0); // Hours 10-23
    showtimes.forEach(time => {
        const hour = parseInt(time.split(':')[0], 10);
        if (hour >= 10 && hour <= 23) {
            hourCounts[hour - 10]++;
        }
    });
    const max = Math.max(...hourCounts, 1);

    return (
        <div className="flex items-end gap-0.5 h-6">
            {hourCounts.map((count, i) => (
                <div
                    key={i}
                    className={`w-1.5 rounded-t transition-all ${count > 0 ? 'bg-gradient-to-t from-purple-500 to-pink-500' : 'bg-white/10'}`}
                    style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '4px' : '2px' }}
                    title={`${i + 10}:00 - ${count} showtimes`}
                />
            ))}
        </div>
    );
}
