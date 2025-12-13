# CineRadar 🎬

A Python scraper for TIX.id - Indonesia's cinema ticket booking platform. Scrapes movie listings, theatre schedules, and showtimes across all Indonesian cities.

## Features

- 🏙️ **83 Indonesian cities** - Scrape movie data from all TIX-supported cities
- 🎬 **Movie availability tracking** - See which movies are showing in which cities
- 🎭 **Theatre schedules** - Get showtimes with room types, prices, and time slots
- 🏷️ **Pre-sale detection** - Identifies advance ticket sales vs now playing
- 🤖 **Anti-bot detection** - Stealth mode with proper auth flow
- 📊 **Daily reports** - Track movie availability over time
- ⚡ **Fast & reliable** - Uses Playwright with response interception
- 🌐 **Next.js dashboard** - Beautiful frontend to browse movies and showtimes
- 🗺️ **Admin dashboard** - Theatre intelligence with Google Maps coverage

## Live Demos

| App | URL | Description |
|-----|-----|-------------|
| **Web** | Coming soon | Movie browser for end users |
| **Admin** | [cineradar-admin.vercel.app](https://cineradar-admin.vercel.app/) | Theatre intelligence dashboard |

## Project Structure

```
CineRadar/
├── scraper/                 # Python scraper module
│   ├── __init__.py
│   ├── __main__.py          # CLI entry point
│   ├── config.py            # Cities & API configuration
│   └── tix_client.py        # Core scraping logic
├── admin/                   # Next.js admin dashboard
│   └── src/
│       ├── app/page.tsx     # Main dashboard
│       └── components/
│           └── indonesia-map.tsx  # Google Maps component
├── web/                     # Next.js frontend (movie browser)
│   └── src/
│       ├── app/page.tsx
│       └── components/
├── data/                    # Scraped JSON files
├── geocode_theatres.py      # Add lat/lng to theatres
├── populate_firestore.py    # Upload to Firebase
├── requirements.txt
└── README.md
```

## Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/okihita/CineRadar.git
cd CineRadar

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### Run Scraper

```bash
# Basic scrape (all 83 cities, no showtimes)
python -m scraper

# Include detailed showtimes (slower, ~45-75 min)
python -m scraper --schedules

# Scrape single city with showtimes
python -m scraper --city JAKARTA --schedules

# Show browser window (for debugging)
python -m scraper --visible

# Limit to first N cities (for testing)
python -m scraper --limit 5
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--schedules` | Fetch detailed theatre showtimes (~45-75 min for all cities) |
| `--city NAME` | Scrape specific city only (e.g., `JAKARTA`) |
| `--limit N` | Limit to first N cities (for testing) |
| `--visible` | Show browser window (default: headless) |
| `--output DIR` | Output directory (default: `data/`) |

### Run Frontend

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

### Run Admin Dashboard

```bash
cd admin
npm install
npm run dev
# Open http://localhost:3000
```

**Environment variables for admin:**
```bash
# admin/.env.local
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
```

## GitHub Actions (Automated Scraping)

The scraper runs automatically via GitHub Actions:

| Workflow | Schedule | Description |
|----------|----------|-------------|
| `daily-scrape.yml` | 6:00 AM WIB daily | Scrapes movies + showtimes → Firestore |
| `monthly-geocode.yml` | 1st of month 7:00 AM | Geocodes new theatres via Google Places |

### Required Secrets

Add these in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON from Firebase Console |

### Manual Trigger

Go to **Actions** → Select workflow → **Run workflow**

### View Logs

Click on any workflow run to see live logs as it executes.

## How It Works

## 📦 Data Format

```json
{
  "scraped_at": "2025-12-12 13:00:00",
  "date": "2025-12-12",
  "summary": {
    "total_cities": 83,
    "total_movies": 30,
    "presale_count": 7
  },
  "movies": [
    {
      "id": "1977633929036906496",
      "title": "AGAK LAEN: MENYALA PANTIKU!",
      "genres": ["Drama"],
      "poster": "https://asset.tix.id/movie_poster_v2/...",
      "age_category": "R",
      "country": "Indonesia",
      "merchants": ["XXI", "CGV", "Cinépolis"],
      "is_presale": false,
      "cities": ["JAKARTA", "SURABAYA", "BANDUNG", ...],
      "schedules": {
        "JAKARTA": [
          {
            "theatre_id": "1178839445860864000",
            "theatre_name": "AEON MALL JGC CGV",
            "merchant": "CGV",
            "address": "AEON Mall Lt. 3...",
            "rooms": [
              {
                "category": "REGULAR 2D",
                "price": "Rp46.000 - Rp51.000",
                "showtimes": ["12:00", "14:30", "17:00", "19:30"]
              }
            ]
          }
        ]
      }
    }
  ],
  "city_stats": {
    "JAKARTA": 28,
    "SURABAYA": 22,
    ...
  }
}
```

## Web Frontend

The Next.js dashboard provides a movie-browser interface:

### Layout

```
┌─────────────────┬─────────────────────────────────────────┐
│   Movie List    │                                         │
│   (Sidebar)     │         Selected Movie Details          │
│                 │                                         │
│  1. Movie A     │   [POSTER] Title                        │
│  2. Movie B ◄─  │   🏷️ PRE-SALE  [Drama] [R]             │
│  3. Movie C     │   83 cities • 200 theatres              │
│  ...            │                                         │
│                 │   ▼ JAKARTA (82 theatres)               │
│  [Search]       │     ├─ Cinema XXI                       │
│                 │     │  REGULAR 2D: 12:00 14:30 17:00    │
│  28 movies      │     └─ CGV                              │
└─────────────────┴─────────────────────────────────────────┘
```

### Features

- **Movie sidebar** with search, poster thumbnails, city counts
- **PRE-SALE badges** for advance ticket sales
- **Age ratings** with color coding (SU/R/D)
- **Collapsible city sections** with theatre details
- **Showtime buttons** with gradient styling

## Technical Details

### Schedule API Pagination

Theatre results are paginated (10 per page). The scraper handles this by:

1. **Capturing auth headers** from the initial page 1 request
2. **Checking `has_next`** field in the response
3. **Using `context.request`** with captured headers for pages 2, 3, etc.
4. **Stopping** when `has_next` is false

This ensures all theatres are captured (e.g., Jakarta has 80+ theatres across 9 pages).

### Pre-Sale Detection

Movies with advance ticket sales are identified by `presale_flag: 1` in the API response, stored as `is_presale: true` in the output.

### Performance

- **Without `--schedules`**: ~5-8 minutes for all 83 cities
- **With `--schedules`**: ~45-75 minutes (navigates to each movie page)
- Use `--limit` or `--city` for faster testing

## Supported Cities (83)

<details>
<summary>Click to expand full list</summary>

AMBON, BALI, BALIKPAPAN, BANDUNG, BANJARBARU, BANJARMASIN, BATAM, BAUBAU, BEKASI, BENGKULU, BINJAI, BLITAR, BOGOR, BONDOWOSO, BONTANG, CIANJUR, CIKARANG, CILEGON, CIREBON, DEPOK, DUMAI, DURI, GARUT, GORONTALO, GRESIK, INDRAMAYU, JAKARTA, JAMBI, JAYAPURA, JEMBER, KARAWANG, KEDIRI, KENDARI, KETAPANG, KISARAN, KLATEN, KUALA KAPUAS, KUPANG, LAMPUNG, LUBUKLINGGAU, MADIUN, MAKASSAR, MALANG, MAMUJU, MANADO, MANOKWARI, MATARAM, MEDAN, MOJOKERTO, PADANG, PALANGKARAYA, PALEMBANG, PALU, PANGKAL PINANG, PEKALONGAN, PEKANBARU, PEMATANG SIANTAR, PONOROGO, PONTIANAK, PRABUMULIH, PROBOLINGGO, PURWAKARTA, PURWOKERTO, RANTAU PRAPAT, ROKAN HILIR, SAMARINDA, SAMPIT, SEMARANG, SERANG, SIDOARJO, SINGKAWANG, SOLO, SORONG, SUMEDANG, SURABAYA, TANGERANG, TANJUNG PINANG, TARAKAN, TASIKMALAYA, TEGAL, TERNATE, TIMIKA, YOGYAKARTA

</details>

## License

MIT License - Feel free to use and modify.
