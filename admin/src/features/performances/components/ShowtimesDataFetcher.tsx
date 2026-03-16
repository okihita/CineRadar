import { firestoreRestClient } from "@/lib/firestore-rest";
import { ShowtimeSnapshot, ShowtimeTable } from "./ShowtimeTable";
import { NationalSeatAllocation } from "./NationalSeatAllocation";

interface ShowtimesDataFetcherProps {
  movieId: string;
  date: string;
}

export async function ShowtimesDataFetcher({
  movieId,
  date,
}: ShowtimesDataFetcherProps) {
  // This is the heavy, 50-second fetch that will be streamed in
  const showtimesData = await firestoreRestClient.getSubCollection(
    `movie_performance/${movieId}/days/${date}/showtimes`,
  );

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
      {/* National Allocation & Core Markets */}
      <NationalSeatAllocation showtimes={showtimes} />

      {/* Showtime Table */}
      <ShowtimeTable showtimes={showtimes} loading={false} />
    </div>
  );
}
