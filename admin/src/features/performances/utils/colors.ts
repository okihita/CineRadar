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

/**
 * Returns Tailwind CSS classes for background color based on occupancy percentage
 */
export function getOccupancyBg(pct: number): string {
  if (pct >= 50) return "bg-green-500/10 border-green-500/20";
  if (pct >= 20) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}
