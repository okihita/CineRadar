# 🔧 H2 2026 Technical Planning
## Portfolio Expansion: Creative AI, Experiential Tech, Political Intelligence (July - December)

---

## Executive Summary

H2 2026 expands the CineRadar platform beyond cinema into three new verticals:
1. **Creative AI Suite** - Generative tools for advertising agencies
2. **Experiential Tech** - AR/IoT for brand activations
3. **Political Intelligence** - Analytics for election campaigns

### Technology Stack (Latest Stable - H2 2026)

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **AI/ML** | OpenAI GPT-4 Turbo | Latest | Text generation, analysis |
| **Image AI** | Stable Diffusion XL | 1.0 | Image generation |
| **Video AI** | Runway ML Gen-3 | Latest | Video generation |
| **AR Platform** | 8th Wall | Latest | Web-based AR |
| **IoT** | ESP32 + MQTT | - | Sensor integration |
| **Mobile** | React Native | 0.76+ | Cross-platform apps |
| **Streaming** | Apache Kafka | 3.7+ | Real-time event processing |
| **Analytics** | ClickHouse | 24.x | Fast OLAP queries |

---

# JULY (Weeks 25-28)
## Creative AI Suite for Agencies

---

### Week 25: AI Asset Generator

**Objective:** Generate advertising creative assets using AI.

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Creative AI Pipeline                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Brief      │───▶│  AI Engine  │───▶│  Assets     │ │
│  │  Input      │    │  (Multi-AI) │    │  Gallery    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                   │        │
│         ▼                  ▼                   ▼        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Brand      │    │  ComfyUI    │    │  CDN        │ │
│  │  Guidelines │    │  Workflow   │    │  (R2/S3)    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Image Gen | Stable Diffusion XL + ComfyUI | Custom image generation |
| Video Gen | Runway Gen-3 API | Video creation |
| Text | GPT-4 Turbo | Copy generation |
| Backend | Python FastAPI | Orchestration |
| Queue | BullMQ | Job processing |
| Storage | Cloudflare R2 | Asset CDN |

#### Image Generation Pipeline

```python
# creative_engine.py - AI asset generation
from comfyui_api import ComfyUIClient
from openai import OpenAI
from pydantic import BaseModel
from typing import Literal

class CreativeBrief(BaseModel):
    brand_name: str
    product: str
    target_audience: str
    tone: Literal["professional", "playful", "luxury", "bold"]
    format: Literal["instagram_story", "billboard", "banner_300x250"]
    key_message: str
    brand_colors: list[str]

class GeneratedAsset(BaseModel):
    url: str
    format: str
    prompt_used: str
    generation_time_ms: int

async def generate_creative(brief: CreativeBrief) -> list[GeneratedAsset]:
    """Generate advertising creative from brief"""
    
    # 1. Generate optimized prompt with GPT-4
    prompt = await generate_sd_prompt(brief)
    
    # 2. Generate images with ComfyUI
    comfy = ComfyUIClient("http://comfyui:8188")
    
    workflow = {
        "checkpoint": "sd_xl_base_1.0.safetensors",
        "prompt": prompt,
        "negative_prompt": "text, watermark, low quality",
        "width": FORMAT_SIZES[brief.format]["width"],
        "height": FORMAT_SIZES[brief.format]["height"],
        "batch_size": 4,  # Generate 4 variations
    }
    
    images = await comfy.generate(workflow)
    
    # 3. Apply brand colors overlay (optional)
    branded_images = await apply_brand_styling(images, brief.brand_colors)
    
    # 4. Upload to CDN
    assets = []
    for img in branded_images:
        url = await upload_to_r2(img)
        assets.append(GeneratedAsset(
            url=url,
            format=brief.format,
            prompt_used=prompt,
            generation_time_ms=img.generation_time
        ))
    
    return assets

async def generate_sd_prompt(brief: CreativeBrief) -> str:
    """Use GPT-4 to create optimized Stable Diffusion prompt"""
    client = OpenAI()
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{
            "role": "system",
            "content": """You are an expert at creating Stable Diffusion prompts 
            for advertising. Create a detailed prompt that will produce 
            professional advertising imagery."""
        }, {
            "role": "user",
            "content": f"""Create an SD prompt for:
            Brand: {brief.brand_name}
            Product: {brief.product}
            Audience: {brief.target_audience}
            Tone: {brief.tone}
            Message: {brief.key_message}
            Format: {brief.format}"""
        }]
    )
    
    return response.choices[0].message.content
```

#### Deliverables

- [ ] ComfyUI deployment with custom workflows
- [ ] Brand guidelines ingestion system
- [ ] Multi-format asset generation (9 formats)
- [ ] Variation generation (4 per brief)
- [ ] Asset gallery with search

---

### Week 26: Brand Compliance Checker

**Objective:** Ensure AI-generated assets comply with brand guidelines.

#### Compliance Engine

```python
# compliance_checker.py
from openai import OpenAI
from PIL import Image
import colorsys

class BrandGuidelines(BaseModel):
    primary_colors: list[str]  # Hex codes
    secondary_colors: list[str]
    forbidden_elements: list[str]
    required_elements: list[str]
    logo_usage_rules: str
    typography_rules: str

class ComplianceResult(BaseModel):
    is_compliant: bool
    score: float  # 0-100
    issues: list[str]
    suggestions: list[str]

async def check_brand_compliance(
    image_url: str,
    guidelines: BrandGuidelines
) -> ComplianceResult:
    """Check if image complies with brand guidelines"""
    
    # 1. Color analysis
    img = Image.open(await download_image(image_url))
    dominant_colors = extract_dominant_colors(img, n=5)
    color_score = check_color_compliance(dominant_colors, guidelines)
    
    # 2. Content analysis with GPT-4 Vision
    client = OpenAI()
    
    response = await client.chat.completions.create(
        model="gpt-4-vision-preview",
        messages=[{
            "role": "system",
            "content": f"""Analyze this advertising image for brand compliance.
            
            Brand Guidelines:
            - Forbidden elements: {guidelines.forbidden_elements}
            - Required elements: {guidelines.required_elements}
            - Logo rules: {guidelines.logo_usage_rules}
            
            Return JSON with: issues (list), suggestions (list), compliant (bool)"""
        }, {
            "role": "user",
            "content": [{"type": "image_url", "image_url": image_url}]
        }]
    )
    
    analysis = json.loads(response.choices[0].message.content)
    
    # 3. Calculate overall score
    issues = analysis.get("issues", [])
    if color_score < 70:
        issues.append(f"Color palette deviation: {color_score}% match")
    
    overall_score = calculate_compliance_score(color_score, analysis)
    
    return ComplianceResult(
        is_compliant=overall_score >= 80 and len(issues) == 0,
        score=overall_score,
        issues=issues,
        suggestions=analysis.get("suggestions", [])
    )
```

#### Deliverables

- [ ] Brand guidelines upload (PDF parsing)
- [ ] Color palette extraction and matching
- [ ] GPT-4 Vision content analysis
- [ ] Compliance scoring (0-100)
- [ ] Auto-fix suggestions

---

### Week 27: Video AI Generator

**Objective:** Generate short-form video ads with AI.

#### Video Pipeline

```python
# video_generator.py
import runway
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip

class VideoSpec(BaseModel):
    duration: Literal[6, 15, 30]  # seconds
    format: Literal["vertical_9_16", "horizontal_16_9", "square_1_1"]
    scenes: list[SceneSpec]
    music: Optional[str]
    voiceover: Optional[str]

class SceneSpec(BaseModel):
    prompt: str
    duration: float
    transition: Literal["cut", "fade", "dissolve"]
    text_overlay: Optional[str]

async def generate_video(spec: VideoSpec) -> str:
    """Generate video ad using Runway Gen-3"""
    
    clips = []
    
    for scene in spec.scenes:
        # Generate scene with Runway
        runway_client = runway.Client(api_key=os.environ["RUNWAY_API_KEY"])
        
        task = await runway_client.image_to_video.create(
            prompt=scene.prompt,
            duration=scene.duration,
            ratio=FORMAT_TO_RATIO[spec.format]
        )
        
        # Wait for generation
        while task.status != "complete":
            await asyncio.sleep(2)
            task = await runway_client.tasks.get(task.id)
        
        clip = VideoFileClip(task.output_url)
        
        # Add text overlay if specified
        if scene.text_overlay:
            txt_clip = TextClip(
                scene.text_overlay,
                fontsize=48,
                color='white',
                font='Montserrat-Bold'
            ).set_position('bottom').set_duration(scene.duration)
            clip = CompositeVideoClip([clip, txt_clip])
        
        clips.append(clip)
    
    # Concatenate with transitions
    final = concatenate_with_transitions(clips, spec)
    
    # Add music/voiceover
    if spec.music:
        final = add_background_music(final, spec.music)
    if spec.voiceover:
        final = add_voiceover(final, spec.voiceover)
    
    # Export
    output_path = f"/tmp/{uuid4()}.mp4"
    final.write_videofile(output_path, codec="libx264")
    
    return await upload_to_r2(output_path)
```

#### Deliverables

- [ ] Runway Gen-3 API integration
- [ ] Multi-scene video composition
- [ ] Text overlay with brand fonts
- [ ] Background music library
- [ ] AI voiceover (ElevenLabs)

---

### Week 28: Creative AI Dashboard

**Objective:** Agency-facing UI for creative generation.

#### Dashboard Features

```typescript
// Creative AI Dashboard - Next.js 16
const CreativeAIDashboard = () => {
    const [brief, setBrief] = useState<CreativeBrief>(defaultBrief);
    const [assets, setAssets] = useState<GeneratedAsset[]>([]);
    const [generating, setGenerating] = useState(false);

    return (
        <div className="flex h-screen">
            {/* Brief Input Panel */}
            <aside className="w-80 border-r p-6">
                <BriefForm 
                    value={brief} 
                    onChange={setBrief}
                    onGenerate={handleGenerate}
                />
                <BrandGuidelineUploader />
            </aside>

            {/* Asset Gallery */}
            <main className="flex-1 p-6">
                <AssetGallery 
                    assets={assets}
                    onSelect={handleSelectAsset}
                    onRegenerate={handleRegenerate}
                />
            </main>

            {/* Compliance Sidebar */}
            <aside className="w-72 border-l p-6">
                <ComplianceChecker asset={selectedAsset} />
                <ExportOptions asset={selectedAsset} />
            </aside>
        </div>
    );
};
```

#### Deliverables

- [ ] Brief input form with templates
- [ ] Real-time generation progress
- [ ] Asset gallery with variations
- [ ] Compliance score display
- [ ] Export to multiple formats

---

# AUGUST (Weeks 29-32)
## Client Intelligence Platform

---

### Week 29: CRM Integration

**Objective:** Track client relationships and opportunities.

#### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| CRM | Custom (PostgreSQL) | Client data |
| Email | Resend API | Outreach tracking |
| Calendar | Cal.com / Google | Meeting scheduling |
| Dashboard | Next.js 16 | Client portal |

#### Data Model

```sql
-- Client Intelligence Schema
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL,
    industry VARCHAR(50),
    tier VARCHAR(20) DEFAULT 'prospect',  -- prospect, active, enterprise
    
    -- Contact
    primary_contact_id UUID REFERENCES contacts(id),
    
    -- Financials
    annual_spend_idr DECIMAL(15,2) DEFAULT 0,
    lifetime_value_idr DECIMAL(15,2) DEFAULT 0,
    
    -- Health scoring
    health_score INTEGER,  -- 0-100
    last_engagement TIMESTAMPTZ,
    churn_risk VARCHAR(20),  -- low, medium, high
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    type VARCHAR(50),  -- email, call, meeting, support
    direction VARCHAR(10),  -- inbound, outbound
    summary TEXT,
    sentiment VARCHAR(20),  -- positive, neutral, negative
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health score calculation
CREATE OR REPLACE FUNCTION calculate_health_score(client_id UUID) 
RETURNS INTEGER AS $$
DECLARE
    engagement_score INTEGER;
    revenue_score INTEGER;
    sentiment_score INTEGER;
    recency_score INTEGER;
BEGIN
    -- Engagement: interactions in last 30 days
    SELECT LEAST(COUNT(*) * 10, 30) INTO engagement_score
    FROM client_interactions
    WHERE client_id = client_id
    AND created_at > NOW() - INTERVAL '30 days';
    
    -- Revenue: relative to average
    SELECT CASE 
        WHEN annual_spend_idr > 1000000000 THEN 30
        WHEN annual_spend_idr > 500000000 THEN 25
        WHEN annual_spend_idr > 100000000 THEN 20
        ELSE 10
    END INTO revenue_score
    FROM clients WHERE id = client_id;
    
    -- Sentiment: recent interaction sentiment
    SELECT CASE 
        WHEN sentiment = 'positive' THEN 25
        WHEN sentiment = 'neutral' THEN 15
        ELSE 5
    END INTO sentiment_score
    FROM client_interactions
    WHERE client_id = client_id
    ORDER BY created_at DESC LIMIT 1;
    
    -- Recency: days since last interaction
    SELECT CASE 
        WHEN last_engagement > NOW() - INTERVAL '7 days' THEN 15
        WHEN last_engagement > NOW() - INTERVAL '30 days' THEN 10
        ELSE 5
    END INTO recency_score
    FROM clients WHERE id = client_id;
    
    RETURN engagement_score + revenue_score + 
           COALESCE(sentiment_score, 0) + recency_score;
END;
$$ LANGUAGE plpgsql;
```

#### Deliverables

- [ ] Client database with health scoring
- [ ] Interaction tracking (email, calls, meetings)
- [ ] Churn risk prediction
- [ ] Client dashboard with timeline
- [ ] Alert system for at-risk clients

---

### Week 30: Competitor Tracking Dashboard

**Objective:** Monitor competitor activities in real-time.

#### Monitoring Sources

```python
# competitor_monitor.py
from playwright.async_api import async_playwright
from apify_client import ApifyClient
import asyncio

class CompetitorMonitor:
    def __init__(self):
        self.apify = ApifyClient(os.environ["APIFY_API_KEY"])
    
    async def monitor_social_media(self, competitor: str) -> dict:
        """Track competitor social media activity"""
        
        tasks = [
            self.scrape_instagram(competitor),
            self.scrape_linkedin(competitor),
            self.scrape_twitter(competitor),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "instagram": results[0],
            "linkedin": results[1],
            "twitter": results[2],
            "scraped_at": datetime.utcnow().isoformat()
        }
    
    async def scrape_instagram(self, handle: str) -> dict:
        """Scrape Instagram using Apify"""
        
        run = await self.apify.actor("apify/instagram-scraper").call(
            run_input={
                "directUrls": [f"https://instagram.com/{handle}"],
                "resultsType": "posts",
                "resultsLimit": 20
            }
        )
        
        items = await self.apify.dataset(run["defaultDatasetId"]).list_items()
        
        return {
            "posts": items.items,
            "engagement_rate": calculate_engagement(items.items),
            "posting_frequency": calculate_frequency(items.items)
        }
    
    async def track_news_mentions(self, competitor: str) -> list:
        """Track news mentions using Google Alerts alternative"""
        
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Search Google News
            await page.goto(f"https://news.google.com/search?q={competitor}")
            
            articles = await page.evaluate("""
                () => Array.from(document.querySelectorAll('article'))
                    .map(a => ({
                        title: a.querySelector('h3')?.textContent,
                        source: a.querySelector('time')?.textContent,
                        url: a.querySelector('a')?.href
                    }))
            """)
            
            await browser.close()
            return articles
```

#### Deliverables

- [ ] Social media monitoring (IG, LinkedIn, Twitter)
- [ ] News mention tracking
- [ ] Share of voice calculation
- [ ] Competitor activity timeline
- [ ] Weekly digest reports

---

### Week 31-32: Experiential Tech Foundation

**Objective:** Build AR and IoT capabilities for brand activations.

#### AR Platform (8th Wall)

```javascript
// ar-activation.js - 8th Wall WebAR
const initAR = async () => {
    // Initialize 8th Wall
    await XR8.addCameraPipelineModule(
        XR8.XrController.pipelineModule()
    );
    
    // Add custom AR content
    XR8.addCameraPipelineModule({
        name: 'cineradar-activation',
        
        onStart: () => {
            // Load 3D model
            const model = document.getElementById('ar-model');
            model.setAttribute('src', BRAND_3D_MODEL_URL);
        },
        
        onUpdate: ({ processCpuResult }) => {
            // Face tracking for filters
            if (processCpuResult.face) {
                updateFaceFilter(processCpuResult.face);
            }
        },
        
        // Image target tracking
        onImageFound: (e) => {
            const { name, position, rotation } = e.detail;
            showProductInfo(name, position, rotation);
        }
    });
    
    XR8.run({ canvas: document.getElementById('ar-canvas') });
};
```

#### IoT Sensor Platform

```python
# sensor_platform.py - ESP32 + MQTT
import paho.mqtt.client as mqtt
from dataclasses import dataclass
from datetime import datetime

@dataclass
class SensorReading:
    sensor_id: str
    event_id: str
    value: float
    unit: str
    timestamp: datetime

class EventSensorPlatform:
    def __init__(self, mqtt_broker: str):
        self.client = mqtt.Client()
        self.client.connect(mqtt_broker)
        self.client.on_message = self.handle_message
        
    def handle_message(self, client, userdata, msg):
        """Process incoming sensor data"""
        data = json.loads(msg.payload)
        
        reading = SensorReading(
            sensor_id=data["sensor_id"],
            event_id=data["event_id"],
            value=data["value"],
            unit=data["unit"],
            timestamp=datetime.fromisoformat(data["timestamp"])
        )
        
        # Store in ClickHouse for analytics
        self.store_reading(reading)
        
        # Real-time alerts
        self.check_thresholds(reading)
    
    async def store_reading(self, reading: SensorReading):
        """Store in ClickHouse for time-series analytics"""
        await clickhouse.execute("""
            INSERT INTO sensor_readings 
            (sensor_id, event_id, value, unit, timestamp)
            VALUES
        """, [reading])
```

#### Deliverables

- [ ] 8th Wall AR template library
- [ ] Image target recognition
- [ ] Face filter framework
- [ ] ESP32 sensor firmware
- [ ] MQTT → ClickHouse pipeline

---

# SEPTEMBER (Weeks 33-36)
## Experiential Tech Products

---

### Week 33-34: Interactive Activation Builder

**Objective:** No-code builder for brand activations.

#### Builder UI

```typescript
// activation-builder.tsx - Drag-and-drop builder
interface ActivationElement {
    id: string;
    type: 'ar_trigger' | 'quiz' | 'photo_booth' | 'game' | 'form';
    config: Record<string, unknown>;
    position: { x: number; y: number };
}

const ActivationBuilder = () => {
    const [elements, setElements] = useState<ActivationElement[]>([]);
    
    const elementTypes = [
        { type: 'ar_trigger', label: 'AR Experience', icon: Cube3D },
        { type: 'quiz', label: 'Quiz/Trivia', icon: HelpCircle },
        { type: 'photo_booth', label: 'Photo Booth', icon: Camera },
        { type: 'game', label: 'Mini Game', icon: Gamepad2 },
        { type: 'form', label: 'Data Capture', icon: ClipboardList },
    ];
    
    return (
        <DndContext onDragEnd={handleDragEnd}>
            {/* Element Palette */}
            <aside className="w-64 border-r p-4">
                {elementTypes.map(el => (
                    <DraggableElement key={el.type} {...el} />
                ))}
            </aside>
            
            {/* Canvas */}
            <main className="flex-1">
                <ActivationCanvas 
                    elements={elements}
                    onUpdateElement={handleUpdateElement}
                />
            </main>
            
            {/* Properties Panel */}
            <aside className="w-80 border-l p-4">
                <ElementProperties element={selectedElement} />
            </aside>
        </DndContext>
    );
};
```

#### Deliverables

- [ ] Drag-and-drop activation builder
- [ ] Pre-built templates (5 types)
- [ ] Real-time preview
- [ ] QR code generation
- [ ] Analytics integration

---

### Week 35-36: Event Analytics Platform

**Objective:** Real-time analytics for brand events.

#### Analytics Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Event Analytics Platform                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Sensors    │    │  Mobile     │    │  Check-in   │ │
│  │  (IoT)      │───▶│  App        │───▶│  Kiosks     │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                   │        │
│         └──────────────────┼───────────────────┘        │
│                            ▼                            │
│                     ┌─────────────┐                     │
│                     │   Kafka     │                     │
│                     │  (Events)   │                     │
│                     └─────────────┘                     │
│                            │                            │
│              ┌─────────────┼─────────────┐              │
│              ▼             ▼             ▼              │
│       ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│       │ClickHouse │ │  Redis    │ │ PostgreSQL│        │
│       │ (OLAP)    │ │ (RT)      │ │ (Config)  │        │
│       └───────────┘ └───────────┘ └───────────┘        │
│                            │                            │
│                            ▼                            │
│                     ┌─────────────┐                     │
│                     │  Dashboard  │                     │
│                     │  (Next.js)  │                     │
│                     └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

#### Real-Time Metrics

```typescript
// event-dashboard.tsx - Real-time event metrics
const EventDashboard = ({ eventId }: { eventId: string }) => {
    const metrics = useEventMetrics(eventId);
    
    return (
        <div className="grid grid-cols-4 gap-4 p-6">
            {/* Live Attendance */}
            <MetricCard
                title="Current Attendance"
                value={metrics.currentAttendance}
                change={`+${metrics.lastHourChange}`}
                icon={Users}
            />
            
            {/* Engagement Rate */}
            <MetricCard
                title="Engagement Rate"
                value={`${metrics.engagementRate}%`}
                subtitle="Activations per visitor"
                icon={Sparkles}
            />
            
            {/* Social Mentions */}
            <MetricCard
                title="Social Mentions"
                value={metrics.socialMentions}
                sentiment={metrics.sentiment}
                icon={MessageCircle}
            />
            
            {/* Data Capture */}
            <MetricCard
                title="Leads Captured"
                value={metrics.leadsCapture}
                conversion={`${metrics.conversionRate}%`}
                icon={UserPlus}
            />
            
            {/* Heatmap */}
            <div className="col-span-2">
                <VenueHeatmap data={metrics.locationData} />
            </div>
            
            {/* Engagement Timeline */}
            <div className="col-span-2">
                <EngagementTimeline data={metrics.timeline} />
            </div>
        </div>
    );
};
```

#### Deliverables

- [ ] Kafka event streaming pipeline
- [ ] ClickHouse real-time aggregations
- [ ] Live attendance counter
- [ ] Venue heatmap
- [ ] Post-event report generator

---

# OCTOBER-DECEMBER (Weeks 37-48)
## Political Intelligence Platform

---

### Week 37-40: Political Sentiment Dashboard

**Objective:** Real-time political sentiment for campaign teams.

#### Sentiment Analysis Pipeline

```python
# political_sentiment.py
from transformers import pipeline
import asyncio

class PoliticalSentimentAnalyzer:
    def __init__(self):
        # Use Indonesian sentiment model
        self.sentiment = pipeline(
            "sentiment-analysis",
            model="indolem/indobert-base-uncased",
            tokenizer="indolem/indobert-base-uncased"
        )
        
    async def analyze_social_stream(self, keywords: list[str]):
        """Stream and analyze social media mentions"""
        
        async for post in stream_social_mentions(keywords):
            sentiment = self.sentiment(post.text)[0]
            
            yield {
                "post_id": post.id,
                "platform": post.platform,
                "text": post.text,
                "sentiment": sentiment["label"],
                "confidence": sentiment["score"],
                "location": post.location,
                "timestamp": post.created_at
            }
    
    async def generate_regional_sentiment(
        self, 
        candidate: str,
        region: str
    ) -> dict:
        """Calculate sentiment by region"""
        
        query = f"""
            SELECT 
                province,
                COUNT(*) as total_mentions,
                AVG(CASE WHEN sentiment = 'positive' THEN 1.0 ELSE 0.0 END) as positive_rate,
                AVG(confidence) as avg_confidence
            FROM political_mentions
            WHERE candidate = '{candidate}'
            AND region = '{region}'
            AND timestamp > NOW() - INTERVAL 24 HOUR
            GROUP BY province
        """
        
        return await clickhouse.execute(query)
```

#### War Room Dashboard

```typescript
// war-room.tsx - Campaign command center
const WarRoom = ({ campaignId }: { campaignId: string }) => {
    const realtime = useWarRoomData(campaignId);
    
    return (
        <div className="grid grid-cols-12 gap-4 h-screen p-4 bg-slate-950">
            {/* Live Sentiment Gauge */}
            <div className="col-span-3">
                <SentimentGauge 
                    positive={realtime.sentiment.positive}
                    negative={realtime.sentiment.negative}
                    neutral={realtime.sentiment.neutral}
                />
            </div>
            
            {/* Trending Topics */}
            <div className="col-span-3">
                <TrendingTopics topics={realtime.trending} />
            </div>
            
            {/* Regional Map */}
            <div className="col-span-6 row-span-2">
                <IndonesiaMap
                    data={realtime.regionalSentiment}
                    colorScale="sentiment"
                />
            </div>
            
            {/* Social Feed */}
            <div className="col-span-4 row-span-2">
                <LiveSocialFeed 
                    posts={realtime.socialFeed}
                    filter={selectedFilter}
                />
            </div>
            
            {/* Alerts */}
            <div className="col-span-2 row-span-2">
                <AlertPanel alerts={realtime.alerts} />
            </div>
        </div>
    );
};
```

#### Deliverables

- [ ] Social media listening (Twitter, Facebook, TikTok)
- [ ] Indonesian sentiment model (IndoBERT)
- [ ] Regional sentiment map
- [ ] Real-time war room dashboard
- [ ] Alert system for negative spikes

---

### Week 41-44: Ground Operations App

**Objective:** Mobile app for field campaign teams.

#### React Native App

```typescript
// GroundOpsApp.tsx - React Native campaign app
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

const GroundOpsApp = () => {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen 
                    name="Dashboard" 
                    component={DashboardScreen}
                    options={{ tabBarIcon: BarChart }}
                />
                <Tab.Screen 
                    name="Canvassing" 
                    component={CanvassingScreen}
                    options={{ tabBarIcon: Map }}
                />
                <Tab.Screen 
                    name="Voters" 
                    component={VoterDatabaseScreen}
                    options={{ tabBarIcon: Users }}
                />
                <Tab.Screen 
                    name="Events" 
                    component={EventsScreen}
                    options={{ tabBarIcon: Calendar }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
};

const CanvassingScreen = () => {
    const location = useLocation();
    const [nearbyHouses, setNearbyHouses] = useState([]);
    
    return (
        <View style={styles.container}>
            <MapView
                region={location}
                showsUserLocation
            >
                {nearbyHouses.map(house => (
                    <HouseMarker 
                        key={house.id}
                        house={house}
                        onPress={() => openVoterCard(house)}
                    />
                ))}
            </MapView>
            
            <VoterCardModal
                voter={selectedVoter}
                onSubmitSurvey={handleSurveySubmit}
            />
        </View>
    );
};
```

#### Deliverables

- [ ] React Native app (iOS + Android)
- [ ] Offline-first data sync
- [ ] Canvassing map with voter locations
- [ ] Survey/polling forms
- [ ] Real-time team coordination

---

### Week 45-48: Election Day Products

**Objective:** Real-time vote tracking and quick count.

#### Quick Count System

```python
# quick_count.py - Real-time vote aggregation
from dataclasses import dataclass
from typing import Dict

@dataclass
class TPSResult:
    tps_id: str
    kelurahan: str
    kecamatan: str
    kabupaten: str
    provinsi: str
    votes: Dict[str, int]  # candidate_id -> vote count
    total_voters: int
    invalid_votes: int
    verified: bool
    photo_proof_url: str
    submitted_at: datetime

class QuickCountEngine:
    def __init__(self):
        self.results: Dict[str, TPSResult] = {}
        self.total_tps = 823236  # Indonesia TPS count
        
    async def submit_result(self, result: TPSResult):
        """Process incoming TPS result"""
        
        # Validate
        if not await self.validate_result(result):
            raise ValueError("Invalid result submission")
        
        # Store
        self.results[result.tps_id] = result
        
        # Recalculate aggregates
        await self.update_aggregates()
        
        # Broadcast to dashboard
        await self.broadcast_update({
            "tps_id": result.tps_id,
            "region": result.kabupaten,
            "coverage": len(self.results) / self.total_tps * 100
        })
    
    async def get_national_result(self) -> dict:
        """Calculate national quick count"""
        
        total_votes = {}
        for result in self.results.values():
            for candidate, votes in result.votes.items():
                total_votes[candidate] = total_votes.get(candidate, 0) + votes
        
        total = sum(total_votes.values())
        
        return {
            "candidates": {
                c: {"votes": v, "percentage": v / total * 100}
                for c, v in total_votes.items()
            },
            "coverage_pct": len(self.results) / self.total_tps * 100,
            "total_tps_counted": len(self.results),
            "updated_at": datetime.utcnow().isoformat()
        }
```

#### Deliverables

- [ ] TPS result submission app
- [ ] Photo verification system
- [ ] Real-time aggregation engine
- [ ] National/provincial/kabupaten dashboards
- [ ] Confidence interval calculations

---

## Development Principles (H2)

1. **AI-First:** Leverage AI for all content generation
2. **Real-Time:** Sub-second updates for critical dashboards
3. **Mobile-Ready:** All products work on mobile
4. **Offline-Capable:** Political tools work without internet
5. **Security:** End-to-end encryption for sensitive data

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 2025 | CineRadar Team | Initial H2 detailed spec |
