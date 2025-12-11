interface StatsCardProps {
    icon: string;
    label: string;
    value: string | number;
    subValue?: string;
    color: string;
}

export default function StatsCard({ icon, label, value, subValue, color }: StatsCardProps) {
    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-[1px]`}>
            <div className="h-full rounded-2xl bg-slate-900/90 p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs uppercase tracking-wider text-gray-400">{label}</span>
                </div>
                <div className="mt-3">
                    <p className="text-2xl font-bold text-white truncate">{value}</p>
                    {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
                </div>
            </div>
        </div>
    );
}
