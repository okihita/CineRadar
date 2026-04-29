import { redirect } from "next/navigation";
import { getTodayJakarta } from "@/lib/timeUtils";

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
