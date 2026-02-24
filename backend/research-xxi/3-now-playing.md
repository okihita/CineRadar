# Analysis: M-Tix Now Playing API

This document analyzes the `curl-now-playing-by-city.request` and `curl-now-playing-by-city.response` files to document how the new `m.21cineplex.com` Next.js frontend fetches "Now Playing" movies.

## 1. Request Structure

- **Endpoint:** `GET https://m.21cineplex.com/api/movies?type=now-playing&city_id=10`
- **Method:** `GET`
- **Query Parameters:**
  - `type`: `now-playing`
  - `city_id`: `10` (from `city-list.json`, `10` corresponds to Jakarta)

The request is sent to a Next.js API route (`/api/movies`). While it passes standard NextAuth session cookies and anti-bot fingerprint headers (`x-device-uiid`, `x-fingerprint-data`), this endpoint appears to retrieve unauthenticated public data. 

## 2. Response Structure

The response is a very clean, well-structured JSON object, returning a standard `status`, `data.value`, and `accessTime`.

### 2.1 Backend Microservice Discovery
One of the most interesting aspects of the response is that it returns a mapping of downstream API URLs inside `data.value.url`. This exposes the actual backend architecture of the MTix ecosystem:

```json
"url": {
    "URL_BANNER_CAROUSEL": "https://apps-api.21cineplex.com/mtix/banner/carousel",
    "URL_CAFE_MENU": "https://apps-api.21cineplex.com/mtix/fnb/cafe/menus",
    "URL_ORDER_DETAIL": "https://apps-order-api.21cineplex.com/mtix/order/detail",
    "URL_ORDER_LIST_ACTIVE": "https://apps-api.21cineplex.com/mtix/order/list-active",
    "URL_PROMO_DETAIL": "https://apps-api.21cineplex.com/mtix/promotion/detail",
    "URL_SCHEDULE_BY_MOVIE": "https://dc21-api.21cineplex.com/cinema/schedule/movie",
    "URL_SCHEDULE_BY_THEATER": "https://dc21-api.21cineplex.com/cinema/schedule/theater",
    "URL_THEATER_SEATS": "https://apps-order-api.21cineplex.com/mtix/theater/seats/summary"
}
```
* **Implication:** The `m.21cineplex.com` Next.js server acts as an aggregator (BFF), but it also dynamically passes direct API endpoints to the client. The backend utilizes specific microservices: `apps-api`, `apps-order-api`, and `dc21-api`.

### 2.2 Movie Data Objects (`data.value.content`)
The list of movies playing in the given `city_id` is an array of highly descriptive objects.

Example Movie Object:
```json
{
    "parent_movie_id": "26BOTG",
    "dc21_parent_movie_id": "e525d3be-9bc6-41d6-9a39-02b56283a3e9",
    "sub_type": {
        "imax": true,
        "premiere": true,
        "xxi": true
    },
    "title": "BLADES OF THE GUARDIANS",
    "duration": 126,
    "genre": "Action, History",
    "age_limit": 18,
    "rating": "D17+",
    "movie_type": "2D",
    "can_buy": true,
    "movie_image": "https://nos.jkt-1.neo.id/media.cinema21.co.id/movie-images/26BOTG.jpg",
    "trailer": "https://nos.jkt-1.neo.id/media.cinema21.co.id/movie-trailer/26BOTG.mp4",
    "is_ats": false,
    "date_show": "24-02-2026",
    "movie_count": 197,
    "is_now_playing": true
}
```

**Key Data Points for Integration:**
- **Identifiers:** We have both the classic ID (`26BOTG`) and a new UUID format (`dc21_parent_movie_id`). The classical `parent_movie_id` likely supports backward compatibility with legacy systems.
- **Availability Flags (`sub_type`):** Clean booleans show if the movie is playing in standard `xxi`, `premiere`, or `imax` theaters.
- **`is_ats`:** Stands for "Advance Ticket Sales". If true, tickets can be booked for future dates (like *EPIC: ELVIS PRESLEY IN CONCERT* showing `is_ats: true` and `date_show: 27-02-2026`).
- **`movie_count`:** Indicates how many theaters/screens are showing the movie in the requested city.
- **Media Assets:** High-resolution posters (`.jpg`) and trailers (`.mp4`) are served directly from a NEO Cloud CDN (`nos.jkt-1.neo.id`), making them extremely easy to scrape and display without hitting blocked WordPress instances or image proxies.

## Summary 
The Now Playing API is stateless and cleanly designed. Scraping now relies on hitting `GET /api/movies?type=now-playing&city_id={id}`, traversing the `content` array, and utilizing exactly what is provided without needing to parse out complex HTML like the old site.
