# CineRadar: M-Tix Scraping Plan & Insights Architecture

Based on our deep analysis of the M-Tix `m.21cineplex.com` Next.js frontend and its underlying microservices (`apps-api`, `dc21-api`), we have designed a robust, scalable scraping strategy. Because M-Tix relies on statically keyed "security theater" (client-side AES encryption with hardcoded keys like `567G553Yz...`) instead of true backend authentication for public data, we can scrape their entire ecosystem seamlessly.

## 1. Scraping Capabilities (What We Can Extract)

We have mapped the following entities and endpoints that can be scraped with 100% programmatic automation (no browser rendering required):

| Entity | Endpoint | Requirement | Scrapable Data Points |
| :--- | :--- | :--- | :--- |
| **Cities** | `GET /api/public/city-list.json` (Assumed origin) | None | `city_id`, `city_name` |
| **Movie Metadata** | `GET /api/movies?type=now-playing&city_id={id}` | `city_id` | Movie titles, standard IDs (`26BOTG`), UUIDs, duration, genres, age limits, poster/trailer URLs (via `nos.jkt-1.neo.id` CDN), availability flags (`imax`, `premiere`, `xxi`), and advance ticket sales (`is_ats`) flags. |
| **Theater Schedules** | `POST /api/movies?type=getSchedule` | AES Encrypted Payload: `{city_id, parent_movie_id}` | Cinema coordinates (GPS), exact cinema addresses, `dc21_cinema_id`, arrays of `time_show` mapped to `studio_id`, and `ticket_price`. |
| **Live Seat Occupancy** | `POST /api/theater?type=getSeatsLayout` | AES Encrypted Payload: `{cinema_id, date_show, studio_id, time_show}` | The physical delimiting string of the studio (`A1#free;A2#col`). Allows us to calculate exact max capacity vs. current booked seats. |

## 2. Scraping Execution Flow

To build a complete daily or hourly database of the Indonesian cinema landscape, the system should follow this orchestrated flow:

1. **City Initialization:** Load the sorted list of all supported `city_id`s.
2. **Now Playing Aggregation (Broad Phase):**
   - Iterate through every active `city_id`.
   - Hit the Now Playing API.
   - Upsert new movies to our core `Movies` database.
   - Tag which movies are playing in which cities.
3. **Schedule Discovery (Deep Phase):**
   - For every movie found playing in a specific city, construct the JSON payload.
   - Encrypt the payload using the `567...` static AES key.
   - Parse the nested arrays targeting specific cinemas, recording the `time_show`, `studio_id`, and `ticket_price` in our `Schedules` database.
4. **Occupancy Polling (Real-Time Phase - Optional/Targeted):**
   - Because fetching the `{layout}` string for thousands of theaters every hour is incredibly intensive, this phase should be triggered selectively (e.g., only tracking blockbuster movies, or polling select locations during peak hours).
   - Use the variables gathered in Phase 3 to build the nested JSON payload, encrypt it, and tally the `#free` vs. missing delimited objects to gauge theater density.

## 3. Data Insights & Analytics (The Target Value)

By orchestrating this scrape, CineRadar can generate unprecedented insights into the Indonesian cinema market that are otherwise invisible to the public.

### 3.1 Macro Market Analytics
- **National Footprint:** Heatmaps of where specific movies are deployed across Indonesia. Does a niche indie film only screen in Jakarta and Bali?
- **Box Office Forecasting:** By selectively polling the `getSeatsLayout` for opening weekend blockbusters across representative `cinema_id`s, we can statistically estimate opening weekend gross revenue before M-Tix officially publishes numbers.
- **Pricing Dynamics:** Analyzing `ticket_price` discrepancies across different `city_id`s and formats (Premiere vs. Regular vs. IMAX). We can map out the most expensive and cheapest cinemas in the country.

### 3.2 Micro Studio & Theater Analytics
- **Theater Utilization:** Which theaters are the most efficient? Are morning shows (`12:45` slots) completely empty while evening shows (`20:00`) sell out?
- **Format Penetration:** Tracking the rapid rollout of `imax` or `premiere` flags on specific movies.
- **Advance Ticket Demand:** Tracking how quickly `is_ats` (Advance Ticket Sales) showtimes fill up, serving as an early indicator of movie hype and cultural impact.

### 3.3 Consumer-Facing Features
- **Price Alerts:** Notifying users when a specific movie drops to a certain `ticket_price` target.
- **Scarcity Alerts:** "Only 5 seats left for [Movie] at [Cinema] at 20:00!" using targeted `getSeatsLayout` polling.
- **Ultimate Finder:** Letting users search "Find me the cheapest ticket for *Blades of the Guardians* starting after 19:00 within 10km of my current GPS coordinates" (leveraging the scraped `coordinate` data).

## 4. Dual-Source Architecture (MTIX + TIX ID Aggregation)

CineRadar already utilizes a Playwright-based scraper to aggregate data from **TIX ID**, which serves as an overarching aggregator for multiple cinema chains (XXI, CGV, Cinépolis). To ensure we get the absolute most accurate and insightful data while minimizing scraper blockages, we will merge the Data extracted from MTIX with the Data extracted from TIX ID.

### 4.1 Data Source Differences & Overlaps

| Feature | TIX ID (Current Source) | M-Tix (New Direct Source) | Strategic Role |
| :--- | :--- | :--- | :--- |
| **Movie Metadata** | **Rich**: TMDb/IMDb IDs, Global `rating_score`, full Cast & Crew, multiple Trailers, rich Synopsis. | **Basic**: Title, Duration, Genre, Age limits, single CDN poster/trailer. | **TIX ID** stays the absolute source of truth for the *Master Movie Record*. |
| **Chain Coverage** | **Universal**: Extracts from XXI, CGV, and Cinépolis. | **Exclusive**: XXI and XXI sub-formats (IMAX, Premiere) only. | Use **TIX ID** for national broad coverage, use **M-Tix** to deep-dive into XXI. |
| **Schedule Data** | **Aggregated**: Shows `ticket_price`, `time_show`, and available/sold_out boolean flags dynamically. | **Granular Details**: Exact `coordinate` GPS mapping, `is_ats` advance sales flags. | Merge schedules by matching `cinema_name` and `time_show`. |
| **Seat Availability** | **Opaque**: Requires simulating the booking flow which is fragile for a scraper. | **Transparent API**: Direct, lightweight `getSeatsLayout` API bypass using static `567G...` AES key. | **M-Tix** becomes the exclusive engine for the *Real-Time Occupancy Polling phase*. |

### 4.2 Aggregation & Deduplication Execution
We will implement a **Dual-Source Database Model**:

1. **Two Distinct Collections:** `tix_movies` (populated via the Playwright scraper) and `mtix_movies` (populated via direct Next.js API calls).
2. **The Aggregator Engine:** A background service that runs after both scrapes complete. It joins the data by performing fuzzy string matching on `movie.title` alongside release date proximity to build a `master_movies` view.
3. **Data Fusion:** 
   - Takes the rich poster, cast list, and global ratings from the TIX ID document.
   - Takes the direct GPS coordinates, true `movie_id` UUIDs, and live seat layout configurations from the MTIX document.
   - Overlays the schedules, prioritizing the MTIX schedule data for XXI theaters (as it allows direct seat polling capability).

### 4.3 Storytelling in the Admin UI
The `Admin UI` currently displays data generically across a grid. We will revamp the UI to explicitly tell the story of **Data Fusion**:

- **Source Badges:** Movie cards and detail pages will proudly wear tags like `[Data: TIX ID + M-Tix]`.
- **Confidence Scoring:** Displaying an indicator that shows data completeness (e.g., "95% Meta Completeness (TIX) | Live Seats Enabled (M-Tix)").
- **Insights Dashboard:** Add a new metrics panel to the `MovieDatabaseDetail` view that contrasts data points: *"TIX ID reports this as trending, while our M-Tix live-seat poll confirms a 80% occupancy rate across Jakarta."* 

By keeping the sources physically separate in the database but merged in the application layer, CineRadar avoids destructive data overwrites and ensures pure data lineage, providing the most profound and verifiable box-office analytics tool available.
