# Analysis: M-Tix Movie Detail API (`getDetail`)

This document provides a deep analysis of the `movie-detail.request` and `.response` files, demonstrating how M-Tix fetches comprehensive metadata for a specific movie. 

## 1. Request Structure 

Unique to the M-Tix API landscape we've seen so far, the Movie Detail endpoint is a standard, plaintext **GET** request. It does **not** employ the AES encryption payload ("security theater") used by the schedule or seat layout endpoints.

- **Endpoint:** `GET https://m.21cineplex.com/api/movies?type=getDetail&id={master_id}`
- **Method:** `GET`

### 1.1 Parameters
The query string requires two parameters:
1. `type`: Hardcoded to `getDetail`.
2. `id`: The plaintext Movie ID (e.g., `26BOTG`), which is easily obtained from the `now-playing` API response.

### 1.2 Headers & Cookies
Like the other endpoints, the request is authenticated implicitly via session cookies (`__Secure-next-auth.session-token`) and Cloudflare routing headers (`x-fingerprint-data`, `x-device-uiid`). M-Tix acts as a Backend-For-Frontend (BFF), bridging these Next.js requests to their internal microservices.

## 2. Response Structure Analysis

The response is a clean, structured JSON object returning deep metadata natively under `data.value.content`.

```json
{
    "status": "OK",
    "data": {
        "is_success": true,
        "value": {
            "status": 0,
            "content": { ... }
        }
    },
    "accessTime": "24-02-2026 18:45:12"
}
```

### 2.1 The Data Object (`content`)
The `content` object maps cleanly to a relational database schema. Below are the critical fields extracted:

| Field | Example Value | Utility for Scraping |
| :--- | :--- | :--- |
| **`master_id`** / **`movie_id`** | `"26BOTG"` | The primary key linking across schedules and seats. |
| **`title`** | `"BLADES OF THE GUARDIANS"` | Main display title. |
| **`duration`** | `126` | Runtime in minutes. |
| **`movie_image`** | `https://nos.jkt-1.neo.id/.../26BOTG.jpg` | Direct CDN link for the high-res poster. |
| **`movie_trailer`** | `https://nos.jkt-1.neo.id/.../26BOTG.mp4` | Direct CDN link for the trailer video. |
| **`age_limit`** | `18` | Integers defining legal viewing age. |
| **`rating`** | `"D17+"` | Localized Indonesian censorship rating format. |
| **`genre`** | `"Action, History"` | Comma-separated string of genres. |
| **`description`** | `"Dao Ma (Jing Wu), adalah... "` | Full Indonesian localized synopsis. |

### 2.2 Rich Cast & Crew Metadata
Unlike the basic metadata array provided in the `now-playing` endpoint, the `getDetail` endpoint provides the full textual roster for the film's production:
- **`director`**: `"Yuen Woo-Ping"`
- **`writer`**: `"Chao-Bin Su, Larry Yang"`
- **`producer`**: `"Jing Wu"`
- **`player`** (Cast): `"Jet Li, Jing Wu, Nicholas Tse, ..."`
- **`distributor`**: `"Alibaba Pictures Group"`

### 2.3 Additional Technical Parsing
The response cleanly exposes internal deployment tracking logic:
- **`movie_type`**: `"2D"` (Base format).
- **`is_dolby`**: `false` (A crucial boolean for premium theater flags, separate from IMAX labels).
- **`published_date`**: `"2026-02-17"` (Presumably the date the meta was uploaded to their CMS).
- **`sales_date`**: `"2026-02-13"` (The date advance tickets or system sales were authorized).

## 3. Implications for the Dual-Source Architecture

In `SCRAPING_PLAN.md`, we established that **TIX ID** is our *Master Movie Record* due to its richer dataset (multiple trailers, TMDb IDs, extensive cast array). 

However, this `getDetail` endpoint changes the landscape slightly:
1. **Synopsis & Language:** M-Tix provides a highly localized Indonesian `description`. If TIX ID's synopsis defaults to English (via TMDb fallback), the M-Tix dataset can be used to forcefully localize the UI.
2. **CDN Media Assets:** The `movie_image` and `movie_trailer` endpoints are hosted directly on Neo Cloud (`nos.jkt-1.neo.id`). These URLs are hotlinkable, extremely fast, and not subject to YouTube's changing iframe or API restrictions. We can utilize these as robust fallbacks if TIX's YouTube trailer links become private or get taken down.
3. **Internal M-Tix Dates:** Tracking `published_date` and `sales_date` gives CineRadar insights into exactly *when* Cinema XXI decides to market a film internally, long before it appears on aggregator apps.

### Conclusion
The `getDetail` endpoint is incredibly simple to scrape (no encryption required, `GET` method) and provides the perfect bridge between the macro TIX ID database and the micro XXI theater schedules. It should be queried once per new `master_id` discovered during the Now Playing scrape.
