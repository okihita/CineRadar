import { firestoreRestClient } from "@/lib/firestore-rest";
import { ForensicPerformanceHub } from "./ForensicPerformanceHub";
import { NationalSeatAllocation } from "./NationalSeatAllocation";
import { TelemetryUpdater } from "./TelemetryUpdater";
import { ShowtimeSnapshot } from "../types/performance";

interface ShowtimesDataFetcherProps {
  movieId: string;
  date: string;
}

// DEFINITIVE METADATA MASK: Excludes heavy layout blobs for 10x faster national crunching.
const PERFORMANCE_METADATA_MASK = [
    "showtime_id", "showtime", "theatre_name", "theatre_id", "city", 
    "room_category", "merchant", "price", "total_seats", "sold_seats", 
    "occupancy_pct", "audience_count", "audience_pct", "initial_unavailable",
    "scrape_phase", "metadata_id", "date", "studio_id"
];

export async function ShowtimesDataFetcher({
  movieId,
  date,
}: ShowtimesDataFetcherProps) {
  
  const getTelemetryData = async () => {
    // eslint-disable-next-line react-hooks/purity
    const start = Date.now();
    const data = await firestoreRestClient.getSubCollection(
        `movie_performance_v2/${movieId}/days/${date}/showtimes`,
        PERFORMANCE_METADATA_MASK
    );
    // eslint-disable-next-line react-hooks/purity
    const end = Date.now();
    const json = JSON.stringify(data);
    return {
        showtimesData: data,
        elapsedSeconds: (end - start) / 1000,
        sizeKB: Buffer.byteLength(json, 'utf8') / 1024
    };
  };

  const { showtimesData, elapsedSeconds, sizeKB } = await getTelemetryData();

  const showtimes = (showtimesData || []) as unknown as ShowtimeSnapshot[];

  if (showtimes.length === 0) {
    return (
      <div className="p-12 border border-dashed rounded-md bg-muted/20 text-center text-sm text-muted-foreground mt-6">
        No showtimes recorded for this date.
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Client-side Telemetry Link */}
      <TelemetryUpdater latency={elapsedSeconds} payloadSize={sizeKB} />

      {/* National Allocation & Core Markets */}
      <NationalSeatAllocation showtimes={showtimes} />

      {/* Forensic Intelligence Hub (Drill-Down + Feed) */}
      <ForensicPerformanceHub showtimes={showtimes} movieId={movieId} date={date} />
    </div>
  );
}
