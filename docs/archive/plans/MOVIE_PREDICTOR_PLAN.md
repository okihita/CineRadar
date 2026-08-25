# Movie Success Predictor — Design Spec

## What We Have
3,963 enriched movies with:
- **total_admission**: 3,061 movies (77%) — the target variable
- **casts/directors**: 83% coverage — ~1,500 unique directors, ~5,000 unique actors
- **language**: 100% — Indonesia (2,051) vs English (1,912)
- **genre**: 91% — 15+ genres, Drama/Horror/Comedy dominate
- **duration**: 87%
- **score**: 55% — CinePoint audience score
- **rating_category**: 59% — age ratings (13+, 17+, SU, etc.)

## The Analysis (No ML — Pure Statistical Correlation)

We're NOT building a predictive ML model. We're building an **exploratory analysis dashboard** that answers:

> "What compositional factors correlate with box office success?"

### Analysis Modules

#### 1. Genre Impact
- For each genre: average admissions, median, hit rate (% above 500K)
- Multi-genre interaction: Horror+Comedy vs Horror+Thriller
- Heatmap: genre × success tier

#### 2. Star Power
- Director track record: average admissions across their movies
- Actor track record: same
- "Bankable" ranking: directors/actors sorted by average admissions (min 3 movies)
- For a selected movie: how many "bankable" stars does it have?

#### 3. Language & Type
- Local vs International: admission distributions
- Local Horror vs International Horror: comparison

#### 4. Rating Category
- Which age ratings draw the biggest audiences?
- 17+ vs SU vs 13+ admission distributions

#### 5. Duration Analysis
- Sweet spot: do movies in a certain length range perform better?
- Scatter: duration vs total_admission

#### 6. Movie Deep Dive
- Pick any movie → see its "success profile"
- Compare its features against genre/language/type averages
- "Why did this movie succeed/fail?"

## API Design

### `GET /api/competitors/cinepoint/analysis`

Single endpoint that returns pre-computed aggregates:

```json
{
  "overview": {
    "total_movies": 3963,
    "with_admissions": 3061,
    "admission_tiers": { "mega_hit": 355, "hit": 273, ... },
    "admission_stats": { "mean": 422827, "median": 86140, ... }
  },
  "genre_analysis": [
    {
      "genre": "Horror",
      "count": 916,
      "avg_admission": 520000,
      "median_admission": 280000,
      "hit_rate_pct": 25.3,
      "avg_score": 6.2
    }
  ],
  "director_rankings": [
    {
      "name": "Joko Anwar",
      "movie_count": 8,
      "avg_admission": 1200000,
      "total_admission": 9600000,
      "movies": [
        { "id": 123, "title": "Pengabdi Setan", "total_admission": 4500000 }
      ]
    }
  ],
  "actor_rankings": [...],
  "language_analysis": {
    "Indonesia": { "count": 2051, "avg": 380000, ... },
    "English": { "count": 1912, "avg": 470000, ... }
  },
  "rating_analysis": [...],
  "duration_analysis": {
    "buckets": [
      { "range": "0-80min", "avg_admission": ..., "count": ... },
      ...
    ]
  },
  "genre_combos": [
    { "genres": ["Horror", "Comedy"], "count": 45, "avg_admission": 600000 }
  ]
}
```

## UI Design

### Page: `/competitors/cinepoint/analysis`

Layout: Single scrollable page with analysis sections

**Hero Stats Bar**
- Total movies, total admissions across all movies, average per movie
- Success tier distribution (stacked bar)

**Section: Genre Performance**
- Horizontal bar chart: genre × avg admissions
- Bubble chart: genre × (count, avg_admission, avg_score)
- Hit rate % per genre (horizontal bar)

**Section: Star Power Rankings**
- Two tables: Top Directors / Top Actors by avg admissions
- Min 3 movies filter
- Each row: name, movie count, avg admission, total, best movie

**Section: Language & Market**
- Side-by-side: Local vs Intl distributions
- By-genre breakdown within each language

**Section: Duration Sweet Spot**
- Scatter chart: duration vs total_admission (log scale)
- Bucketed bar chart

**Section: Movie Deep Dive**
- Search/typeahead to pick a movie
- Shows its profile card with all features
- Compares each feature against the average for its genre/language/type
- Green/red indicators: above/below average

## Implementation Order
1. API route with all aggregations
2. UI page with overview + genre analysis
3. Star power rankings
4. Movie deep dive
5. Polish
