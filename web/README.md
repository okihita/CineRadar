# CineRadar Web 🎬

The consumer-facing web application for CineRadar. A beautiful, interactive movie browser for Indonesian cinema showtimes and real-time seat availability.

---

## ✨ Features

* 🍿 **Browse Now Playing** — See all movies currently showing across 83+ Indonesian cities.
* 🕒 **Real-Time Showtimes** — Detailed schedules grouped by city, theatre chain (XXI, CGV, Cinépolis), and format (IMAX, 4DX, Premiere).
* 💺 **Live Seat Occupancy** — View seat availability before heading to the cinema.
* 📱 **Mobile Optimized** — Clean, responsive design for moviegoers on any device.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
* **Styling**: Tailwind CSS v4
* **Data**: Live Firestore V2 (`schedules_v2/{today}/movies/{movieId}`) & `/api/live-seats`
* **Deployment**: Vercel ([cineradar.id](https://cineradar.id))

---

## 🚀 Getting Started

From the monorepo root:
```bash
# Start Consumer Web (runs on Port 3000)
pnpm run dev:web
```

Access the application at [http://localhost:3000](http://localhost:3000).

---

## 🔐 Environment Variables

Ensure you have the following in `web/.env.local` (copy from `.env.example`):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="cineradar-481014.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="cineradar-481014"
```
