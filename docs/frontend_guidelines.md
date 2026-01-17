# Frontend Guidelines

This document outlines the standards, configurations, and best practices for the `admin` and `web` Next.js applications.

## Next.js Best Practices

### Hydration Rules

> [!WARNING]
> **Prevent hydration mismatch errors** by following these rules:

1.  **Never access `document` or `window` during render** - only in `useEffect` or event handlers.
2.  **Use `suppressHydrationWarning`** on `<html>` and `<body>` tags (already applied in `layout.tsx`).
3.  **Defer theme initialization** to client-side `useEffect`.
4.  **Don't use `Date.now()` or `Math.random()`** in component render.

### Runtime API Availability (Google Maps)

> [!CAUTION]
> **TypeScript passing ≠ Runtime working**. External APIs load asynchronously.

**Incorrect:**
```tsx
// ❌ google.maps.marker may not be loaded yet
const marker = new google.maps.marker.AdvancedMarkerElement({...});
```

**Correct:**
```tsx
// ✅ Use library hook to wait for API
const markerLib = useMapsLibrary('marker');
useEffect(() => {
  if (!markerLib) return; // Wait for API
  const marker = new markerLib.AdvancedMarkerElement({...});
}, [markerLib]);
```

---

## Configuration

### Time Display Convention

| Layer | Timezone | Example |
|-------|----------|---------|
| Firestore | UTC | `2025-12-18T00:15:08.000Z` |
| Backend/Scraper | UTC | `datetime.utcnow()` |
| **Admin/Web** | **WIB (UTC+7)** | `Dec 18, 7:15 AM WIB` |

**Implementation:**
- Admin: Use `formatWIB()` from `@/lib/timeUtils.ts`
- Web: Use `formatWIB()` function with `timeZone: 'Asia/Jakarta'`

### Brand Colors

| Chain | Color | Hex |
|-------|-------|-----|
| **XXI** | Tan/Gold | `#CFAB7A` |
| **CGV** | CG Red | `#E03C31` |
| **Cinépolis** | Midnight Blue | `#002069` |

### Geographic Regions

All 83 Indonesian cities are mapped to exactly 6 regions. **No "Others" category allowed.**

| Region | Color | Hex | Center (Lat, Lng) |
|--------|-------|-----|-------------------|
| **Jawa** | Teal | `#0d9488` | -7.0, 110.4 |
| **Sumatera** | Purple | `#7c3aed` | -0.5, 101.5 |
| **Kalimantan** | Pink | `#db2777` | 0.5, 116.5 |
| **Sulawesi** | Orange | `#ea580c` | -2.0, 121.0 |
| **Bali & NT** | Cyan | `#0891b2` | -8.5, 118.0 |
| **Papua & Maluku** | Lime | `#65a30d` | -3.5, 135.0 |

### Map Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| **Default zoom** | 5.5 | Shows all of Indonesia |
| **Clustering radius** | 80px | Groups nearby theatres |
| **Clustering max zoom** | 14 | At zoom 15+, show individual markers |
