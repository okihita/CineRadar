"""
Global configuration for TIX.id scraping engine.
Defines API endpoints, browser emulation settings, and regional defaults.
"""

# API Configuration
API_BASE = "https://api-b2b.tix.id"
APP_BASE = "https://app.tix.id"

# Browser Configuration
USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
VIEWPORT = {"width": 430, "height": 932}
LOCALE = "id-ID"
TIMEZONE = "Asia/Jakarta"
