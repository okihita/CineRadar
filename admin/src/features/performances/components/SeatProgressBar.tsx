/**
 * SeatProgressBar - Stacked progress bar showing seat breakdown
 *
 * Visualizes three categories:
 * - Blocked (red): Seats that were unavailable before sales (broken/blocked)
 * - Sold (green): Actual tickets sold
 * - Available (gray): Seats still available for purchase
 */

interface SeatProgressBarProps {
  totalSeats: number;
  blockedSeats: number;
  soldSeats: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SeatProgressBar({
  totalSeats,
  blockedSeats,
  soldSeats,
  showLabels = true,
  size = 'md',
}: SeatProgressBarProps) {
  const availableSeats = totalSeats - blockedSeats - soldSeats;

  // Calculate percentages
  const blockedPct = totalSeats > 0 ? (blockedSeats / totalSeats) * 100 : 0;
  const soldPct = totalSeats > 0 ? (soldSeats / totalSeats) * 100 : 0;

  // Size classes
  const heightClass = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }[size];

  return (
    <div className="w-full">
      {/* Stacked progress bar */}
      <div className={`relative w-full bg-gray-200 rounded-full overflow-hidden ${heightClass}`}>
        {/* Available (base layer - full width) */}
        <div
          className="absolute inset-0 bg-gray-200"
          style={{ width: '100%' }}
        />

        {/* Blocked (red - left side) */}
        {blockedSeats > 0 && (
          <div
            className="absolute inset-0 bg-red-400"
            style={{ width: `${blockedPct}%` }}
          />
        )}

        {/* Sold (green - after blocked) */}
        {soldSeats > 0 && (
          <div
            className="absolute inset-0 bg-green-500"
            style={{ left: `${blockedPct}%`, width: `${soldPct}%` }}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between mt-1 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-red-400"></span>
            <span>{blockedSeats} blocked</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-green-500"></span>
            <span>{soldSeats} sold</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-gray-300"></span>
            <span>{availableSeats} available</span>
          </span>
        </div>
      )}
    </div>
  );
}
