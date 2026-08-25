import { getPerformanceTier } from "@/lib/constants";

/**
 * Returns Tailwind CSS classes for text color based on occupancy percentage
 * Standardized across the app using 12-tier performance scale (0-30%+)
 */
export function getOccupancyColor(pct: number): string {
  return getPerformanceTier(pct).twText;
}

/**
 * Returns Tailwind bg class with soft opacity for occupancy-based backgrounds
 */
export function getOccupancyBgSoft(pct: number): string {
  return getPerformanceTier(pct).twBgSoft;
}

/**
 * Returns Tailwind border class with soft opacity for occupancy-based borders
 */
export function getOccupancyBorderSoft(pct: number): string {
  return getPerformanceTier(pct).twBorderSoft;
}
