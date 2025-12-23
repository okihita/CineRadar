# CineRadar Product Roadmap

> Based on product meeting notes (2025-12-23)

## Strategic Context

### Competitor Analysis
- **Cinepoint** (Emtek) - Works directly with XXI, strong on daily ticket data
- Current gap: PHs still manually check data, no analytics layer

### Target Users
- **Production Houses (PH)** - Need data for:
  - Screen allocation decisions
  - Regional marketing targeting
  - Digital campaign ROI analysis
  - Genre/timing strategy

---

## Phase 0: Strategic Decisions 🔴

> Must be defined before building features

- [ ] **Define main selling narrative** - What's CineRadar's unique value vs Cinepoint?
  - Option A: Direct competitor (daily ticket data)
  - Option B: Analytics/insights layer on top of existing data
  - Option C: Social media → ticket conversion specialist
- [ ] **Research Cinepoint 2025 offering** - Identify gaps to exploit
- [ ] **Validate with PH contacts** - What would they actually pay for?

---

## Phase 1: Regional Analytics MVP 🟡

> Core feature: Help PHs understand regional performance

- [ ] **Regional Genre Analytics Dashboard**
  - Performance breakdown by province
  - Historical trends (e.g., "horror performs 40% better in Jawa Barat")
  - Seasonal patterns by region

- [ ] **Theater Distribution Map**
  - Visualize # of screens per city/region
  - Highlight underserved vs oversaturated markets
  - Show capacity data (studio sizes)

- [ ] **Basic Reporting**
  - Export regional insights as PDF/spreadsheet
  - Weekly summary emails for subscribers

---

## Phase 2: Social Intelligence Layer 🟢

> Connect digital performance to ticket sales

- [ ] **Social Media Performance Tracker**
  - Track TikTok, Instagram, Twitter metrics for films
  - Views, engagement, sentiment over time
  - Compare pre-release buzz vs actual performance

- [ ] **Digital → Ticket Conversion Analysis**
  - Correlate social reach with box office
  - Identify anomalies (high views + low sales)
  - Build predictive model over time

- [ ] **Actor/Director Rankings**
  - Historical box office performance
  - Social media following/engagement
  - Genre affinity scores

---

## Phase 3: Trend Intelligence 🔵

> Predictive insights for film strategy

- [ ] **Trend Saturation Detector**
  - Track genre fatigue (e.g., religious films currently flopping)
  - Identify emerging themes
  - "Antitesis dari tren" analysis

- [ ] **Sentiment Analysis**
  - Socio-political sentiment affecting films
  - Controversy tracker for key talent
  - Real-time pulse of audience mood

- [ ] **Competitive Calendar**
  - What else is releasing?
  - Box office competition analysis
  - Optimal release window suggestions

---

## Phase 4: Screen Allocation Optimizer 🟣

> The holy grail for PHs

- [ ] **Screen Allocation Suggestions**
  - "Film genre X should target regions Y, Z"
  - Avoid mismatches (e.g., Christian films in Padang)
  - ROI-based regional prioritization

- [ ] **Ad Targeting Recommendations**
  - Don't waste ads on regions with few cinemas
  - Prioritize high-capacity markets
  - Budget allocation optimizer

- [ ] **OTT Impact Tracker**
  - Mark exclusive deals (OTT vs cinema)
  - Track OTT impact on cinema attendance
  - Timing recommendations (before OTT release)

---

## Data Sources to Integrate

- [ ] Current scraper data (CGV, XXI, etc.)
- [ ] Cinepoint historical data (if accessible)
- [ ] TikTok API / scraper
- [ ] Instagram API
- [ ] Twitter/X API
- [ ] Box office data (MTIX, etc.)
- [ ] OTT release schedules

---

## Key Metrics to Track

| Metric | Description |
|--------|-------------|
| Digital Reach | Total views/impressions across platforms |
| Conversion Rate | Reach → Ticket sales ratio |
| Regional Performance Index | Genre performance by province |
| Trend Saturation Score | How "tired" is a genre/theme |
| Screen Fill Rate | Occupancy vs capacity |

---

## Notes from Meeting

### Pain Points Mentioned
- "PH MASIH NGECEKIN MANUAL" - Manual data checking
- No clear digital → ticket conversion funnel
- Regional allocation is guesswork
- OTT deals affecting 2025 occupancy rates
- Genre fatigue (perselingkuhan, religious themes)

### Anomalies to Explain
- High views, low ticket sales (why?)
- Low views, high ticket sales (word of mouth?)
- Films affected by socio-political context (e.g., "Timur")

### Competitive Intelligence
- Cinepoint is part of Emtek
- Works directly with XXI
- PHs get data from Pak Naril / MTIX

---

*Last updated: 2025-12-23*
