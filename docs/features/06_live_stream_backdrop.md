# Feature Specification: Live Stream Backdrop & Broadcast Wall

## 1. Overview & Problem Statement
Every Thursday night between 20:00 and 22:00 WIB, the creator hosts a live TikTok streaming session focused on Indonesian box office analysis and cinema releases. Because Thursday is the official national premiere day for new theatrical movies across Indonesia, this 2-hour window represents the highest-interest period of the week for cinema enthusiasts, creators, and industry stakeholders.

During the broadcast, the streamer requires a dedicated visual display in the physical background (e.g. wall-mounted TV or secondary monitor behind the desk) or embedded directly in streaming software (OBS Studio / TikTok Live Studio) that shows:
1. Real-time quick count of nationwide showtimes today.
2. Comprehensive lineup of movies currently screening in theatres today.
3. Rapid-glance audience metrics (estimated admissions, seat occupancy rate %, circuit breakdown).

### Target Audience & Persona
- **Host / Creator**: Needs a zero-maintenance, distraction-free display that updates automatically without manual browser interaction.
- **TikTok Viewers**: Watching via mobile streams where text must be bold, large, high-contrast, and immediately legible through smartphone screens.

---

## 2. Navigation Architecture & Entry Points

### 2.1 Launch Pad: Head-to-Head Compare Page (`/compare`)
Rather than bloating the primary sidebar with an overlay-specific link, the Quick Count Viewer is launched directly from the analytical core of CineRadar Studio:
- **Location**: Top-right action bar of `PageHeader` on `/compare`.
- **Button Label**: `Quick Count Viewer`.
- **Behavior**: Launches `/stream` in a new window/tab (`target="_blank"`), forwarding active date context (e.g. `/stream?date=YYYY-MM-DD`).
- **Streamer Ergonomics**: Enables multi-monitor operations where the streamer retains full analytical control on the primary monitor while projecting the clean broadcast viewer onto the TV backdrop or OBS capture window.

### 2.2 Complete Menu & Chrome Suppression on `/stream`
To protect broadcast integrity and eliminate viewer distractions:
- The standard dashboard `<Sidebar />` is completely bypassed in `DashboardLayout.tsx` for all `/stream` routes.
- Navigation headers, user profiles, administrative links, and scrollbars are 100% hidden.
- The canvas operates as an edge-to-edge full-bleed presentation surface (`w-screen h-screen overflow-hidden bg-zinc-950`).
- Control elements (fullscreen toggle, aspect ratio switcher, exit button) auto-fade to zero opacity after 3 seconds of cursor inactivity.

---

## 3. Core Functional Requirements

### 3.1 Live National Quick Count HUD (Header Banner)
- **Live Clock**: Precision 24-hour Jakarta time (`HH:mm:ss WIB`) with an animated pulsing live broadcast indicator.
- **National Showtimes Counter**: Total showtimes scheduled across all circuits nationwide for the selected date.
- **Audience Quick Count**: Cumulative estimated admissions / seats filled across all monitored theatres.
- **National Average Occupancy**: Overall occupancy percentage with unified color coding from Critical (`#b91c1c`) to Peak (`#7e22ce`).
- **Circuit Footprint**: Monitored theatre counts across the 4 major Indonesian chains: Cinema XXI, CGV Cinemas, Cinépolis, and FLIX Cinema.

### 3.2 Today's Theatrical Leaderboard (Main Stage)
- **Ranked Film Grid**: Dynamic leaderboard ranking movies by audience volume and showtime share.
- **Movie Identity Card**:
  - High-resolution poster with clean aspect ratio.
  - Movie title, age rating badge (SU, 13+, 17+, 21+), and primary genres.
  - "Thursday Premiere" badge for newly released titles.
- **Performance Metrics**:
  - Total showtimes today.
  - Showtime market share percentage (e.g. `32.4%`).
  - Estimated admissions count.
  - Average occupancy percentage with performance tier badge.
- **Circuit Distribution Chips**: Visual badges indicating availability in XXI, CGV, Cinépolis, and FLIX with official brand colors.

### 3.3 Dual Display Engine (Layout Modes)
- **Mode A: Broadcast Wall (16:9 Landscape)**:
  - Optimized for 1920x1080 and 4K TV screens / landscape monitors placed physically behind the streamer.
  - Multi-column grid showcasing the top 6-8 films simultaneously, with secondary horizontal ticker for the remaining titles.
- **Mode B: Stream Canvas (9:16 Vertical)**:
  - Optimized for TikTok Live Studio or vertical OBS scene embedding (1080x1920).
  - Configurable safe zones: leaves a camera framing box in the center/upper third, placing the live HUD at the top and the active quick count leaderboard at the bottom.

### 3.4 Autonomous Broadcast Behavior
- **Zero-Touch Auto-Refresh**: Background data polling via SWR every 30-60 seconds to reflect JIT seat sweeps and updated evening showtimes throughout the stream.
- **Gentle Spotlight Animation**: Automatically cycles or highlights top-performing movies periodically to keep the background visually dynamic.
- **Keyboard Shortcuts**:
  - `F`: Toggle full-screen browser mode.
  - `L`: Switch between Landscape (16:9) and Vertical (9:16) layout modes.
  - `T`: Quick toggle to Today.
  - `Esc`: Exit / close broadcast mode back to `/compare`.
  - `Space`: Pause / resume auto-cycling.

---

## 4. Data Architecture & Integration

### 4.1 Data Endpoints
The feature operates 100% on existing Studio API infrastructure without requiring backend or scraper modifications:
- `GET /api/performance?date=YYYY-MM-DD`: Fetches real-time movie performance aggregates, daily admissions, occupancy percentages, and sweep timestamps.
- `GET /api/schedules?date=YYYY-MM-DD`: Supplies cinema circuits, city counts, and detailed room/format distribution.

### 4.2 Timezone & Formatting Compliance
- Strict 24-hour military notation (WIB) conforming to repository standards.
- Dates formatted in standard Indonesian/Jakarta conventions.

---

## 5. UI/UX Aesthetics & Design Tokens
- **Theme**: Ultra-dark OLED black (`#09090b`) with deep zinc surfaces (`zinc-900/90`) to prevent camera glare.
- **Accents**:
  - XXI Gold: `#CFAB7A`
  - CGV Red: `#E03C31`
  - Cinépolis Blue: `#002069`
  - FLIX Yellow: `#FFDA00`
- **Typography**: `JetBrains Mono` for all tabular numerals, percentages, and timestamps; `Inter` for titles and labels.
- **Zero Emojis Policy**: Text-only tags (`[LIVE]`, `[PREMIERE]`, `[TOP 1]`), crisp SVG icons, and geometric indicators.

---

## 6. Iteration Roadmap
- **Iteration 1 (Current Scope)**:
  - "Quick Count Viewer" button in Head-to-Head Compare (`/compare`) header.
  - Dedicated route `/stream` in `studio` with complete sidebar/menu omission.
  - Full-screen TV backdrop with live 24h WIB clock and pulsing status indicator.
  - Real-time national quick count HUD (Total Showtimes, Admissions, Occupancy).
  - Leaderboard grid of today's movies with circuit badges and share calculation.
  - Layout toggle (16:9 Landscape vs 9:16 Vertical) and Fullscreen trigger.
  - Auto-refresh polling every 30s.
  - Auto-hiding control cluster and keyboard shortcuts (`F`, `L`, `Esc`).
- **Iteration 2 (Future Enhancements)**:
  - Custom OBS Browser Source public token bypass (if streaming headless without session cookies).
  - Configurable camera cut-out box coordinates for OBS overlays.
  - Audio chime on milestone threshold crosses (e.g. 100k admissions milestone reached).
