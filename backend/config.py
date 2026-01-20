"""
City configuration for TIX.id scraper.
Contains all 83 Indonesian cities with their TIX.id IDs.
"""

from backend.city_data import CITIES

# API Configuration
API_BASE = "https://api-b2b.tix.id"
APP_BASE = "https://app.tix.id"

# Browser Configuration
USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
VIEWPORT = {"width": 430, "height": 932}
LOCALE = "id-ID"
TIMEZONE = "Asia/Jakarta"
