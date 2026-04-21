import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { MovieSummaryCard } from "./MovieSummaryCard";
import { DailyStatsBanner } from "./DailyStatsBanner";
import { ShowtimesDataFetcher } from "./ShowtimesDataFetcher";
import { ShowtimesSkeleton } from "./skeletons/ShowtimesSkeleton";
import { TelemetryHeader } from "./TelemetryHeader";
import { DateNavigatorHeader } from "./DateNavigatorHeader";
import { firestoreRestClient } from "@/lib/firestore-rest";
import { MovieSummary } from "../types/performance";
import { formatCompactNumber, formatOccupancy } from "../utils/format";
import { getOccupancyColor } from "../utils/colors";
import { Target, Users, Armchair, MapPin, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

interface CastMember {
  cast_type: string;
  name?: string;
  actor_name?: string;
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
          director: formatMetadataField(movieMeta.director),
          production_house: formatMetadataField(movieMeta.production_company),
          actors: Array.isArray(movieMeta.casts)
            ? (movieMeta.casts as CastMember[])
                .filter((c) => c.cast_type === "Actor")
                .map((c) => c.name || c.actor_name)
                .filter(Boolean) as string[]
            : [],
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
        <Link href="/performances">
          <Button>Back to Performances</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-6 bg-muted/20 p-2 rounded-2xl border border-border/40 shadow-sm">
          {/* 1. LEFT: Movie Identity */}
          <div className="flex items-center gap-4 pl-2">
            <Link href={`/performances/${movieId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <MovieSummaryCard movie={movie} />
          </div>

          {/* 2. CENTER: Performance HUD (The "What") */}
          {dailyStats && (
            <div className="hidden lg:flex items-center gap-8 px-8 py-2 border-x border-border/30">
                {/* Occupancy */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        <Target className="w-3 h-3" />
                        OCR
                    </div>
                    <div className="flex items-baseline gap-0.5">
                        <span className={cn(
                            "text-xl font-black font-mono tracking-tighter",
                            getOccupancyColor(dailyStats.avg_occupancy_pct)
                        )}>
                            {formatOccupancy(dailyStats.avg_occupancy_pct)}
                        </span>
                        <span className="text-[10px] font-bold opacity-40 uppercase">%</span>
                    </div>
                </div>

                {/* Audience */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        <Users className="w-3 h-3" />
                        Audience
                    </div>
                    <span className="text-xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                        {formatCompactNumber(dailyStats.total_sold)}
                    </span>
                </div>

                {/* Capacity */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        <Armchair className="w-3 h-3" />
                        Inventory
                    </div>
                    <span className="text-xl font-black font-mono tracking-tighter tabular-nums text-foreground">
                        {formatCompactNumber(dailyStats.total_seats)}
                    </span>
                </div>

                {/* Markets */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        <MapPin className="w-3 h-3" />
                        Markets
                    </div>
                    <span className="text-xl font-black font-mono tracking-tighter text-foreground">
                        {dailyStats.cities?.length || 0}
                    </span>
                </div>
            </div>
          )}

          {/* 3. RIGHT: Unified Intelligence Pill (Date + Telemetry) */}
          <div className="hidden md:flex items-stretch bg-background/50 rounded-xl border border-border/50 overflow-hidden shadow-sm">
                        <TelemetryHeader />
                        <DateNavigatorHeader date={date} movieId={movieId} />
                      </div>
                    </div>


        {/* Daily Stats Banner */}
        {dailyStats ? (
          <DailyStatsBanner
            stats={{
              ...dailyStats,
              id: movie.id,
              movie_id: movie.movie_id,
              title: movie.title,
              marketing: movie.marketing
            }}
          />
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
