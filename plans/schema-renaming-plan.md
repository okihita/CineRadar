# Schema Renaming Plan - Cognitive Clarity First

## Executive Summary

Before implementing V2 collections, we should rename the domain models to provide cognitive clarity about what each entity represents. This will make the codebase self-documenting and reduce confusion.

---

## 1. Current Naming Confusion

### The Problem

| Current Name | What It Actually Represents | Why It's Confusing |
|--------------|----------------------------|-------------------|
| `Movie` | A movie's **schedule allocation** for a date | Has `merchants`, `cities`, `schedules` - clearly schedule data |
| `Movie.id` | The **Schedule ID** from TIX API | Not a movie entity ID - it changes per cinema chain |
| `Movie.tix_metadata_id` | The **actual Movie entity ID** | Named as if it's secondary, but it's primary |
| `MovieDetails` | Immutable movie metadata | Correctly named ✓ |

### The Root Cause

The `Movie` class was named when we didn't understand the TIX dual-ID system. It should have been named `MovieSchedule` from the start.

---

## 2. Proposed Renaming

### 2.1 Domain Model Renaming

| File | Current | Proposed | Rationale |
|------|---------|----------|-----------|
| `backend/domain/models/movie.py` | `class Movie` | `class MovieSchedule` | Represents daily schedule allocation |
| `Movie.id` | `id` | `schedule_id` | This is the TIX schedule allocation ID |
| `Movie.tix_metadata_id` | `tix_metadata_id` | `metadata_id` | The immutable movie entity identifier |

### 2.2 File Renaming (Optional - Phase 2)

| Current File | Proposed File | Notes |
|--------------|---------------|-------|
| `backend/domain/models/movie.py` | `backend/domain/models/movie_schedule.py` | Keep `MovieDetails` in separate file |
| `backend/infrastructure/repositories/firestore_movie.py` | `backend/infrastructure/repositories/firestore_schedule.py` | Handles schedule collection |

### 2.3 Collection Naming (Already Good)

| Collection | Stores | Document ID | Status |
|------------|--------|-------------|--------|
| `movies` | `MovieDetails` | `metadata_id` | ✓ Correct |
| `schedules/{date}/movies` | `MovieSchedule` | `schedule_id` | Needs V2 with `metadata_id` |
| `movie_performance` | Performance data | `schedule_id` | Needs V2 with `metadata_id` |

---

## 3. Impact Analysis

### 3.1 Files That Import `Movie`

```python
# backend/infrastructure/repositories/firestore_movie.py
from backend.domain.models import Movie, ScrapeResult

# backend/application/ports/scraper.py
from backend.domain.models import Movie, SeatOccupancy
```

### 3.2 Files That Reference `Movie` Type

| File | Usage | Change Needed |
|------|-------|---------------|
| `backend/domain/models/movie.py` | Class definition | Rename class + fields |
| `backend/infrastructure/repositories/firestore_movie.py` | `list[Movie]` return type | Update import |
| `backend/application/ports/scraper.py` | `list[Movie]` return type | Update import |
| `backend/domain/models/__init__.py` | Export `Movie` | Add alias + new export |

### 3.3 Backward Compatibility Strategy

To avoid breaking existing code during transition:

```python
# backend/domain/models/__init__.py

# New naming (preferred)
from backend.domain.models.movie_schedule import MovieSchedule

# Backward compatibility alias (deprecated)
Movie = MovieSchedule  # Will be removed in future version

__all__ = [
    # ...
    "MovieSchedule",
    "Movie",  # Deprecated alias
]
```

---

## 4. Implementation Order

### Phase 1: Domain Model Renaming (Minimal Impact)

1. **Rename class in `movie.py`**
   - `class Movie` → `class MovieSchedule`
   - Field `id` → `schedule_id`
   - Field `tix_metadata_id` → `metadata_id`

2. **Update `__init__.py` exports**
   - Add `MovieSchedule` export
   - Keep `Movie` as backward-compatible alias

3. **Update docstrings**
   - Clarify that `MovieSchedule` represents daily allocation
   - Document the dual-ID system clearly

### Phase 2: Update Import Sites (After Phase 1)

1. **Update `firestore_movie.py`**
   - Change `Movie` → `MovieSchedule`
   - Update field references

2. **Update `scraper.py` port**
   - Change return type to `list[MovieSchedule]`

### Phase 3: Raw Payload File Renaming (Documentation)

The raw payload files in `docs/00_scraping_tixid/raw_payloads/` should be renamed for clarity:

| Current Name | Proposed Name | Rationale |
|--------------|---------------|-----------|
| `03_movies_now_playing.request/response` | `03_movie_schedules.request/response` | Returns schedule data with `id` (schedule_id) and `movie_id` (metadata_id) |
| `04_movie_schedule_dates.request/response` | (keep as is) | Already correctly named |
| `05_movie_showtimes.request/response` | (keep as is) | Already correctly named |
| `07_movie_metadata.request/response` | (keep as is) | Returns MovieDetails/metadata - correctly named |

**Key insight**: The `03_movies_now_playing` endpoint is the source of `MovieSchedule` data, not "movies" in the entity sense. It returns:
- `id` → `schedule_id` (changes per cinema chain allocation)
- `movie_id` → `metadata_id` (immutable movie entity identifier)
- `merchant` → which cinema chains have this schedule
- `presale_flag` → schedule status

### Phase 4: Domain Model File Renaming (Optional - Low Priority)

1. Rename `movie.py` → `movie_schedule.py`
2. Update all imports across codebase
3. Remove backward compatibility alias

---

## 5. Updated Domain Model

### After Renaming

```python
# backend/domain/models/movie_schedule.py

@dataclass
class MovieSchedule:
    """A movie's schedule allocation for a specific date.

    This represents WHERE and WHEN a movie is showing, not the movie itself.
    The same movie can have different schedule allocations across cinema chains.

    Attributes:
        schedule_id: TIX.id schedule allocation ID (changes per cinema chain)
        metadata_id: TIX.id movie entity ID (immutable, links to MovieDetails)
        title: Movie title
        merchants: Cinema chains showing this movie on this date
        cities: Cities where movie is showing on this date
        schedules: Theatre schedules organized by city

    Example:
        >>> schedule = MovieSchedule(
        ...     schedule_id="1996107175268794368",  # For showtime queries
        ...     metadata_id="1996107160261574656",  # For movie details
        ...     title="Avatar"
        ... )
    """

    schedule_id: str  # Was: id - TIX schedule allocation ID
    title: str
    metadata_id: str | None = None  # Was: tix_metadata_id - TIX movie entity ID
    genres: list[str] = field(default_factory=list)
    poster: str | None = None
    age_category: str | None = None
    country: str | None = None
    merchants: list[str] = field(default_factory=list)
    is_presale: bool = False
    cities: list[str] = field(default_factory=list)
    schedules: dict[str, list[TheatreSchedule]] = field(default_factory=dict)
```

---

## 6. Benefits of Renaming First

1. **Self-Documenting Code**: `MovieSchedule` immediately tells you it's schedule data
2. **Clear ID Semantics**: `schedule_id` vs `metadata_id` is unambiguous
3. **Easier V2 Implementation**: With clear naming, V2 schema decisions become obvious
4. **Reduced Cognitive Load**: No need to remember "Movie is actually a schedule"
5. **Better Code Reviews**: Reviewers will understand the entity purpose immediately

---

## 7. Decision Required

**Question**: Should we do the domain model renaming before V2 implementation?

**Recommendation**: Yes - renaming first will make V2 implementation clearer and less error-prone.

**Options**:
1. **Rename First** (Recommended) - Rename domain model, then implement V2
2. **Parallel** - Rename and implement V2 simultaneously
3. **V2 First** - Implement V2 with current names, rename later

---

## 8. Next Steps After Approval

1. Switch to Code mode
2. Rename `Movie` → `MovieSchedule` in `backend/domain/models/movie.py`
3. Rename fields: `id` → `schedule_id`, `tix_metadata_id` → `metadata_id`
4. Update `backend/domain/models/__init__.py` with backward-compatible alias
5. Run tests to verify nothing breaks
6. Then proceed with V2 implementation
