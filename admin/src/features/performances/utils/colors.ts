/**
 * Centralized color utility for Performance metrics
 * Decides standard semantic coloring for Occupancy (OCR) tiers
 */

/**
 * Returns Tailwind CSS classes for text color based on occupancy percentage
 * Standard tiers:
 * - High (>= 50%): Green (Market Success)
 * - Mid (>= 20%): Amber (Steady Demand)
 * - Low (< 20%): Red (Underperforming)
 */
export function getOccupancyColor(pct: number): string {
  if (pct >= 50) return "text-green-600 dark:text-green-400";
  if (pct >= 20) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
