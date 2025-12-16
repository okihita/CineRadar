# CineRadar Specification

## Frozen Requirements

### Supported Cinema Chains
The following cinema chains are supported and must be displayed in all dashboards:

| Chain | Color Code |
|-------|------------|
| **XXI** | Amber (#F59E0B) |
| **CGV** | Red (#DC2626) |
| **Cinépolis** | Blue (#2563EB) |

### Data Sources
- **TIX.id** - Primary source for movie listings and showtimes
- **83 Indonesian cities** supported

### Scraper Schedule
- Daily at 6:00 AM WIB (23:00 UTC previous day)
- Parallel execution: 9 batches for ~15 min total runtime

### Admin Dashboard
- Display all theatres from XXI, CGV, and Cinépolis
- Filter by merchant, region, city
- Google Maps integration for theatre locations

---
*Last updated: 2025-12-16*
