# Marketing Intelligence Implementation Plan

## Goal Description
Implement a "Marketing Intelligence" feature to track movie virality and predicted performance. This involves gathering data from Google Trends, Twitter, TikTok, and Instagram, calculating a "virality score", and predicting box office performance (ticket sales) for the show week.

## Strategy Scoring & Feasibility Analysis

| Channel | Reliability | Complexity | Value | Score (1-10) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Trends** | High | Low | High | **9/10** | Core component. `pytrends` is stable enough. Excellent proxy for general awareness. |
| **Twitter (X)** | Low | High | High | **6/10** | Aggressive rate limits & anti-scraping. Official API is expensive. Scraping is fragile. |
| **TikTok** | Low | High | Very High | **7/10** | Critical for movies, but hard to scrape. Will attempt `playwright` on creative center/hashtags. |
| **Instagram** | Medium | Medium | High | **7/10** | Moderate scraping difficulty. Good signal for visual engagement. |

**Recommendation**: Prioritize **Google Trends** as the baseline. Treat Social Media scrapers as "best effort" with fallback mechanisms if scraping fails.

## Proposed Changes

### Backend (Python)
#### [New] `backend/infrastructure/scrapers/marketing_scraper.py`
- **Class**: `MarketingScraper`
- **Dependencies**: `pytrends`, `playwright`, `shutil` (for lightweight browser)
- **Methods**:
    - `fetch_google_trends(keyword, region)`: Returns interest over time/region.
    - `fetch_social_metrics(keyword)`:
        - *Twitter*: Search hashtag volume/sentiment (TextBlob).
        - *TikTok*: Search hashtag view count.
        - *Instagram*: Search hashtag post count.
    - `calculate_virality_score(metrics)`: Weighted average algorithm.
        - `Score = (Trend_Slope * 0.4) + (Social_Vol_Norm * 0.4) + (Sentiment * 0.2)`
    - `predict_performance(virality_score)`:
        - `Predicted_Tickets = Baseline + (Virality_Score * Coeff)`
        - *Note*: This will be a simple heuristic initially, trainable later.

#### [New] `backend/cli/commands/marketing.py`
- Command: `python -m backend.cli marketing --keyword "Movie Name" --city "City"`
- Stores results in Firestore collection: `marketing_snapshots`
    - Document ID: `movie_id`
    - Fields: `timestamp`, `virality_score`, `google_trends_data`, `social_stats`, `predicted_admissions`

#### [Modify] `backend/cli/cli.py`
- Register `marketing` command.

### Frontend (Admin - Next.js)
#### [Modify] `admin/src/components/Sidebar.tsx`
- Add "Marketing Intelligence" (Icon: `TrendingUp` or `LineChart`).

#### [New] `admin/src/app/marketing/page.tsx`
- Dashboard View:
    1.  **Overview Cards**: Avg Virality Score, Top Trending Movie, Total Predicted Admissions.
    2.  **Virality Map**: Indonesia map choropleth using Google Trends "Interest by Region".
    3.  **Trend Chart**: Line chart overlaying Google Trends vs. Ticket Sales (if available).
    4.  **Social Sentiment**: Bar gauge for Twitter/TikTok/IG.

## Verification Plan

### Automated Tests
- **Backend Unit Tests**: data model validation.
- **Scraper Smoke Test**: `python -m backend.cli marketing --test-connection` to verify `pytrends` connectivity.

### Manual Verification
1.  Run `python -m backend.cli marketing --keyword "Wicked"`
2.  Verify output logs show data limits/success.
3.  Check Firestore for new document.
4.  Open Admin Dashboard `/marketing` and verify data visualization.
