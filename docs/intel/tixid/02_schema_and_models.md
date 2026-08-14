# TIX ID API Schemas & Data Models

This document outlines the JSON schemas returned by the TIX ID B2B API during the showtimes scraping process, along with their by-field breakdowns and corresponding Python `Pydantic v2` data models.

## 1. Cities Endpoint
Used to fetch the list of available cities and their internal IDs.

**Endpoint:** `GET /v1/cities?name=`

> [!NOTE] 
> **Ground Truth Payloads:**
> - Request: [`raw_payloads/06_cities.request`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/06_cities.request)
> - Response: [`raw_payloads/06_cities.response`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/06_cities.response)

### JSON Sample
```json
{
    "success": true,
    "data": [
        {
            "id": "973818511275069440",
            "name": "BANDUNG"
        }
    ]
}
```

### By-Field Understanding
- **`id`**: String. The 64-bit integer ID for the city.
- **`name`**: String. The uppercase localized name of the city.

> [!WARNING]
> **CRITICAL PITFALL: `id` vs `movie_id`**
> 
> Historically, this API returns two distinct identifers for a single movie:
> 1. `id`: This is the **Schedule Allocation ID**. This is the mandatory identifier required when querying downstream showtimes (`/v1/schedules/date` and `/v1/schedules/movies/{id}`).
> 2. `movie_id`: This is the **Metadata ID**. This is used for enriched metadata (like trailers and synopsis) on the root TIX endpoints.
> 
> *Do not pass `movie_id` into the showtimes endpoint!* Doing so will result in `404 Not Found` or empty schedules. Always pass `id` when looking for showtimes.

### Pydantic Models (v2)

```python
from pydantic import BaseModel

class City(BaseModel):
    id: str
    name: str

class CityResponse(BaseModel):
    success: bool
    data: list[City]
```

---

## 2. Movies List Endpoint
Used to fetch all movies currently playing or upcoming in a given city.

**Endpoint:** `GET /v1/movies?city_id={id}&movie_type=NOW_PLAYING`

> [!NOTE] 
> **Ground Truth Payloads:**
> - Request: [`raw_payloads/03_movies_now_playing.request`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/03_movies_now_playing.request)
> - Response: [`raw_payloads/03_movies_now_playing.response`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/03_movies_now_playing.response)

### JSON Sample (Abridged)
```json
{
    "success": true,
    "data": [
        {
            "id": "1996107175268794368",
            "title": "KUYANK",
            "genres": [{"id": "1577", "name": "Horror"}],
            "poster_path": "https://asset.tix.id/movie_poster_v2/e635fc88.webp",
            "age_category": "R",
            "presale_flag": 0,
            "rating_score": 0,
            "movie_id": "1996107160261574656",
            "merchant": [
                {
                    "merchant_id": "2224f7e3-da00-4fb9-9de3-2b888d83ac03",
                    "merchant_name": "CGV"
                }
            ],
            "country": "Indonesia"
        }
    ]
}
```

### By-Field Understanding
- **`success`**: boolean, indicates successful API response.
- **`data`**: Top-level array containing movie list.
  - **`id`**: String. Internal list ID (often different from movie_id).
  - **`title`**: String. The localized title of the movie.
  - **`genres`**: Array of objects mapped by `id` and `name`.
  - **`poster_path`**: String. Absolute URL to TIX ID's CDN for the poster.
  - **`age_category`**: String. Age rating (e.g., "SU" for all ages, "D" for adult, "R" for teen).
  - **`presale_flag`**: Integer. `1` if ticket sales are in presale phase, `0` otherwise.
  - **`movie_id`**: String. The crucial identifier used in downstream API calls (like `/v1/schedules`).
  - **`merchant`**: Array. Indicates which theater chains are showing this (XXI, CGV, Cinépolis).
  - **`country`**: String. Country of origin for the movie.

### Pydantic Models (v2)

```python
from pydantic import BaseModel, HttpUrl, Field

class Genre(BaseModel):
    id: str
    name: str

class Merchant(BaseModel):
    merchant_id: str
    merchant_name: str
    sort: int | None = None

class MovieBrief(BaseModel):
    id: str
    movie_id: str
    title: str
    age_category: str
    presale_flag: int
    rating_score: float | int
    country: str | None = ""
    poster_path: HttpUrl | str | None = None
    genres: list[Genre] = Field(default_factory=list)
    merchant: list[Merchant] = Field(default_factory=list)

class MoviesResponse(BaseModel):
    success: bool
    data: list[MovieBrief]
```

---

## 2. Schedule Dates Endpoint
Used to check which dates a specific movie is airing in a city.

**Endpoint:** `GET /v1/schedules/date?schedule_id={movie_id}&city_id={id}`

> [!NOTE] 
> **Ground Truth Payloads:**
> - Request: [`raw_payloads/04_movie_schedule_dates.request`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/04_movie_schedule_dates.request)
> - Response: [`raw_payloads/04_movie_schedule_dates.response`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/04_movie_schedule_dates.response)

### JSON Sample
```json
{
    "success": true,
    "data": [
        {
            "date": "2026-02-26",
            "is_any_schedule": true
        },
        {
            "date": "2026-02-27",
            "is_any_schedule": false
        }
    ]
}
```

### By-Field Understanding
- **`date`**: String (YYYY-MM-DD). The date being queried.
- **`is_any_schedule`**: Boolean. `True` if there is at least one showtime for this movie in any theater in the requested city on this date. `False` means no showtimes exist.

### Pydantic Models (v2)

```python
from pydantic import BaseModel

class DateSchedule(BaseModel):
    date: str
    is_any_schedule: bool

class ScheduleDatesResponse(BaseModel):
    success: bool
    data: list[DateSchedule]
```

---

## 3. Detailed Theaters & Showtimes Endpoint
Fetches actual showtimes and pricing.

**Endpoint:** `GET /v1/schedules/movies/{movie_id}?city_id={id}&date={date}&page=1`

> [!NOTE] 
> **Ground Truth Payloads:**
> - Request: [`raw_payloads/05_movie_showtimes.request`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/05_movie_showtimes.request)
> - Response: [`raw_payloads/05_movie_showtimes.response`](file:///Users/okihita/ArcaneSanctum/CineRadar/docs/00_scraping_tixid/raw_payloads/05_movie_showtimes.response)

### JSON Sample (Abridged)
```json
{
    "success": true,
    "data": {
        "has_next": false,
        "page": 1,
        "show_date": 1771977600000,
        "theaters": [
            {
                "id": "1178839445806338048",
                "name": "SLIPI JAYA CGV",
                "type": 0,
                "merchant": {
                    "merchant_id": "2224f7e3-da00-4fb9-9de3-2b888d83ac03",
                    "merchant_name": "CGV"
                },
                "address": "Plaza Slipi Jaya Lantai 4...",
                "price_groups": [
                    {
                        "category": "REGULAR 2D",
                        "price_string": "Rp20.000",
                        "show_time": [
                            {
                                "id": "2026335293564608512",
                                "time": 1772027700000,
                                "display_time": "13:55",
                                "studio": "100101",
                                "price": 20000
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

### By-Field Understanding
- **`has_next`**: Boolean. Used for pagination. If true, query `page=2`.
- **`show_date`**: Integer. Epoch timestamp of the requested date (in milliseconds).
- **`theaters`**: Array of theater objects.
  - **`name`**: String. Theater name (e.g., "SLIPI JAYA CGV").
  - **`merchant`**: Object. Indicates theater chain.
  - **`address`**: String. Physical location of the theater.
  - **`price_groups`**: Array. Groups showtimes by class/format (e.g., "REGULAR 2D", "IMAX 2D", "PREMIERE").
    - **`category`**: String. format type.
    - **`show_time`**: Array of individual sessions.
      - **`id`**: String. Extremely important `showtime_id` used later for scraping seat maps or creating orders.
      - **`time`**: Integer. Epoch timestamp in ms for the exact start time.
      - **`display_time`**: String. Human-readable local time (e.g., "13:55").
      - **`studio`**: String. Internal ID or name of the auditorium room.
      - **`price`**: Integer. The absolute numerical price (e.g., 20000).

### Pydantic Models (v2)

```python
from pydantic import BaseModel, Field

class ShowtimeItem(BaseModel):
    id: str  # The unique showtime_id
    time: int
    display_time: str
    studio: str
    studio_type: str | None = None
    price: int
    status: int | None = None
    expired: int | None = None

class PriceGroup(BaseModel):
    category: str
    low_price: int | None = None
    high_price: int | None = None
    price_string: str | None = None
    show_time: list[ShowtimeItem] = Field(default_factory=list)

class TheaterInfo(BaseModel):
    id: str
    name: str
    type: int | None = None
    presale_flag: int | None = None
    address: str | None = None
    merchant: Merchant
    price_groups: list[PriceGroup] = Field(default_factory=list)

class ShowtimesPageData(BaseModel):
    has_next: bool
    page: int
    show_date: int
    theaters: list[TheaterInfo] = Field(default_factory=list)

class ShowtimesResponse(BaseModel):
    success: bool
    data: ShowtimesPageData
```
