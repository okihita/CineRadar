import { redirect } from "next/navigation";

// Get today's date in Jakarta timezone (YYYY-MM-DD)
function getTodayJakarta(): string {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

/**
 * Schedules Page - Redirects to date-based URL
 * 
 * This page redirects /schedules -> /schedules/{today}
 * For date-specific views, use /schedules/yyyy-mm-dd directly
 */
export default function SchedulesPage() {
    const today = getTodayJakarta();
    redirect(`/schedules/${today}`);
}
