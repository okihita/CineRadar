import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TrueAudienceBadgeProps {
  audienceCount: number;
  totalSeats: number;
  rawOccupancyPct?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TrueAudienceBadge({
  audienceCount,
  totalSeats,
  rawOccupancyPct,
  size = 'sm',
}: TrueAudienceBadgeProps) {
  const trueOccupancyPct = totalSeats > 0 ? (audienceCount / totalSeats) * 100 : 0;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  // Determine badge color based on true occupancy
  const getBadgeVariant = (): 'default' | 'secondary' | 'outline' => {
    if (trueOccupancyPct >= 70) return 'default';
    if (trueOccupancyPct >= 40) return 'secondary';
    return 'outline';
  };

  return (
    <Badge
      variant={getBadgeVariant()}
      className={cn(
        sizeClasses[size],
        'flex items-center gap-1 font-mono'
      )}
      title={`True audience: ${audienceCount} of ${totalSeats} (${trueOccupancyPct.toFixed(1)}%)${rawOccupancyPct !== undefined ? `\nRaw occupancy: ${rawOccupancyPct.toFixed(1)}%` : ''}`}
    >
      <span className="text-green-600 dark:text-green-400">●</span>
      <span className="font-medium">{audienceCount}</span>
      <span className="opacity-60 text-[10px]">({trueOccupancyPct.toFixed(0)}%)</span>
    </Badge>
  );
}
