"""Global configuration for TIX.id scraping engine.
Defines API endpoints, browser emulation settings, and regional defaults.
"""

# API Configuration
API_BASE = "https://api-b2b.tix.id"
APP_BASE = "https://app.tix.id"

# Browser Configuration
USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
BROWSER_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin": "https://m.tix.id",
    "Referer": "https://m.tix.id/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
}
VIEWPORT = {"width": 430, "height": 932}
LOCALE = "id-ID"
TIMEZONE = "Asia/Jakarta"
