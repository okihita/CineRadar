# CineRadar 🎬

A Python scraper for TIX.id - Indonesia's cinema ticket booking platform. Scrapes movie listings, theatre schedules, and showtimes across all Indonesian cities.

## Features

- 🏙️ **83 Indonesian cities** - Scrape movie data from all TIX-supported cities
- 🎬 **Movie availability tracking** - See which movies are showing in which cities
- 🎭 **Theatre schedules** - Get showtimes with room types, prices, and time slots
- 🤖 **Anti-bot detection** - Stealth mode with proper auth flow
- 📊 **Daily reports** - Track movie availability over time
- ⚡ **Fast & reliable** - Uses Playwright with response interception
- 🌐 **Next.js dashboard** - Beautiful frontend to browse movies and showtimes

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### Run Daily Scraper

```bash
# Full scrape (all 83 cities) - headless mode
python tix_api.py

# Test with limited cities (visible browser)
python tix_api.py --limit 5 --visible

# Custom output directory
# Custom output directory
python tix_api.py --output my_data

# Full scrape with showtimes (slower)
python tix_api.py --schedules

# Scrape showtimes for specific city
python tix_api.py --city JAKARTA --schedules
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--visible` | Show browser window (default: headless) |
| `--limit N` | Limit to first N cities (for testing) |
| `--output DIR` | Output directory (default: `data/`) |
| `--schedules` | Fetch detailed theatre schedules with showtimes (~45-75 min) |
| `--city NAME` | Only scrape specific city (e.g., `--city JAKARTA`) |

## What It Does

1. Opens browser and navigates to TIX.id home (gets auth token)
2. Fetches list of all 83 cities from `/cities` page
3. For each city, navigates to `/schedule-movies/now-showing?city_id=X`
4. Intercepts API responses to capture movie data
5. Generates a report showing which movies are in which cities
6. Saves results to timestamped JSON files

## 📦 Data Format

The generated JSON file contains:

```json
{
  "scraped_at": "2025-12-11 14:30:00",
  "date": "2025-12-11",
  "movies": [
    {
      "id": "123456",
      "title": "ZOOTOPIA 2",
      "genres": ["Animation", "Comedy"],
      "cities": ["JAKARTA", "SURABAYA"],
      "schedules": {                  // Only if --schedules is used
        "JAKARTA": [
          {
            "theatre_name": "CIPINANG XXI",
            "merchant": "XXI",
            "rooms": [
              {
                "category": "REGULAR 2D",
                "price": "Rp45.000",
                "showtimes": ["12:30", "14:45", "17:00"]
              }
            ]
          }
        ]
      }
    }
  ],
  "city_stats": {
    "JAKARTA": 27,
    "BANDUNG": 25
  }
}
```

### `data/cities.json`

List of all available cities:

```json
{
  "updated_at": "2025-12-11 06:38:03",
  "total": 83,
  "cities": [
    {"id": "967969975509716992", "name": "JAKARTA"},
    {"id": "973818511275069440", "name": "BANDUNG"},
    ...
  ]
}
```

## Project Structure

```
CineRadar/
├── tix_api.py          # 🎯 Main daily scraper
├── tix_api_client.py   # Alternative browser-based client (more features)
├── requirements.txt    # Python dependencies
├── data/               # Scraped data output
│   ├── cities.json
│   └── movies_YYYY-MM-DD.json
├── .gitignore
└── README.md
```

## Scheduling Daily Runs

### macOS (launchd)

Create `~/Library/LaunchAgents/com.cineradar.daily.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cineradar.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/path/to/CineRadar/tix_api.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>WorkingDirectory</key>
    <string>/path/to/CineRadar</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.cineradar.daily.plist
```

### Linux (cron)

```bash
# Edit crontab
crontab -e

# Add line to run daily at 8 AM
0 8 * * * cd /path/to/CineRadar && python3 tix_api.py >> /var/log/cineradar.log 2>&1
```

## How It Works

### Scraping Flow

1. **Home Page** → Gets authentication token from `/v1/auth`
2. **Cities Page** → Navigate to `/cities`, search for city name
3. **Click City** → Triggers navigation to movies page
4. **Intercept Response** → Capture `/v1/movies` API response
5. **Repeat** → For all 83 cities

### TIX.id API Endpoints

#### 1. Authentication
```
GET https://api-b2b.tix.id/v1/auth
```
- **Called when**: Visiting home page (`https://app.tix.id/home`)
- **Returns**: Auth token (handled automatically by browser cookies)

#### 2. Cities List
```
GET https://api-b2b.tix.id/v1/cities?name=
```
- **Called when**: Visiting cities page or searching
- **Returns**: List of all available cities

**Response structure:**
```json
{
  "data": [
    {"id": "967969975509716992", "name": "JAKARTA"},
    {"id": "973818511275069440", "name": "BANDUNG"},
    ...
  ]
}
```

#### 3. Movies for City
```
GET https://api-b2b.tix.id/v1/movies?city_id={city_id}&movie_type=NOW_PLAYING&timezone=7
```
- **Called when**: Selecting a city (clicking from search results)
- **Returns**: All movies currently showing in that city

**Response structure:**
```json
{
  "data": [
    {
      "movie_id": "1977633929036906496",
      "title": "AGAK LAEN: MENYALA PANTIKU!",
      "genres": [{"id": "...", "name": "Drama"}],
      "poster_path": "https://asset.tix.id/movie_poster_v2/...",
      "age_category": "R",
      "country": "Indonesia",
      "merchant": [
        {"merchant_name": "XXI"},
        {"merchant_name": "CGV"}
      ]
    }
  ]
}
```

### Data Field Mapping

| Output Field | Source Endpoint | API Field |
|--------------|-----------------|-----------|
| `movie.id` | `/v1/movies` | `movie_id` or `id` |
| `movie.title` | `/v1/movies` | `title` |
| `movie.genres` | `/v1/movies` | `genres[].name` |
| `movie.poster` | `/v1/movies` | `poster_path` |
| `movie.age_category` | `/v1/movies` | `age_category` |
| `movie.country` | `/v1/movies` | `country` |
| `movie.merchants` | `/v1/movies` | `merchant[].merchant_name` |
| `movie.cities` | *Aggregated* | Cities where movie appears |
| `city.id` | `/v1/cities` | `id` |
| `city.name` | `/v1/cities` | `name` |
| `city_stats` | *Computed* | Count of movies per city |

### City Selection Mechanism

**Important**: The TIX.id Flutter web app ignores URL parameters for city selection. The city must be selected by:

1. Navigate to `https://app.tix.id/cities`
2. Type city name in search input
3. Click on the city result
4. This triggers internal navigation and API call

Direct URL manipulation like `/schedule-movies?city_id=X` does **not** work - it always returns Jakarta data.

### Anti-Bot Measures

The scraper includes:

- 🎭 **Realistic browser fingerprint** - iPhone user agent, mobile viewport
- 🔒 **WebDriver removal** - Hides `navigator.webdriver` flag
- 🏠 **Proper auth flow** - Visits home page first to get token
- 🕐 **Human-like delays** - Wait for Flutter to load between actions:
  - 1 second after page navigation
  - Click to focus input before typing
  - 0.8 seconds after filling search
- 🌏 **Indonesian locale** - `id-ID` locale, `Asia/Jakarta` timezone
- 💪 **Force click** - Bypass Flutter overlay interception

## Example Output

```
============================================================
🎬 CineRadar - Daily Movie Availability Scraper
📅 Date: 2025-12-11
============================================================

[08:13:20] 🎬 Starting movie availability scrape...
[08:13:21] 📍 Processing 83 cities
[08:14:01]    Progress: 5/83 | 22 movies | 5 in BANJARBARU
...
[08:22:08] 🏁 Done
[08:22:08] ✅ Found 30 unique movies across 83 cities

📊 SUMMARY
Total Cities: 83
Total Movies: 30

🏙️ Cities by movie count:
   JAKARTA              (26 movies)
   SURABAYA             (21 movies)
   BANDUNG              (20 movies)
   ...

💾 Saved to: data/movies_2025-12-11.json
```

## Web Frontend

The `web/` directory contains a Next.js dashboard with a movie-based layout similar to LMS course viewers.

### Setup

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 to view the dashboard.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🎬 CineRadar          29 Movies  83 Cities  500 Theatres  │
├──────────────┬──────────────────────────────────────────────┤
│  📋 Sidebar  │  🎬 Movie Details                            │
│              │                                              │
│  1. Movie A  │  [Poster] Title, Genres, Age Rating          │
│  2. Movie B  │                                              │
│  3. Movie C  │  📍 JAKARTA (10 theatres)                    │
│  * Selected  │    ├─ CGV AEON JGC                           │
│  4. Movie D  │    │   └─ REGULAR 2D: 12:00, 14:30           │
│  5. Movie E  │    └─ XXI Plaza Senayan                      │
│              │        └─ IMAX 2D: 15:00, 18:00              │
│  [Search]    │                                              │
│              │  📍 BANDUNG (8 theatres) [collapsed]         │
└──────────────┴──────────────────────────────────────────────┘
```

### Features

**Left Sidebar (Movie Playlist)**
- Numbered list of all movies with thumbnails
- Search filter to find movies quickly
- City count and age rating badges
- Visual highlight for selected movie

**Right Panel (Movie Details)**
- Movie header with poster, genres, country, merchants
- Collapsible city sections (click to expand)
- Theatre cards with merchant badges and addresses
- Room categories (2D, IMAX, VELVET, GOLD CLASS, etc.)
- Colorful showtime buttons with prices

### Components

| Component | Description |
|-----------|-------------|
| `MovieBrowser.tsx` | Main wrapper with selection state |
| `MovieSidebar.tsx` | Left playlist with movie list |
| `CityShowtimes.tsx` | Right panel with cities/theatres |

### Data Source

The frontend reads from `../data/movies_YYYY-MM-DD.json` (most recent file). Run the scraper with `--schedules` to populate showtime data.

## Showtime Scraping Details

When using `--schedules`, the scraper performs additional work:

1. For each movie in each city, navigates to the movie detail page
2. Intercepts the `/v1/schedules/movies/{movie_id}` API response
3. Parses nested theatre data structure:
   - `data.theaters[]` - List of theatres
   - `theater.price_groups[]` - Room categories (2D, IMAX, etc.)
   - `price_group.show_time[]` - Individual showtimes

### Schedule API Endpoint

```
GET https://api-b2b.tix.id/v1/schedules/movies/{movie_id}?city_id={city_id}&date=YYYY-MM-DD
```

**Response structure:**
```json
{
  "success": true,
  "data": {
    "theaters": [
      {
        "id": "1178839445860864000",
        "name": "AEON MALL JGC CGV",
        "address": "AEON Cakung Mall Lt. 3...",
        "merchant": {"merchant_name": "CGV"},
        "price_groups": [
          {
            "category": "REGULAR 2D",
            "price_string": "Rp46.000 - Rp51.000",
            "show_time": [
              {"display_time": "12:00", "id": "..."},
              {"display_time": "14:30", "id": "..."}
            ]
          }
        ]
      }
    ],
    "has_next": true  // Pagination indicator
  }
}
```

### Pagination Handling

Theatre results are paginated (10 per page). The scraper handles this by:

1. **Capturing auth headers** from the initial page 1 request
2. **Checking `has_next`** field in the response
3. **Using `context.request`** with captured headers to fetch pages 2, 3, etc.
4. **Stopping** when `has_next` is false or theatres list is empty

This ensures all theatres are captured (e.g., Jakarta has 80+ theatres across 9 pages).

### Performance Notes

- **Without `--schedules`**: ~5-8 minutes for all 83 cities
- **With `--schedules`**: ~45-75 minutes (navigates to each movie page)
- Use `--limit` or `--city` for faster testing

## License

MIT License - Feel free to use and modify.

