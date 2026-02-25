# TIX.id Morning Scraping Research

## Acknowledgment of Past Mistake
In the initial implementation of `CineRadarScraper`, the morning scraping loop relied on clicking through the Flutter UI. When we selected a city, we grabbed *all* movies listed under the "Now Playing" or "Presale" sections and blindly attempted to scrape their showtimes. 

**The Mistake:** We failed to verify if a movie actually had an active schedule *for today*. This caused the scraper to waste significant time and resources checking showtimes for "Presale" movies or movies that were technically showing in that city, but whose first showing wasn't until tomorrow or later in the week.

## New API-Driven Sequence
By shifting to direct B2B API requests, we can filter out these invalid movies *before* attempting to scrape their showtimes.

Here is the proper, optimized sequence of iteration for the daily morning scrape:

### 1. City Iteration (Local Data)
We do not rely on an API to get the cities. We iterate over our known `CITIES` array from `backend.infrastructure.city_data.py`.
- **Data Source:** `city_data.CITIES` (e.g., `{"id": "973818511275069440", "name": "BANDUNG"}`)

### 2. Movies in City (`/v1/movies`)
For a given `city_id`, we fetch the list of movies currently playing (or upcoming/presale).
- **Endpoint:** `GET https://api-b2b.tix.id/v1/movies`
- **Params:** `?city_id={city_id}&movie_type=NOW_PLAYING&timezone=7`
- **Returns:** A list of movies (contains `movie_id` and `title`).

### 3. Date Schedules available for Movie (`/v1/schedules/date`)
Before we fetch showtimes, we **MUST** ask the API which specific dates this movie is actually showing in this city.
- **Endpoint:** `GET https://api-b2b.tix.id/v1/schedules/date`
- **Params:** `?schedule_id={movie_id}&city_id={city_id}`
- **Returns:** A list of dates (e.g., `2026-02-26`) with a boolean `is_any_schedule`.

> [!IMPORTANT]
> **The Critical Filter:** We check the returned list for *today's date* (e.g., `datetime.now().strftime("%Y-%m-%d")`). 
> - If `is_any_schedule` is `True`, proceed to Step 4. 
> - If `is_any_schedule` is `False` or the date is missing, **SKIP** the movie.

### 4. Detailed Theatre & Showtime Fetch (`/v1/schedules/movies`)
Only if Step 3 confirms schedules for today, we fetch the actual theatre schedules.
- **Endpoint:** `GET https://api-b2b.tix.id/v1/schedules/movies/{movie_id}`
- **Params:** `?city_id={city_id}&date={today_date}&page={page}`
- **Returns:** The detailed list of theatres, rooms (IMAX, Regular), and showtimes (along with their `showtime_id` for downstream seat scraping).
- *Note:* This endpoint may require pagination if `has_next` is true.

---

By adhering strictly to this 4-step sequence, the Morning Scrape will be significantly faster, ignoring false positives, and putting far less load on the TIX servers (and our Playwright instances).
