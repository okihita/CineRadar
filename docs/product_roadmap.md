# Product Roadmap & Strategy

> Strategic vision for CineRadar (Rekreasi.co).

## 🔮 Strategic Vision

**Goal:** Become the "Bloomberg" of Indonesian Cinema Data.
**Current State:** Phase 1 (Data Collection & Basic Reporting).

### Success Metrics (KPIs)
| Metric | Target | Current |
|--------|--------|---------|
| **City Coverage** | 100% of TIX.id (83 Cities) | 100% |
| **Scrape Success Rate** | > 98% Daily | ~95% |
| **Seat Data Granularity** | 15-min Intervals | 15-min |
| **Dashboard Latency** | < 2s P95 | ~1.5s |

---

## 🚧 Phase Plan

### Phase 1: Regional Analytics MVP 🟡 (Current)
*Core feature: Help PHs understand regional performance.*
- [ ] **Regional Genre Analytics Dashboard**: Performance by province, historical trends.
- [ ] **Theater Distribution Map**: Screens per city/region, saturation analysis.

### Phase 2: Social Intelligence Layer 🟢
*Connect digital performance to ticket sales.*
- [ ] **Social Media Performance Tracker**: TikTok/IG/Twitter tracking.
- [ ] **Digital → Ticket Conversion Analysis**: Correlation models.

### Phase 3: Trend Intelligence 🔵
*Predictive insights for film strategy.*
- [ ] **Trend Saturation Detector**: Genre fatigue (e.g., religious horror).
- [ ] **Sentiment Analysis**: Socio-political impact.

### Phase 4: Screen Allocation Optimizer 🟣
*The holy grail for PHs.*
- [ ] **Screen Allocation Suggestions**: "Genre X should target Region Y".
- [ ] **Ad Targeting Recommendations**: Budget optimization.

---

## 🧠 Architectural Decision Log (ADR)

### ADR-001: Playwright over Selenium
- **Why**: TIX.id uses heavy anti-bot obfuscation and React hydration. Playwright's auto-wait and stealth plugins handle this better than Selenium.
- **Status**: ✅ Adopted.

### ADR-002: Firestore (NoSQL) over Postgres
- **Why**:
    1.  **Schema Flexibility**: Scraper output fields change often.
    2.  **Real-time**: Listeners allowed for live dashboard updates.
    3.  **Cost**: Free tier handles our daily volume (20k writes).
- **Status**: ✅ Adopted.

### ADR-003: Vercel Monorepo deployment
- **Why**: Shared cache between `admin` and `web` speeds up builds by 40%.
- **Status**: ✅ Adopted.
