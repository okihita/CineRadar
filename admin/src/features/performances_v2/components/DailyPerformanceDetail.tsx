import { Target, ChevronLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { MovieSummaryCard } from "./MovieSummaryCard";
import { DailyStatsBanner } from "./DailyStatsBanner";
import { ShowtimesDataFetcher } from "./ShowtimesDataFetcher";
import { ShowtimesSkeleton } from "./skeletons/ShowtimesSkeleton";
import { firestoreRestClient } from "@/lib/firestore-rest";

interface MovieSummary {
  id: string;
  movie_id: string;
  title: string;
  poster: string;
  last_updated: string;
  genres?: string;
  age_category?: string;
}

/**
 * Formats genres or age_category into a string.
 * Handles strings, arrays of strings, and arrays of objects { name: string }.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatMetadataField(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) return item.name;
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof field === "object" && "name" in field) return field.name;
  return String(field);
}

interface DailyPerformance {
  date: string;
  total_showtimes: number;
  avg_occupancy_pct: number;
  total_seats: number;
  total_sold: number;
  cities: string[];
}

interface DailyPerformanceDetailProps {
  movieId: string;
  date: string;
}

export async function DailyPerformanceDetail({
  movieId,
  date,
}: DailyPerformanceDetailProps) {
  // 1. Fetch only the fast, small documents so the page shell renders instantly
  const [movieMeta, perfDoc, daysSubCollection] = await Promise.all([
    firestoreRestClient.getDocument("movies", movieId),
    firestoreRestClient.getDocument("movie_performance_v2", movieId),
    firestoreRestClient.getSubCollection(`movie_performance_v2/${movieId}/days`),
  ]);

  const movie =
    movieMeta && perfDoc
      ? ({
          ...perfDoc,
          id: movieId,
          movie_id: movieId,
          title: (movieMeta.name as string) || "Unknown Title",
          poster:
            (movieMeta.poster as string) ||
            (movieMeta.poster_path as string) ||
            "",
          genres: formatMetadataField(movieMeta.genres),
          age_category: formatMetadataField(movieMeta.age_category),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          last_updated: (perfDoc as any).last_swept_at || "",
        } as unknown as MovieSummary)
      : null;
  const dailyStats =
    (daysSubCollection as unknown as DailyPerformance[]).find((d) => d.date === date) ||
    null;

  if (!movie) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Target className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Movie not found</h2>
        <Link href="/performances_v2">
          <Button>Back to Performances</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        {/* Header / Nav */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link href={`/performances_v2/${movieId}`}>
              <Button variant="ghost" size="icon" className="mt-1">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <MovieSummaryCard movie={movie} />
          </div>

          {/* Date Highlight */}
          <div className="hidden md:flex flex-col items-end bg-muted/30 px-6 py-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Viewing Details For
              </span>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight text-primary">
              {date}
            </span>
          </div>
        </div>

        {/* Daily Stats Banner */}
        {dailyStats ? (
          <DailyStatsBanner stats={dailyStats} />
        ) : (
          <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
            No summary stats found for this date.
          </div>
        )}
      </div>

      {/* 2. Stream the heavy showtimes array while showing a skeleton */}
      <Suspense fallback={<ShowtimesSkeleton />}>
        <ShowtimesDataFetcher movieId={movieId} date={date} />
      </Suspense>
    </div>
  );
}
