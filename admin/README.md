# CineRadar Admin 📊

The professional intelligence and monitoring dashboard for CineRadar. Designed for production houses and cinema operators to track market trends, theatre distribution, and scraping health.

## Key Modules

- **Executive Dashboard** (`/`) - High-level KPIs for movie releases, theatre coverage, and regional performance.
- **Cinema Intelligence** (`/cinemas`) - Interactive Google Maps visualization of all 496+ theatres in Indonesia with chain-specific filtering and clustering.
- **Movie Intelligence** (`/movies`) - Deep dives into movie showtimes, schedule density, and market penetration.
- **Scraper Monitor** (`/scraper`) - Mission control for the data pipeline. Tracks daily scrape status, JIT seat scraping success, and TIX.id auth token health.
- **Advanced Analytics** - Targeted modules for Revenue, Trends, Audience, and Competition tracking.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 16 (App Router)
- **Styling**: Tailwind CSS 4.0 + shadcn/ui
- **Visualization**: Recharts (for analytics) & Google Maps Platform (for theatre mapping)
- **Authentication**: Firebase Admin with custom JWT REST client (optimized for Vercel/Serverless)
- **Icons**: Lucide React

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Ensure you have the following in `admin/.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cineradar-481014
FIREBASE_SERVICE_ACCOUNT_KEY='{"type": "service_account", ...}' # Single-line escaped JSON
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
```

---
*The data intelligence layer of CineRadar.*

