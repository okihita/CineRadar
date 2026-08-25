# CineRadar Studio Dashboard 📊

The professional intelligence and monitoring dashboard for CineRadar. Designed for production houses and cinema operators to track market trends, theatre distribution, box office metrics, and scraping health.

---

## 🎯 Key Modules

* **Cinema Intelligence** (`/cinemas`) — Interactive Google Maps visualization of all 496+ theatres in Indonesia with chain-specific filtering and studio capacity matrix.
* **Movie Intelligence** (`/movies`) — Deep dives into movie showtimes, schedule density, and market penetration.
* **Performance Analytics** (`/performances`) — Pre-aggregated daily admissions, seat occupancy trajectories, and historical trends.
* **Competitor Benchmarking** (`/competitors/cinepoint`) — CinePoint daily box office, director rankings, actor rankings, and comparative charts.
* **Social Pulse** (`/social-feed`) — Multi-channel YouTube & social feed tracking with hourly Gemini AI pulse summaries.
* **Scraper Monitor** (`/scraper`) — Mission control for the data pipeline. Tracks daily scrape status, JIT seat scraping success, and TIX ID auth token health.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
* **Styling**: Tailwind CSS v4 + Radix UI Primitives
* **Visualization**: Recharts & Google Maps Platform
* **Authentication**: NextAuth v5 (Auth.js) with Google OAuth provider
* **Data Layer**: Cloud Firestore V2 & Google Generative AI (Gemini)

---

## 🚀 Getting Started

From the monorepo root:
```bash
# Start Studio Dashboard (runs on Port 3001)
pnpm run dev:admin
```

Access the dashboard at [http://localhost:3001](http://localhost:3001).

---

## 🔐 Environment Variables

Ensure you have the following configured in `admin/.env.local` (copy from `.env.example`):

```bash
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_PROJECT_ID="cineradar-481014"
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSy..."

# Firebase Admin SDK (Split Credentials)
FIREBASE_PROJECT_ID="cineradar-481014"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@cineradar-481014.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# NextAuth v5 Configuration
AUTH_SECRET="your_32_byte_secret"
AUTH_URL="http://localhost:3001"
GOOGLE_CLIENT_ID="your_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your_client_secret"

# Market Intelligence & AI
GEMINI_API_KEY="AIzaSy..."
CINEPOINT_REFRESH_TOKEN="eyJhbGci..."
```
