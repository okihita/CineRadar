// Sparkline component for admission history

interface AdmissionSparklineProps {
    history: { date: string; admissions: number }[];
}

export default function AdmissionSparkline({ history }: AdmissionSparklineProps) {
    if (!history || history.length === 0) return null;

    // Fill in last 7 days if history is incomplete
    const filledHistory = Array(7).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('en-CA');
        const match = history.find(h => h.date === dateStr);
        return { date: dateStr, val: match ? match.admissions : 0 };
    });

    const max = Math.max(...filledHistory.map(h => h.val), 10); // Min max reference

    return (
        <div className="flex flex-col items-end">
            <div className="flex items-end gap-1 h-8">
                {filledHistory.map((item, i) => (
                    <div
                        key={i}
                        className={`w-1.5 rounded-t transition-all ${item.val > 0 ? 'bg-gradient-to-t from-green-500 to-emerald-400' : 'bg-white/5'}`}
                        style={{ height: `${Math.max((item.val / max) * 100, 10)}%` }}
                        title={`${item.date}: ${item.val.toLocaleString()} admissions`}
                    />
                ))}
            </div>
            <span className="text-[10px] text-gray-500 font-mono mt-1">7 DAYS TREND</span>
        </div>
    );
}
