---
description: How to add a new Indonesian city to the scraper
---

# Add New City Workflow

## Steps

1. **Find the city's TIX.id ID**
   - Go to https://m.tix.id/city
   - Find your city and note its ID from the URL

2. **Add to config**
   ```python
   # backend/config.py
   CITIES = [
       # ... existing cities ...
       {'id': 'NEW_CITY_ID', 'name': 'NEW_CITY_NAME'},
   ]
   ```

3. **Test the scrape**
   ```bash
   python -m backend.infrastructure.cli movies --city NEW_CITY_NAME --schedules
   ```

4. **Verify output**
   - Check `data/movies_YYYY-MM-DD.json`
   - Ensure the new city appears in the data

5. **Run full validation**
   ```bash
   python -m backend.infrastructure.cli validate --file data/movies_YYYY-MM-DD.json
   ```

## Notes

- City names should be UPPERCASE
- The scraper will automatically discover theatres in the new city
- Theatre geocoding will happen on the next monthly-geocode run
