# JIT Scraper: Revised Cost with Raw JSON Storage

## Updated Requirements

Store **raw JSON seat layout** for each showtime (not just occupancy %).

---

## Storage Impact

### Data Size per Showtime
- **Raw JSON Layout**: ~10.8 KB (200 seats with status/price)
- **Metadata**: ~0.5 KB (occupancy, totals, timestamps)
- **Total**: ~11.3 KB per showtime

### Monthly Storage
- **Daily**: 11,721 showtimes × 11.3 KB = **124 MB/day**
- **Monthly**: 124 MB × 30 = **3.72 GB/month**
- **Yearly**: 3.72 GB × 12 = **44.6 GB/year**

---

## Revised Cost Calculation

### Cloud Functions (Unchanged)
| Resource | Usage | Free Tier | Overage | Cost |
|----------|-------|-----------|---------|------|
| Invocations | 351,630 | 2,000,000 | 0 | $0.00 |
| GB-Seconds | 175,815 | 400,000 | 0 | $0.00 |
| GHz-Seconds | 281,000 | 200,000 | 81,000 | $0.19 |
| Networking (Egress) | 3.5 GB | 5 GB | 0 | $0.00 |

**Subtotal: $0.19/month**

### Firestore Storage (NEW)
| Resource | Usage | Free Tier | Overage | Cost |
|----------|-------|-----------|---------|------|
| **Stored Data** | 3.72 GB | 1 GB | 2.72 GB | **$0.49** |
| **Document Writes** | 351,630 | 20,000 | 331,630 | **$0.60** |
| **Document Reads** | ~50,000 | 50,000 | 0 | $0.00 |

**Firestore Subtotal: $1.09/month**

### Pub/Sub (Unchanged)
- Messages: 351,630/month × 11 KB = 3.5 MB
- Free tier: 10 GB
- **Cost: $0.00**

---

## Total Monthly Cost: **$1.28**

### Breakdown
- Cloud Functions: $0.19
- Firestore Storage: $0.49
- Firestore Writes: $0.60
- **Total: $1.28/month**

---

## Cost Optimization Options

### Option 1: Compress JSON (Recommended)
Use gzip compression before storing:
- Compression ratio: ~70% (10.8 KB → 3.2 KB)
- **New storage**: 3.72 GB → 1.1 GB
- **New cost**: $0.49 → $0.02 (within 1GB free tier!)
- **Savings**: $0.47/month

**Revised Total with Compression: $0.81/month**

### Option 2: Store in Cloud Storage (Cheaper Storage)
Move raw JSON to Cloud Storage instead of Firestore:
- Storage: 3.72 GB × $0.020/GB = $0.07/month
- Writes: 351,630 × $0.05/10k = $1.76/month
- **Total**: $1.83/month (worse than Firestore)

### Option 3: Retention Policy
Delete seat layouts older than 30 days:
- Keeps only 1 month of data
- Storage: 3.72 GB (constant)
- **Cost**: $0.49/month (storage) + $0.60/month (writes) = $1.09/month

---

## Recommended Approach

**Use gzip compression** for raw JSON layouts:

```python
import gzip
import json

def save_showtime_snapshot(snapshot, layout_json):
    # Compress layout
    compressed = gzip.compress(json.dumps(layout_json).encode('utf-8'))
    
    # Store compressed data
    firestore.save({
        'showtime_id': snapshot.showtime_id,
        'occupancy_pct': snapshot.occupancy_pct,
        'layout_compressed': compressed,  # ~3.2 KB instead of 10.8 KB
        'scraped_at': snapshot.scraped_at
    })
```

### Final Cost with Compression
| Item | Cost |
|------|------|
| Cloud Functions | $0.19 |
| Firestore Storage (1.1 GB) | $0.02 |
| Firestore Writes | $0.60 |
| **Total** | **$0.81/month** |

Still well under $1/month! ✅

---

## Updated Architecture

No changes needed - just add compression step in scraper function:

```
Scraper Function:
  1. Get seat layout from TIX.id
  2. Calculate occupancy
  3. ✨ Compress raw JSON with gzip
  4. Save to Firestore (compressed)
```

To retrieve:
```python
import gzip
import json

compressed_data = firestore.get('layout_compressed')
layout = json.loads(gzip.decompress(compressed_data))
```
