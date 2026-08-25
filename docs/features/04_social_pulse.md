# Social Feed: Industry Intelligence Pipeline

> **Branch**: `feature/social-pulse`  
> **Status**: Phase 1 complete — migrating to platform-agnostic schema, then Phase 2+

---

## 1. What We're Building

A date-navigable social feed for the CineRadar admin dashboard that:
1. **Backfills** YouTube (and future: Twitter, Instagram, TikTok, web) content into Firestore
2. **Generates per-hour AI summaries** via Gemini across all platforms
3. **Displays** an hour-grouped timeline with AI Pulse sidebar

### Current State (Phase 1 ✅)
- Firestore persistence with SSE backfill pipeline
- Gemini hourly analysis with retry countdown
- Date-based URL routing (`/social-feed/[date]`)
- Jakarta timezone throughout
- 3-zone layout: AI Pulse | Visual Feed | Account Directory
- Expandable PostCards with full descriptions + view counts
- Dynamic account directory derived from video data
- Delete + re-backfill support per date

### Channel Management & Settings (Phase 2 ✅)
- Dedicated settings dashboard at `/social-feed/settings`
- Live channel search, source lookup, category tags, and active status toggling
- Dynamic Firestore persistence for sources (`social_feed_sources`)

---

## 2. Channel List: 18 Indonesian Cinema Sources

### Active (15)

| Channel | ID | Category |
|---|---|---|
| MD Pictures | `UCQExjzw5-z1VE2Fcbd3ky9Q` | distributor |
| Rapi Films | `UCTi-irCm6xVzft7gh9ltRNQ` | distributor |
| StarVision Plus | `UCeGQiHPv-oFeQUNe9xQAoWQ` | distributor |
| Soraya Intercine Films | `UC-khv-3jEhk6DN4KVglHYkA` | distributor |
| Warner Bros. Indonesia | `UCwZfUUW2r0TtnXhDfb3DRgw` | distributor |
| Disney+ Indonesia | `UCI_c_ZmYt6CtFJo4jOQVhiw` | streaming |
| Netflix Indonesia | `UC5E0wgsW3JyQEP-DLkGwI2Q` | streaming |
| CGV Kreasi | `UC2vfMMUMoAZd-RBGwA0-9Nw` | cinema_chain |
| CINEMA 21 | `UCudik2UCrl1TGyyPZ2I9Pvg` | cinema_chain |
| Cinépolis Indonesia | `UCP70SpqoP28WPYIHkzf_Y8Q` | cinema_chain |
| Cine Crib | `UCrMqntY4lAQu0JHYFl8Z0nw` | critic |
| Ngelantur Indonesia | `UC_5tCGLrVehijNbC1_G8a5w` | critic |
| Review Film iD | `UCLIm7HLHCNr4ZNJcNjNkbeQ` | critic |
| Bioskop Mania | `UCHlCL5cY9PPlq2Ou9iU4NuQ` | community |
| Layar Lebar | `UCTg9aljIS9E1eOv8W9Sx53g` | community |
| KapanLagi | `UCfsp3KKBKjezdNxpoWxCWHg` | news |

### Inactive (3 — verify manually)
| Channel | ID | Reason |
|---|---|---|
| Falcon Pictures | `UCaMUw3b9jDwmay8EKP7CBsg` | ~12 subs |
| FLIX Cinema | `UC-ge5BRqhec9fwV2VJtankACg` | Tiny channel |
| (reserved for future) | | |

---

## 3. Database Schema (Firestore — `beta_social_*`)

### Why 3 Collections, Not 9+

Every piece of content across every platform is fundamentally the same thing: **a post from a source published at a timestamp**. The only difference is platform-specific metadata. So instead of per-platform collections (`beta_twitter_accounts`, `beta_instagram_posts`, etc.), we use 3 platform-agnostic collections with a `platform` field.

### Design Principles

| Principle | Implementation |
|---|---|
| Platform-agnostic core | `platform` field + `platform_data` flex field on every document |
| 3 collections only | Sources, Posts, Analysis — no per-platform collections |
| Wide documents | Firestore charges per read, not per field |
| Historical integrity | Source info denormalized into posts; deleting a source doesn't break history |
| Merge-ready for AI | All platforms feed into the same hourly analysis pipeline |

### Entity Relationship

```
┌─────────────────────────┐       ┌─────────────────────────┐       ┌────────────────────┐
│   beta_social_sources    │       │   beta_social_posts      │       │ beta_social_analysis│
│                         │       │                         │       │                    │
│  {source_id}            │◀──────│  source_id              │◀──────│  sources_active[]  │
│  platform               │       │  platform               │       │  sources_fetched[] │
│  display_name           │       │  source_name (denorm)   │       │  posts_by_platform │
│  category               │       │  source_avatar (denorm) │       │  total_posts       │
│  active                 │       │  source_category (dnorm)│       │  summary           │
│  fetch_config           │       │  title, text, url       │       │                    │
│  metadata               │       │  published_at           │       │  {date_hour}       │
│                         │       │  content_type           │       │  24 docs/day       │
│  ~25-50 docs total      │       │  metrics, media[]       │       │                    │
│  Near-zero growth       │       │  platform_data          │       │                    │
│                         │       │                         │       │                    │
│                         │       │  ~50-200 docs/day       │       │                    │
└─────────────────────────┘       └─────────────────────────┘       └────────────────────┘
```

### Collection 1: `beta_social_sources/{source_id}`

Every account we monitor, regardless of platform.

```typescript
interface FirestoreSocialSource {
    id: string;                    // Format: "{platform}_{platform_id}"
    platform: Platform;            // "youtube" | "twitter" | "instagram" | "tiktok" | "web"
    display_name: string;
    handle: string;                // @handle or URL slug
    category: SourceCategory;      // critic | cinema_chain | distributor | streaming | community | news
    avatar_url: string;
    url: string;                   // Link to account on platform
    verified: boolean;
    active: boolean;
    notes: string;

    metadata: {
        subscriber_count?: number;
        followers_count?: number;
        posts_count?: number;
        apify_actor_id?: string;
        apify_last_run_id?: string;
    };

    fetch_config: {
        frequency: string;         // "hourly" | "daily" | "manual"
        max_items_per_fetch: number;
    };

    added_at: string;
    last_fetched_at: string;
}
```

**Document ID convention**: `{platform}_{platform_id}` (e.g., `youtube_UCQExjzw5-z1VE2Fcbd3ky9Q`, `twitter_cineradar`)

**Growth**: ~25-50 docs total. Admin-managed.

### Collection 2: `beta_social_posts/{post_id}`

Every piece of content, regardless of platform.

```typescript
interface FirestoreSocialPost {
    id: string;                    // Format: "{platform}_{content_id}"
    platform: Platform;

    // Core content (ALL platforms)
    title: string;
    text: string;                  // Full text content
    url: string;                   // Link to original post
    published_at: string;          // ISO timestamp (UTC)
    fetched_at: string;

    // Source info (denormalized)
    source_id: string;             // Links to beta_social_sources
    source_name: string;
    source_handle: string;
    source_avatar: string;
    source_category: string;

    // Classification
    content_type: ContentType;     // trailer | review | promo | community | short | opinion

    // Media
    thumbnail: string;
    media: PostMedia[];
    metrics: PostMetrics;
    platform_data: PostPlatformData;

    // YouTube backward compat (populated for YouTube posts)
    description: string;
    full_description: string;
    video_url: string;
    channel_id: string;
    channel_title: string;
    channel_avatar: string;
    duration: string;
    view_count: number;
    like_count: number;
    tags: string[];
}
```

**Document ID convention**: `{platform}_{content_id}` (e.g., `youtube_dQw4w9WgXcQ`)

**Denormalization rationale**: Firestore has no joins. Without it: 200 posts × 2 reads = 400 reads/page. With it: 200 reads/page. Also preserves history if source is deleted.

**Growth**: ~50-200 docs/day. ~6K/year.

### Collection 3: `beta_social_analysis/{date_hour}`

Merged AI summaries across ALL platforms, one document per hour.

```typescript
interface FirestoreSocialAnalysis {
    id: string;                    // "2026-05-04_11"
    date: string;                  // "2026-05-04"
    hour: number;                  // 0-23
    summary: string;               // Gemini paragraph covering ALL platforms

    total_posts: number;
    posts_by_platform: Record<string, number>;
    posts_by_content_type: Record<string, number>;
    sources_active: string[];      // Source IDs with posts this hour
    sources_fetched: string[];     // All source IDs fetched (even if 0 posts)

    // Pre-extracted signals (future: populated by Gemini)
    top_trailers: { title: string; source: string; url: string }[];
    trending_topics: string[];
    sentiment_hint: string;        // "positive" | "mixed" | "controversial" | "neutral"
    hashtags: string[];            // Extracted from post descriptions (e.g., "#Dilan1991", "#FilmIndonesia")

    generated_at: string;
    model: string;
    backfill_duration_ms: number;

    // YouTube backward compat
    video_count: number;
    content_type_breakdown: Record<string, number>;
    channels_active: string[];
    channels_fetched: string[];
}
```

**Growth**: 24 docs/day. ~8,760/year.

### Full Firestore Map

```
cineradar-481014
═════════════════════════════════════════════════════════

PRODUCTION (untouched):
  ├── theatres/{id}/studios/{studio_id}
  ├── scraper_logs/{date}/dispatches/{id}/errors/{id}
  └── schedules_v2/{date}/movies/{movie_id}

BETA SOCIAL FEED:
  ├── beta_social_sources/{source_id}    — ~25-50 docs
  ├── beta_social_posts/{post_id}        — ~50-200 docs/day
  └── beta_social_analysis/{date_hour}   — 24 docs/day
```

---

## 4. Data Flow

### Backfill Pipeline

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐     ┌──────────────┐
│  1. LOAD     │     │  2. FETCH     │     │  3. NORMALIZE  │     │  4. ANALYZE  │
│              │     │               │     │                │     │              │
│  Read active │────▶│  YouTube API  │────▶│  Map to        │────▶│  Group by    │
│  sources     │     │  (per-channel)│     │  SocialPost    │     │  hour (WIB)  │
│  from        │     │               │     │  format        │     │              │
│  Firestore   │     │  OR           │     │                │     │  For each    │
│              │     │  Apify actor  │     │  Denormalize   │     │  hour: send  │
│  Filter:     │     │  (Instagram,  │     │  source info   │     │  ALL posts   │
│  active=true │     │   TikTok,     │     │  into post     │     │  to Gemini   │
│              │     │   Twitter)    │     │                │     │              │
└──────────────┘     └───────────────┘     └────────────────┘     └──────────────┘
```

### Two-Phase YouTube Fetch

1. **Phase A**: `activities.list` per channel → get video IDs, titles, thumbnails (~1-2 units/channel)
2. **Phase B**: `videos.list` (batch up to 50 IDs) → full descriptions, durations, tags, view counts (1 unit/video)

### AI Analysis (Gemini)

Model: `gemini-3.1-flash-lite-preview` (free tier)

The analysis step is platform-agnostic. It receives a flat list of posts and generates a summary.

**Summary length rule**: 1 paragraph per 4 timeline items. Rounding down.
- 0 items → default message
- 1-4 items → 1 paragraph
- 5-8 items → 2 paragraphs
- 9-12 items → 3 paragraphs
- etc.

**No hour/time mention** in the summary — the hour is already shown in the UI. Use the space for richer analysis instead.

**Prompt template**:

```
You are a cinema industry analyst covering the Indonesian film market.

Activity from monitored accounts:
- [YouTube] "Dilan 1991 Official Trailer" by MD Pictures (trailer)
- [YouTube] "Review Pengabdi Setan 2" by Cine Crib (review)
- [Twitter] "Just watched Pengabdi Setan 2" by @BioskopMania (community)

There are {count} items. Write {paragraphs} paragraph(s) of analysis.
Do NOT mention the hour or time range.

Focus on:
1. Key releases (trailers, teasers, new announcements)
2. Audience reactions (reviews, community buzz, sentiment)
3. Cross-platform trends
4. Notable patterns (e.g., same movie trending across multiple sources)

Be factual and specific. Mention movie titles, studio names, and people.
```

**Hashtag extraction**: After generating the summary, extract all hashtags found in post descriptions/titles. These are stored in the analysis document as `hashtags[]` and displayed as pills/chips below the AI summary in the UI. This helps track:
- Anticipation of upcoming movie releases (e.g., `#Dilan1991`, `#PengabdiSetan3`)
- Campaign activations (e.g., `#DiBioskopSebulanLagi`)
- Community trends (e.g., `#FilmIndonesia`)

Empty hours get: "No activity from monitored accounts this hour."

### SSE Events (Backfill → Page)

| Event | Data | Purpose |
|---|---|---|
| `phase` | `{ phase, message }` | Phase transition |
| `progress` | `{ channel, channelIndex, totalChannels }` | Per-channel progress |
| `channel_done` | `{ channel, videosFound }` | Channel complete |
| `hour_done` | `{ hour, videoCount, summary, progress% }` | Hour analysis complete |
| `retry` | `{ hour, attempt, retryDelaySeconds }` | Gemini 429 countdown |
| `done` | `{ videos_written, analyses_written }` | Backfill complete |
| `error` | `{ message }` | Fatal error |

---

## 5. YouTube API Quota Analysis

| Scenario | Units/Day |
|---|---|
| 18 channels × `activities.list` | ~36 units |
| 1 × `channels.list` (batched) | 1 unit |
| ~50-100 videos × `videos.list` | 50-100 units |
| **Total** | **~90-140 units/day** |

Free tier: 10,000 units/day. Even backfilling 90 days would use ~12,600 units — doable across 2 days.

**Note**: `activities.list` only returns ~30 days of history. Older dates need `search.list` (100 units/call). For 18 channels × 1 call = 1,800 units/day for dates >30 days old.

---

## 6. Page Layout

```
┌─ Header + Date Navigation ──────────────────────────────────────┐
│ [YT icon] Industry Feed │ ◄ May 3 │ May 4 │ May 5 ► │ [Delete]│
└──────────────────────────────────────────────────────────────────┘

┌─ AI Pulse ──┐ ┌─ Visual Feed (hour-grouped) ──────┐ ┌─ Directory ─┐
│             │ │                                    │ │             │
│ 23:00 (2)   │ │ ▾ 23:00 — 2 videos                │ │ MD Pictures │
│ Gemini says │ │   [PostCard] [PostCard]            │ │ 3 videos    │
│ ...         │ │                                    │ │             │
│             │ │ ▾ 20:00 — 4 videos                 │ │ Netflix ID  │
│ 20:00 (4)   │ │   [PostCard] [PostCard]            │ │ 2 videos    │
│ ...         │ │   [PostCard] [PostCard]            │ │             │
└─────────────┘ └────────────────────────────────────┘ └─────────────┘
```

- **AI Pulse** (left): Clickable hour blocks with Gemini summaries. Click → filter feed to that hour.
- **Visual Feed** (center): Hour-grouped PostCards with thumbnails, content type badges, expandable descriptions.
- **Directory** (right): Active accounts derived from post data, sorted by post count.

---

## 7. Migration: YouTube-Specific → Platform-Agnostic

Old `beta_youtube_*` collections are **deleted**. We re-seed + re-backfill into the new schema.

### Files to Change (7 files)

| # | File | Change |
|---|---|---|
| 1 | `lib/firestore-youtube.ts` | **Rename** to `firestore-social.ts`. New types + backward-compat aliases |
| 2 | `lib/gemini.ts` | Rename `VideoForAnalysis` → `PostForAnalysis`. Add `platform`. Update prompt |
| 3 | `components/BrandIcons.tsx` | Add `XIcon`, `InstagramIcon`, `TikTokIcon`, `PlatformIcon` |
| 4 | `api/social-feed/seed/route.ts` | Write to `COLLECTIONS.SOURCES` with `platform`, `metadata`, `fetch_config` |
| 5 | `api/social-feed/backfill/route.ts` | Write to `COLLECTIONS.POSTS` + `COLLECTIONS.ANALYSIS`. Denormalize source info |
| 6 | `api/social-feed/data/route.ts` | Query from new collections |
| 7 | `social-feed/[date]/page.tsx` | New imports + field names |

### Type & Constant Renames

| Old | New |
|---|---|
| `FirestoreYouTubeChannel` | `FirestoreSocialSource` |
| `FirestoreYouTubeVideo` | `FirestoreSocialPost` |
| `FirestoreHourlyAnalysis` | `FirestoreSocialAnalysis` |
| `ChannelCategory` | `SourceCategory` |
| `COLLECTIONS.CHANNELS` | `COLLECTIONS.SOURCES` → `"beta_social_sources"` |
| `COLLECTIONS.VIDEOS` | `COLLECTIONS.POSTS` → `"beta_social_posts"` |
| `COLLECTIONS.HOURLY_ANALYSIS` | `COLLECTIONS.ANALYSIS` → `"beta_social_analysis"` |
| `groupVideosByHour` | `groupPostsByHour` |
| `VideoForAnalysis` (gemini) | `PostForAnalysis` |

### Field Renames

| Old Field | New Field | Where |
|---|---|---|
| `last_backfilled_at` | `last_fetched_at` | Source |
| `subscriber_count` | `metadata.subscriber_count` | Source |
| `channel_id` | `source_id` | Post |
| `channel_title` | `source_name` | Post |
| `channel_avatar` | `source_avatar` | Post |
| `video_count` | `total_posts` | Analysis |
| `content_type_breakdown` | `posts_by_content_type` | Analysis |
| `channels_active` | `sources_active` | Analysis |
| `channels_fetched` | `sources_fetched` | Analysis |

### New Fields Added

**Source**: `platform`, `url`, `metadata{}`, `fetch_config{}`  
**Post**: `platform`, `text`, `source_id`, `source_name`, `source_handle`, `source_avatar`, `source_category`, `media[]`, `metrics{}`, `platform_data{}`  
**Analysis**: `total_posts`, `posts_by_platform`, `posts_by_content_type`, `sources_active`, `sources_fetched`, `top_trailers[]`, `trending_topics[]`, `sentiment_hint`

---

## 8. Query Patterns

| Query | Collection | Method |
|---|---|---|
| Posts for a date | `beta_social_posts` | Range on `published_at` |
| YouTube posts only | `beta_social_posts` | Filter `platform == "youtube"` |
| Distributor posts | `beta_social_posts` | Filter `source_category == "distributor"` |
| Analysis for one hour | `beta_social_analysis` | Direct read `"2026-05-04_11"` |
| All analyses for a date | `beta_social_analysis` | Filter `date == "2026-05-04"` |
| Active sources | `beta_social_sources` | Filter `active == true` |

### Required Firestore Indexes

| Collection | Fields | Purpose |
|---|---|---|
| `beta_social_posts` | `published_at` DESC | Date range queries |
| `beta_social_analysis` | `date` ASC, `hour` ASC | Ordered analysis retrieval |
| `beta_social_sources` | `active` | Filter active sources |

Future (when adding multi-platform): `platform` + `published_at`, `source_category` + `published_at`

---

## 9. Future Platform Addition Checklist

When adding a new platform (e.g., Instagram):

1. **Seed sources** — Add to `beta_social_sources` with `platform: "instagram"`
2. **Build fetcher** — Apify actor or API integration
3. **Normalize to `FirestoreSocialPost`** — Same schema, different `platform_data`
4. **Analysis pipeline** — No changes. Already handles mixed-platform posts
5. **Page UI** — `PlatformIcon` component handles the icon

No schema changes. No new collections. Just new data.

---

## 10. Implementation Phases

### Phase 1: Data Foundation ✅ (done)
- Firestore persistence with SSE backfill
- Gemini hourly analysis with retry
- Date navigation + 3-zone layout
- Expandable PostCards + dynamic account directory

### Phase 2: Schema Migration (current)
- Rename `beta_youtube_*` → `beta_social_*` (platform-agnostic)
- Add `platform`, `source_*`, `metrics`, `media`, `platform_data` fields
- Update all 7 files
- Re-seed + re-backfill

### Phase 3: Settings Page
- `/social-feed/settings` — CRUD for sources
- "Look Up" feature: paste channel ID → auto-fetch name/avatar from YouTube API
- Toggle active/inactive, category assignment

### Phase 4: Per-Channel Backfill
- Channel picker checkboxes in backfill UI
- Backfill API accepts `{ date, sourceIds: string[] }`
- Show which sources have been fetched per date

### Phase 5: Multi-Platform
- Add Apify integration for Instagram/TikTok/Twitter
- Platform-specific fetchers → normalized `FirestoreSocialPost`
- Cross-platform AI analysis (already supported by schema)

---

## 11. Risk Mitigation

| Risk | Mitigation |
|---|---|
| TypeScript import breakage | Backward-compat type aliases in `firestore-social.ts` |
| Page breakage on mixed data | Backward-compat fields on all documents |
| Firestore index issues | Create indexes via console before first backfill |
| Doc ID collision across platforms | `{platform}_` prefix on all document IDs |
| YouTube API quota exhaustion | ~140 units/day out of 10,000 — ample headroom |
| Gemini rate limiting | Exponential backoff with parsed `retryDelay` from 429 error |
| `activities.list` 30-day limit | Use `search.list` for older dates (100 units/call) |
