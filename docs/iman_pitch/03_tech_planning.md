# 🔧 2026 Technical Planning Document
## Week-by-Week Implementation Specifications

---

# H1: CineRadar AdTech (Weeks 1-24)

---

## JANUARY (Weeks 1-4)

### Week 1: Real-Time Occupancy API
**Tech Stack:**
- Runtime: Node.js 20 LTS
- WebSocket: Socket.io for real-time push
- REST API: Express.js with rate limiting
- Database: PostgreSQL with TimescaleDB extension (time-series optimization)
- Auth: JWT with refresh tokens
- Hosting: AWS Lambda + API Gateway

**Architecture:**
```
Scraper (every 15 min)
    ↓
PostgreSQL (raw data)
    ↓
┌─────────────────────────────────┐
│    CineRadar API Gateway        │
├─────────────────────────────────┤
│ GET /api/v1/occupancy/:theatreId│
│ GET /api/v1/occupancy/live      │
│ WS  /ws/occupancy/stream        │
└─────────────────────────────────┘
```

**Deliverables:**
- [ ] Extend scraper to 15-min intervals
- [ ] Create PostgreSQL schema with partitioning
- [ ] Build REST endpoints with Swagger docs
- [ ] Implement WebSocket streaming
- [ ] Deploy to AWS with auto-scaling

---

### Week 2: Predictive Demand Model
**Tech Stack:**
- ML: Python 3.11, scikit-learn, XGBoost
- Features: Pandas, NumPy
- API: FastAPI
- Model serving: AWS SageMaker or Lambda
- Dashboard: Streamlit (internal)

**Model Features:**
| Feature | Source | Type |
|---------|--------|------|
| Movie genre | TMDb API | Categorical |
| Cast popularity | Social metrics | Numeric |
| Budget tier | Industry data | Categorical |
| Day of week | Date | Cyclical |
| Holiday flag | Calendar | Binary |
| Weather | BMKG API | Numeric |
| Movie age (days since release) | Calculated | Numeric |

**Deliverables:**
- [ ] ETL pipeline for historical data
- [ ] Feature engineering notebook
- [ ] Train XGBoost model (MAE < 15%)
- [ ] FastAPI prediction endpoint
- [ ] Streamlit demo dashboard

---

### Week 3: Theatre Heat Score
**Tech Stack:**
- Python: Data processing
- PostgreSQL: Storage
- React: Frontend dashboard
- D3.js: Visualizations

**Scoring Algorithm:**
```python
heat_score = (
    0.3 * normalized_occupancy +
    0.25 * normalized_revenue +
    0.2 * normalized_concession +
    0.15 * growth_rate +
    0.1 * consistency_score
) * 100

# Output: 0-100 score
```

**Deliverables:**
- [ ] Define scoring formula with stakeholders
- [ ] Build calculation pipeline
- [ ] Create leaderboard UI
- [ ] Add drill-down analytics
- [ ] PDF export functionality

---

### Week 4: Developer Platform
**Tech Stack:**
- Portal: Next.js 14
- Docs: Mintlify or Docusaurus
- SDKs: TypeScript, Python
- Billing: Stripe integration
- Analytics: PostHog

**SDK Structure:**
```javascript
// JavaScript SDK
import { CineRadar } from '@cineradar/sdk';

const client = new CineRadar({ apiKey: 'cr_...' });
const occupancy = await client.occupancy.get('theatre_123');
```

```python
# Python SDK
from cineradar import CineRadar

client = CineRadar(api_key="cr_...")
occupancy = client.occupancy.get("theatre_123")
```

**Deliverables:**
- [ ] Developer portal with Next.js
- [ ] API key management system
- [ ] JavaScript SDK (npm publish)
- [ ] Python SDK (PyPI publish)
- [ ] Usage dashboard and billing

---

## FEBRUARY (Weeks 5-8)

### Week 5: Billboard Inventory Database
**Tech Stack:**
- Scraping: Python Scrapy
- Geocoding: Google Maps Places API
- Database: PostGIS (PostgreSQL + spatial)
- Visualization: Mapbox GL JS

**Data Schema:**
```sql
CREATE TABLE billboards (
    id UUID PRIMARY KEY,
    theatre_id UUID REFERENCES theatres(id),
    location GEOGRAPHY(POINT, 4326),
    size_sqm DECIMAL,
    orientation VARCHAR(20),
    estimated_daily_impressions INTEGER,
    current_cpm DECIMAL,
    photos JSONB,
    created_at TIMESTAMP
);
```

**Deliverables:**
- [ ] Scrape all cinema billboard locations
- [ ] Geocode with Google Places API
- [ ] Build PostGIS database
- [ ] Create Mapbox visualization
- [ ] Impression estimation model

---

### Week 6: Dynamic CPM Calculator
**Tech Stack:**
- Backend: Node.js
- Cache: Redis (pricing cache)
- Frontend: React with recharts

**Pricing Formula:**
```javascript
function calculateCPM(basePrice, occupancy, hour, isEvent) {
    const occupancyMultiplier = occupancy / avgOccupancy;
    const timeMultiplier = HOUR_MULTIPLIERS[hour]; // 0.7 - 1.5
    const eventMultiplier = isEvent ? 2.0 : 1.0;
    
    return basePrice * occupancyMultiplier * timeMultiplier * eventMultiplier;
}
```

**Deliverables:**
- [ ] Define pricing algorithm
- [ ] Build pricing API with Redis cache
- [ ] Create price trend visualizations
- [ ] A/B test framework
- [ ] Admin override interface

---

### Week 7: DOOH Integration API
**Tech Stack:**
- Integration: REST adapters
- Protocol: OpenRTB 2.5 compatible
- Queue: RabbitMQ for bid requests
- Monitoring: Grafana + Prometheus

**Partner Integrations:**
| Partner | Protocol | Priority |
|---------|----------|----------|
| Stickearn | REST API | High |
| Moving Walls | OpenRTB | Medium |
| Vistar Media | OpenRTB | Medium |

**Deliverables:**
- [ ] Stickearn adapter
- [ ] OpenRTB bid stream
- [ ] Campaign creation API
- [ ] Performance reporting
- [ ] Partner dashboard

---

### Week 8: Partnership Deals
**Not technical - BD/Sales week**

**Collateral Preparation:**
- [ ] Partner pitch deck (Figma → PDF)
- [ ] API demo environment
- [ ] Revenue share calculator spreadsheet
- [ ] Contract templates (legal review)

---

## MARCH (Weeks 9-12)

### Week 9: Studio Analytics Portal
**Tech Stack:**
- Frontend: Next.js 14 with App Router
- Multi-tenancy: Subdomain routing
- Auth: Clerk or NextAuth
- Export: React-PDF, PPTX generation

**Multi-Tenant Architecture:**
```
disney.cineradar.id → Disney tenant
warner.cineradar.id → Warner tenant
falcon.cineradar.id → Falcon tenant
```

**Deliverables:**
- [ ] Tenant provisioning system
- [ ] Custom branding per tenant
- [ ] Role-based access control
- [ ] PowerPoint export
- [ ] White-label mobile-responsive

---

### Week 10: Release Timing Optimizer
**Tech Stack:**
- Analysis: Python, Pandas
- Visualization: React + D3.js calendar
- Simulator: Monte Carlo simulation

**Simulation Model:**
```python
def simulate_release(movie, date, num_simulations=10000):
    results = []
    for _ in range(num_simulations):
        competitor_noise = np.random.normal(0, competitor_std)
        holiday_boost = holiday_multiplier(date)
        seasonal_factor = seasonality(date)
        
        predicted_bo = base_estimate * (1 + competitor_noise) * holiday_boost * seasonal_factor
        results.append(predicted_bo)
    
    return {
        'mean': np.mean(results),
        'p10': np.percentile(results, 10),
        'p90': np.percentile(results, 90)
    }
```

**Deliverables:**
- [ ] Historical release analysis
- [ ] Calendar heatmap visualization
- [ ] What-if simulator
- [ ] PDF recommendation report
- [ ] API for integrations

---

### Week 11: Competitive Intelligence
**Tech Stack:**
- Scraping: Playwright for JS-rendered pages
- NLP: OpenAI API for summarization
- Alerts: Telegram/Slack webhooks
- Dashboard: React with real-time updates

**Monitoring Sources:**
| Source | Frequency | Data Type |
|--------|-----------|-----------|
| KDB (Box Office) | Daily | Revenue |
| Social media | Hourly | Sentiment |
| News | Hourly | Coverage |
| Theatre schedules | Daily | Screen count |

**Deliverables:**
- [ ] Competitor movie tracker
- [ ] Screen count monitoring
- [ ] Alert system (Slack/Email)
- [ ] Weekly digest automation
- [ ] Trend analysis

---

### Week 12: Enterprise Sales
**Not technical - Sales execution week**

**Sales Tools:**
- [ ] ROI calculator (Google Sheets → Web app)
- [ ] Demo environment with sample data
- [ ] Case study one-pager
- [ ] Proposal generator

---

## APRIL (Weeks 13-16)

### Week 13: Pre-Roll Ad Marketplace MVP
**Tech Stack:**
- Frontend: Next.js
- Payments: Xendit (IDR) + Stripe (USD)
- Campaign management: PostgreSQL
- Creative hosting: Cloudflare R2

**Campaign Creation Flow:**
```
1. Advertiser signs up
2. Uploads creative (video/image)
3. Selects targeting (city, genre, time)
4. Sets budget and schedule
5. Pays via Xendit/Stripe
6. Campaign goes live
```

**Deliverables:**
- [ ] Advertiser portal
- [ ] Payment integration
- [ ] Campaign builder UI
- [ ] Creative upload + preview
- [ ] Basic reporting

---

### Week 14: Geo-Targeted Campaigns
**Tech Stack:**
- Geospatial: PostGIS
- UI: Mapbox draw tools
- Backend: Enhanced targeting logic

**Targeting Options:**
| Level | Description |
|-------|-------------|
| National | All Indonesia |
| Province | 38 provinces |
| City | 514 cities |
| Theatre | Individual venues |
| Radius | X km from point |

**Deliverables:**
- [ ] Province/city targeting
- [ ] Radius targeting with map
- [ ] Theatre-level selection
- [ ] Targeting preview (estimated reach)
- [ ] Price adjustment by geo

---

### Week 15: Audience Segmentation
**Tech Stack:**
- ML: K-means clustering + rule-based
- Pipeline: Apache Airflow
- Storage: BigQuery or PostgreSQL

**Segment Definitions:**
| Segment | Movies Watched | Demographics |
|---------|---------------|--------------|
| Action Fans | Marvel, Fast & Furious | 18-35 male |
| Rom-Com Lovers | Local romance films | 18-35 female |
| Family | Animation, Disney | 25-45, 2+ tickets |
| Horror Enthusiasts | Horror releases | 16-30 |
| Prestige | Oscar nominees | 30-50, premium seats |

**Deliverables:**
- [ ] Segment definition engine
- [ ] Movie-to-segment mapper
- [ ] Targeting UI integration
- [ ] Segment performance analytics
- [ ] Privacy documentation

---

### Week 16: DSP Integration
**Tech Stack:**
- Protocol: OpenRTB 2.5/2.6
- Server: High-performance Rust or Go bid server
- Infrastructure: Multi-region deployment

**OpenRTB Implementation:**
```json
// Bid Request (incoming)
{
    "id": "auction-123",
    "imp": [{
        "id": "1",
        "banner": { "w": 1920, "h": 1080 },
        "bidfloor": 0.5
    }],
    "site": {
        "id": "cineradar",
        "domain": "cineradar.id"
    }
}

// Bid Response (outgoing)
{
    "id": "auction-123",
    "seatbid": [{
        "bid": [{
            "id": "bid-456",
            "impid": "1",
            "price": 0.75,
            "adm": "<creative>"
        }]
    }]
}
```

**Deliverables:**
- [ ] OpenRTB bid server
- [ ] DV360 supply registration
- [ ] The Trade Desk integration
- [ ] Win notification handling
- [ ] Revenue attribution

---

## MAY (Weeks 17-20)

### Week 17: Dynamic Pricing Engine
**Tech Stack:**
- Optimization: Python, scipy.optimize
- Real-time: Redis + PostgreSQL
- Integration: REST API for POS systems

**Pricing Model:**
```python
def optimize_price(base_price, current_demand, time_to_show, competitor_prices):
    # Demand elasticity curve
    elasticity = calculate_elasticity(historical_data)
    
    # Maximize revenue: price * expected_demand(price)
    optimal = scipy.optimize.minimize_scalar(
        lambda p: -p * demand_curve(p, elasticity),
        bounds=(base_price * 0.5, base_price * 1.5)
    )
    
    return round(optimal.x, -3)  # Round to nearest 1000 IDR
```

**Deliverables:**
- [ ] Demand elasticity model
- [ ] Price optimization algorithm
- [ ] A/B testing framework
- [ ] Theatre POS API
- [ ] Revenue attribution dashboard

---

### Week 18: Bundle Recommendation AI
**Tech Stack:**
- ML: Collaborative filtering, Matrix factorization
- API: FastAPI
- Database: Redis for real-time recommendations

**Recommendation Engine:**
```python
# Movie → Concession mapping
{
    "action": {"top_item": "large_popcorn_combo", "attach_rate": 0.72},
    "horror": {"top_item": "nachos", "attach_rate": 0.65},
    "romance": {"top_item": "premium_snack_box", "attach_rate": 0.58}
}

# API: GET /recommend?movie_id=X&customer_segment=Y
```

**Deliverables:**
- [ ] Concession correlation analysis
- [ ] Recommendation API
- [ ] A/B testing in select theatres
- [ ] Revenue uplift tracking
- [ ] Model retraining pipeline

---

### Week 19: Flash Sale Automation
**Tech Stack:**
- Event-driven: Apache Kafka or Redis Streams
- Notifications: Firebase Cloud Messaging
- Rules engine: Node.js

**Automation Rules:**
```javascript
const flashSaleRules = [
    {
        condition: "occupancy < 30% AND hoursToShow < 2",
        action: "discount_40%",
        notification: true
    },
    {
        condition: "occupancy < 50% AND hoursToShow < 4",
        action: "discount_20%",
        notification: false
    }
];
```

**Deliverables:**
- [ ] Real-time occupancy monitor
- [ ] Rules engine
- [ ] Push notification integration
- [ ] Discount code generation
- [ ] Filled seats dashboard

---

### Week 20: Theatre Chain Integration
**Tech Stack:**
- Enterprise integration: REST/SOAP adapters
- Security: VPN tunnels, API key rotation
- Testing: Sandbox environments

**Integration Points:**
| Chain | System | Protocol |
|-------|--------|----------|
| XXI | Custom POS | REST API |
| CGV | Korean HQ system | SOAP/XML |
| Cinepolis | Global platform | REST API |

**Deliverables:**
- [ ] XXI sandbox integration
- [ ] Price sync mechanism
- [ ] Inventory webhook
- [ ] Error handling + alerts
- [ ] SLA monitoring

---

## JUNE (Weeks 21-24)

### Week 21: Premiere Analytics Dashboard
**Tech Stack:**
- Frontend: React + D3.js
- Social API: Twitter API v2, Instagram Graph API
- Sentiment: OpenAI or local NLP model
- Real-time: WebSocket for live updates

**Event Dashboard Components:**
| Panel | Data Source | Update Frequency |
|-------|-------------|-----------------|
| Social mentions | Twitter/IG API | Real-time |
| Sentiment gauge | NLP analysis | 5 minutes |
| Reach estimate | Follower aggregation | 30 minutes |
| Trending topics | Hashtag analysis | 15 minutes |

**Deliverables:**
- [ ] Event creation flow
- [ ] Social API integrations
- [ ] Real-time sentiment analysis
- [ ] Reach calculation engine
- [ ] Post-event PDF report

---

### Week 22: Influencer Tracking
**Tech Stack:**
- Database: PostgreSQL with JSONB
- Image recognition: AWS Rekognition or Google Vision
- Social scraping: Apify actors

**Influencer Database Schema:**
```sql
CREATE TABLE influencers (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    handles JSONB, -- {instagram: "...", tiktok: "..."}
    followers JSONB, -- {instagram: 500000, tiktok: 200000}
    category VARCHAR(50),
    engagement_rate DECIMAL,
    estimated_value DECIMAL
);
```

**Deliverables:**
- [ ] Influencer database (500+ entries)
- [ ] Event attendance tracking
- [ ] Post detection via mentions/hashtags
- [ ] ROI calculator per influencer
- [ ] Recommendation engine

---

### Week 23: Live Event Command Center
**Tech Stack:**
- Real-time: Socket.io + Redis pub/sub
- Multi-screen: React with grid layout
- Alerts: PagerDuty integration
- Mobile: React Native companion app

**Command Center Layout:**
```
┌────────────────┬────────────────┬────────────────┐
│ Social Feed    │ Sentiment      │ Trending       │
│ (real-time)    │ (live gauge)   │ (hashtags)     │
├────────────────┴────────────────┴────────────────┤
│              Reach Counter                        │
├────────────────┬────────────────┬────────────────┤
│ Crisis Alerts  │ Key Influencer │ Media Coverage │
│ (red/yellow)   │ Posts          │ (news clips)   │
└────────────────┴────────────────┴────────────────┘
```

**Deliverables:**
- [ ] Multi-screen dashboard
- [ ] Crisis alert system
- [ ] Mobile companion app
- [ ] Recording + playback
- [ ] Custom layout builder

---

### Week 24: Rekreasiyuk Integration
**Deliverables:**
- [ ] Package event tech as service
- [ ] Sales deck for Rekreasiyuk
- [ ] Training materials
- [ ] Handoff documentation
- [ ] Support escalation path

---

# H2: Portfolio Expansion (Weeks 25-48)

*[Abbreviated - same structure for each week]*

## JULY-SEPTEMBER (Q3)

### Week 25-28: Creative AI Suite
- **Tech:** Stable Diffusion, GPT-4 API, React
- **Focus:** Asset generation, brand compliance

### Week 29-32: Client Intelligence
- **Tech:** CRM (Salesforce or custom), sentiment analysis
- **Focus:** Client health scoring, competitor tracking

### Week 33-36: Experiential Tech
- **Tech:** AR (8th Wall), robotics (ROS2), sensors
- **Focus:** Interactive activations, event analytics

---

## OCTOBER-DECEMBER (Q4)

### Week 37-40: Content AI
- **Tech:** GPT-4, Whisper, DALL-E
- **Focus:** Article generation, podcast editing, thumbnails

### Week 41-44: Political Intelligence
- **Tech:** Social listening (Brandwatch or custom), NLP
- **Focus:** Sentiment dashboard, war room

### Week 45-48: Election Products
- **Tech:** Mobile (React Native), real-time (Kafka)
- **Focus:** Ground ops app, vote tracking

---

# Development Principles

1. **Ship weekly:** Every week ends with a deployable artifact
2. **Test on production:** Real data, real users, fast feedback
3. **Iterate fast:** Week 2 fixes Week 1 bugs, Week 3 adds features
4. **Document as you go:** Every API documented, every decision recorded
5. **Automate everything:** CI/CD, testing, monitoring from Day 1
