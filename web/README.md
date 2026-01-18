# CineRadar Web 🎬

The consumer-facing web application for CineRadar. A beautiful, interactive movie browser for Indonesian cinema showtimes and seat availability.

## Features

- 🍿 **Browse Now Playing** - See all movies currently showing in 83+ Indonesian cities.
- 🕒 **Real-time Showtimes** - Detailed schedules grouped by city and theatre chain (XXI, CGV, Cinépolis).
- 🗺️ **Interactive Maps** - Find theatres near you with fully integrated Leaflet maps.
- 💺 **Live Seat Occupancy** - Check how full a theatre is before you go.
- 📱 **Mobile Optimized** - Premium responsive design for moviegoers on the move.

## Tech Stack

- **Foundation**: [Next.js](https://nextjs.org) (App Router)
- **Styling**: Tailwind CSS 4.0
- **Maps**: Leaflet + React Leaflet
- **Data**: Firestore (via REST API)
- **Deployment**: Vercel

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Data Source

The web app fetches its data from a Firestore "latest" snapshot, which is updated daily at 6:00 AM WIB by the [CineRadar Scraper](../backend).

---
*Part of the CineRadar ecosystem.*

