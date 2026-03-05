# Product Roadmap & Engineering Strategy

> **Strategic Vision for CineRadar**
> "Become the Bloomberg of Indonesian Cinema Data."

---

## 🔮 Strategic Pillars

### Phase 1: Regional Analytics MVP 🟡 (Current)
*Core Value: Operational visibility for Production Houses.*
- [ ] **Regional Genre Analytics**: Heatmaps of horror vs. drama performance by province.
- [ ] **Theater Saturation**: Analysis of screen density vs. ticket sales.

### Phase 2: Social Intelligence Layer 🟢
*Core Value: Correlating "Buzz" with "Bucks".*
- [ ] **TikTok Trend Tracker**: Overlay viral hashtag volume on ticket sales graphs.
- [ ] **Conversion Modeling**: "Does 1M views equal 10k tickets?"

### Phase 3: Predictive Engine 🔵
*Core Value: Future-proofing investments.*
- [ ] **Genre Fatigue Detection**: Early warning system for oversaturated markets.
- [ ] **Release Window Optimizer**: Suggesting launch dates based on historical competitor data.

---

## 🧠 Engineering Retrospective: The "Why"

> **A Note to My Successor:**
> You might wonder why we chose this specific stack. We prioritize **Stability DNA**—boring, proven, LTS technology—over the "new and shiny".

### Why Firestore (NoSQL)?
We considered Postgres. However, our scraper schema changes weekly. TIX.id adds a field? We need to save it *now* without running migrations. Firestore gives us that schema flexibility. Plus, the **Real-time Listeners** allowed us to build the "Live Seat View" feature for minimal effort—something that would have required a complex WebSocket server with SQL.

### The Monorepo Decision
We have two apps (`admin` and `web`) that share 90% of their DNA: UI components, types, and business logic. Splitting them would have meant publishing private npm packages (too much overhead). The **pnpm workspace** allows us to share code instantly while keeping deployments isolated on Vercel.

---

## 📡 Tech Radar (Current Assessment)

| Technology | Status | Context |
|------------|--------|---------|
| **Next.js App Router** | **ADOPT** | The standard (v16). We treat strict LTS conformance as a goal. |
| **Tailwind CSS** | **ADOPT** | Velocity is unmatched. Custom design tokens enforce consistency. |
| **Python 3.12** | **ADOPT** | Strict typing (`mypy`) is non-negotiable for the scraper backend. |
| **Vercel** | **HOLD** | Great for now, but consider moving Docker containers to Cloud Run if scaling needs change. |
| **Google Cloud Functions** | **ADOPT** | Used for JIT Scraper. Perfect for event-driven, high-concurrency bursts (T-8 precision). |
