# Analysis: M-Tix Seats Layout API (`getSeatsLayout`)

This document provides a deep analysis of how the `m.21cineplex.com` system checks live seat availability and structure. As discovered in the `getSchedule` analysis, the main showtimes API response returns `-1` for physical seat counts. To get actual seating layouts, the frontend fires a separate API layer.

## 1. Request Structure & Encryption Bypass

The exact seating layout for a specific showtime is fetched via an encrypted JSON payload.

- **Endpoint:** `POST https://m.21cineplex.com/api/theater?type=getSeatsLayout`
- **Method:** `POST`

### 1.1 Decrypting the Post Body
Just like `getSchedule`, the request body contains only an encrypted Base64 string nested inside a `secret` key. Using the exact same `567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T` AES key (from our login analysis), we decrypted the payload to reveal:

```json
{
  "cinema_id": "JKTAETB",
  "date_show": "24-02-2026",
  "studio_id": "1",
  "time_show": "20:50"
}
```

### 1.2 Data Source Mapping (Integration)
**Crucially, every single one of these required parameters can be extracted directly from the preceding `getSchedule` response!**

If your system makes a `getSchedule` request first, you can map the keys directly to fetch its seat layout:
- `cinema_id` is found inside the grouping array at `cinema.xxi[i].cinema_id`.
- `date_show` is found at the root `date` object.
- `studio_id` is matched by the parallel array index from `schedule[x].studio_id[y]`.
- `time_show` is matched by the parallel array index from `schedule[x].time_show[y]`.

This means an automation script can seamlessly traverse an entire city's schedule and fire off `getSeatsLayout` requests strictly using data parsed from the initial schedule response without rendering UI or storing complex relational state.

## 2. Parsing the Layout Response String
The response from `getSeatsLayout` is extraordinarily lightweight, reducing a bulky JSON relational mapping into a highly compact delimited string in `data.value.layout`:

```json
"layout": "A1#free;A2#free;A3#free;...;A10#col;A11#free|B1#free;B2#free..."
```

### 2.1 The Delimiter Rules:
- `|` (Pipe): Separates physical rows in the theater (e.g., Row A | Row B).
- `;` (Semicolon): Separates individual seats or structural objects within a specific row.
- `#` (Hash): Separates the seat identifier from its current booking state.

### 2.2 Status Enums:
- `#free`: The seat is visually rendered as available to be booked by the user.
- `#col`: Represents a structural gap in the design, such as an aisle or an empty pillar column in the cinema structure. It tells the frontend engine to render empty physical space correctly instead of rendering a seat box.
- *(Presumably `#booked` or similar denotes taken seats, though not present in this totally empty theater example).*

## 3. Automation Playbook
To automate a complete "Current Seating Capacity" scraper:

1. Fetch Now Playing for a City (`GET /api/movies?type=now-playing&city_id=X`).
2. For each movie, construct a JSON payload with `{city_id, parent_movie_id}`, encrypt it with AES, and fire `POST /api/movies?type=getSchedule`.
3. Parse the nested arrays of schedules.
4. Construct a new JSON payload `{cinema_id, date_show, studio_id, time_show}` using properties mapped straight from Step 3's arrays. 
5. Encrypt it with the `567...` AES key and fire `POST ...getSeatsLayout`.
6. Split the response `layout` string by `|` to get the rows, and count instances of `#free` to accurately tally the real-time maximum occupancy of a studio.
