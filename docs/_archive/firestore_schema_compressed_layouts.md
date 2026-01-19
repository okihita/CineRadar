# Firestore Schema for JIT Scraper with Compressed Layouts

## Current Schema (Existing)

```
movie_performance/
├── {movie_id}/                          ← MovieMetadata (root doc)
│   ├── title: string
│   ├── poster: string
│   ├── last_updated: timestamp
│   │
│   └── days/                            ← Subcollection
│       └── {date}/                      ← DailyPerformance (e.g., "2026-01-19")
│           ├── total_showtimes: number
│           ├── avg_occupancy_pct: number
│           ├── total_seats: number
│           ├── total_sold: number
│           ├── cities: array
│           │
│           └── showtimes/               ← Sub-subcollection
│               └── {showtime_id}/       ← ShowtimeSnapshot
│                   ├── showtime_id: string
│                   ├── movie_id: string
│                   ├── theatre_name: string
│                   ├── city: string
│                   ├── showtime: string (HH:MM)
│                   ├── total_seats: number
│                   ├── sold_seats: number
│                   ├── occupancy_pct: number
│                   ├── layout_json: string  ← CURRENT (uncompressed JSON string)
│                   └── scraped_at: timestamp
```

---

## Updated Schema (With Compression)

**Path**: `movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}`

### Changes to ShowtimeSnapshot Document

**BEFORE** (Current):
```json
{
  "showtime_id": "2012107179728916480",
  "occupancy_pct": 14.3,
  "total_seats": 200,
  "sold_seats": 28,
  "layout_json": "[{\"row\":\"A\",\"seat\":1,\"status\":1}...]",  ← 10.8 KB
  "scraped_at": "2026-01-19T03:04:23Z"
}
```

**AFTER** (With Compression):
```json
{
  "showtime_id": "2012107179728916480",
  "occupancy_pct": 14.3,
  "total_seats": 200,
  "sold_seats": 28,
  "layout_compressed": <bytes>,  ← 3.2 KB (gzip compressed)
  "scraped_at": "2026-01-19T03:04:23Z"
}
```

### Field Details

| Field | Type | Size | Description |
|-------|------|------|-------------|
| `layout_compressed` | **bytes** | ~3.2 KB | gzip-compressed JSON seat layout |
| ~~`layout_json`~~ | ~~string~~ | ~~10.8 KB~~ | **REMOVED** (replaced by compressed) |

---

## Code Changes

### 1. Update `ShowtimeSnapshot.to_dict()` 

**File**: `backend/domain/models/movie_performance.py`

```python
import gzip
import json

def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary for Firestore storage."""
    # Compress layout to bytes
    layout_json_str = json.dumps(self.layout)
    layout_compressed = gzip.compress(layout_json_str.encode('utf-8'))
    
    return {
        "showtime_id": self.showtime_id,
        "movie_id": self.movie_id,
        "theatre_name": self.theatre_name,
        "city": self.city,
        "showtime": self.showtime,
        "total_seats": self.total_seats,
        "sold_seats": self.sold_seats,
        "occupancy_pct": self.occupancy_pct,
        "layout_compressed": layout_compressed,  # ← NEW: bytes instead of string
        "scraped_at": self.scraped_at,
    }
```

### 2. Update `ShowtimeSnapshot.from_dict()`

```python
@classmethod
def from_dict(cls, data: dict[str, Any]) -> "ShowtimeSnapshot":
    """Create from Firestore dictionary."""
    # Decompress layout
    layout_compressed = data.get("layout_compressed", b"")
    if layout_compressed:
        layout_json_str = gzip.decompress(layout_compressed).decode('utf-8')
        layout = json.loads(layout_json_str)
    else:
        # Fallback for old data with layout_json
        layout_json_str = data.get("layout_json", "[]")
        layout = json.loads(layout_json_str)
    
    return cls(
        showtime_id=data.get("showtime_id", ""),
        movie_id=data.get("movie_id", ""),
        # ... other fields ...
        layout=layout,
        scraped_at=data.get("scraped_at", ""),
    )
```

---

## Storage Location Summary

**Exact Firestore Path**:
```
movie_performance/
  └── {movie_id}/
      └── days/
          └── {date}/
              └── showtimes/
                  └── {showtime_id}/
                      └── layout_compressed  ← HERE (bytes field)
```

**Example**:
```
movie_performance/1977633929036906496/days/2026-01-19/showtimes/2012107179728916480
```

**Document Fields**:
- `showtime_id`: "2012107179728916480"
- `occupancy_pct`: 14.3
- `total_seats`: 200
- `sold_seats`: 28
- **`layout_compressed`**: `<gzip bytes>` (3.2 KB)
- `scraped_at`: "2026-01-19T03:04:23Z"

---

## Migration Strategy

Since we're adding a new field (`layout_compressed`) and removing `layout_json`:

1. **Deploy new code** that writes `layout_compressed`
2. **Keep backward compatibility** in `from_dict()` to read old `layout_json` if present
3. **Old data** remains readable (no migration needed)
4. **New data** uses compression automatically

No database migration required! ✅
