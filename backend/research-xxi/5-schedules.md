# Analysis: M-Tix Schedule by Movie API

This document provides a deep analysis of the `get-schedule-without-city.request` and `.response` files. Specifically, it details how the `m.21cineplex.com` API fetches theater schedules for a given movie across a specific city, and how we can automate requests for any city or movie.

## 1. Request Structure & Encryption Bypass

At first glance, the HTTP request to fetch schedules does not expose the `city_id` or `movie_id` in the URL query string:
```bash
POST https://m.21cineplex.com/api/movies?type=getSchedule
```

Instead of sending plaintext parameters, the frontend sends a single JSON field called `secret` containing AES-encrypted Base64 data:
```json
{"secret":"U2FsdGVkX19IrHjMuxvr8Y9...N4C"}
```

**Decrypting the Payload**
Using the hardcoded payload encryption key discovered during the login API analysis (`567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T`), we successfully decrypted the `secret` payload from the network request. The decrypted plaintext is:

```json
{
  "city_id": "10",
  "latitude": "0",
  "longitude": "0",
  "parent_movie_id": "26BOTG",
  "member_id": "ROW8133560744721123017174309"
}
```

### 1.1 How to Automate Schedule Requests
Because we know the encryption key and the exact structure of the plaintext, **we can easily automate schedule scraping for any city and any movie.** 

To fetch schedules for a different city (e.g., Bandung: `city_id: 1`) or a different movie:
1. Construct the JSON object with the desired `"city_id"` and `"parent_movie_id"`.
2. Encrypt the JSON string using `CryptoJS.AES.encrypt(jsonString, "567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T")`.
3. Wrap the resulting Base64 string in `{ "secret": "<ENCRYPTED_BASE64>" }`.
4. Send an HTTP POST request to `/api/movies?type=getSchedule`.

*(Note: The `member_id` is included here. It likely ties the request to the logged-in session, though it's uncertain if it's strictly required by the backend or just passively passed along by the frontend).*

## 2. Response Structure Analysis

The API responds with an extremely detailed hierarchy grouped by date and cinema format. 

### 2.1 The Data Hierarchy
The `data.value` payload is an array (representing standard "timezone" differences, though typically just one entry for local time). It contains:
- `date`: The schedule date (e.g., `"24-02-2026"`).
- `cinema`: An object grouping cinemas by their format (e.g., `"xxi"`, `"imax"`, `"premiere"`).

### 2.2 Cinema Node Structure
Inside `cinema.xxi`, there is an array of theater objects. Each object provides rich metadata:

```json
{
    "cinema_id": "JKTGAND",
    "dc21_cinema_id": "acdc56c3-9933-4788-8b9e-dff05cdf9570",
    "city_name": "JAKARTA",
    "cinema_name": "GANDARIA CITY XXI",
    "cinema_address": "Gandaria City Level 2, Jl Sultan Iskandar Muda...",
    "coordinate": "-6.24420,106.78360",
    "is_mtix": 2
}
```
**Key Takeaways:**
- You get the exact geographical `coordinate` and the full `cinema_address`.
- The New UUID standard (`dc21_cinema_id`) is provided alongside the classic cinema ID (`JKTGAND`).

### 2.3 The `schedule` Array
Under each cinema node, there is a `schedule` array holding the actual showtimes for the target movie (`parent_movie_id`).

```json
{
    "movie_id": "26BOTG",
    "movie_type_name": "Reguler 2D",
    "dc21_movie_subtype_id": "7f6d3e76-5855-42b9-9ff6-ca9dfcf3076d",
    "ticket_price": 50000,
    "time_show": [
        "12:50",
        "15:20",
        "17:50",
        "20:20"
    ],
    "show_status": [
        "0",
        "0",
        "0",
        "1"
    ],
    "studio_id": [
        4,
        4,
        4,
        4
    ],
    "seat_available": [
        {"free_seat": -1, "total_seat": -1},
        ...
    ],
    "statuses": [4, 4, 4, 4]
}
```

**Crucial Mapping Indicators:**
- The schedule uses heavily minimized parallel arrays:
  - `time_show[0]` mapped to `show_status[0]`, `studio_id[0]`, and `seat_available[0]`.
- **`ticket_price`:** Returns the actual ticket price in Rupiah (e.g., `50000`).
## Summary
The M-Tix Schedule API relies on the same "security theater" as the login flow by symmetrically encrypting parameters that should just be plaintext REST routes (`GET /movies/{movie_id}/schedules/{city_id}`). 

Because the encryption key is static (`567...`), automation is trivial. We just need to build a target JSON payload, encrypt it via AES, and fire the POST request. The response is highly structured, providing all UI-ready metadata natively alongside the price and time slot arrays.
