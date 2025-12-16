"""
CineRadar TIX.id Scraper Client
Core scraping logic for movie availability and showtimes.
"""
import asyncio
import json
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional

import aiohttp
from playwright.async_api import async_playwright

from backend.config import CITIES, API_BASE, APP_BASE, USER_AGENT, VIEWPORT, LOCALE, TIMEZONE
from backend.services.base_scraper import BaseScraper

# Geocoding cache file (relative to project root)
GEOCODE_CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'geocode_cache.json')


async def geocode_address(address: str, city: str, session: aiohttp.ClientSession, cache: Dict) -> Optional[Dict]:
    """
    Geocode an address using OpenStreetMap Nominatim.
    Returns {lat, lng} or None if not found.
    """
    cache_key = f"{address}|{city}"
    
    # Check cache first
    if cache_key in cache:
        return cache[cache_key]
    
    # Build search query
    search_query = f"{address}, {city}, Indonesia"
    
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": search_query,
            "format": "json",
            "limit": 1,
            "countrycodes": "id"
        }
        headers = {
            "User-Agent": "CineRadar/1.0 (cinema data aggregator)"
        }
        
        async with session.get(url, params=params, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data and len(data) > 0:
                    result = {
                        "lat": float(data[0]["lat"]),
                        "lng": float(data[0]["lon"])
                    }
                    cache[cache_key] = result
                    return result
                    
        # If not found, try with just city name (fallback to city center)
        return None
        
    except Exception:
        return None



class CineRadarScraper(BaseScraper):
    """Movie availability scraper for TIX.id"""
    
    def __init__(self):
        super().__init__()
        self.cities = CITIES
    
    async def _fetch_movie_schedule(
        self, page, context, movie: Dict, city: Dict
    ) -> List[Dict]:
        """
        Fetch theatre schedule for a movie in a specific city.
        Handles pagination by capturing auth headers and making direct API calls.
        """
        movie_id = movie.get('movie_id') or movie.get('id')
        city_id = city.get('id')
        city_name = city.get('name')
        date_str = datetime.now().strftime("%Y-%m-%d")
        
        # Build movie URL
        slug = (movie.get('title') or 'movie').lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug).replace(' ', '-')
        url = f"{self.app_base}/movies/{slug}-{movie_id}/{date_str}"
        
        all_theatres = []
        captured_headers = {}
        captured_movie_id = None
        
        try:
            # Capture headers from the first request
            async def capture_request(route, request):
                nonlocal captured_headers, captured_movie_id
                if '/v1/schedules/movies' in request.url and not captured_headers:
                    captured_headers = await request.all_headers()
                    match = re.search(r'/schedules/movies/(\d+)', request.url)
                    if match:
                        captured_movie_id = match.group(1)
                await route.continue_()
            
            await page.route('**/v1/schedules/movies/**', capture_request)
            
            # Navigate and capture page 1 response
            async with page.expect_response(
                lambda r: '/v1/schedules/movies' in r.url and city_id in r.url,
                timeout=10000
            ) as response_info:
                await page.goto(url, wait_until='networkidle')
            
            response = await response_info.value
            data = await response.json()
            
            # Process page 1
            raw_theatres = data.get('data', {}).get('theaters', [])
            has_next = data.get('data', {}).get('has_next', False)
            all_theatres.extend(raw_theatres)
            
            # Use actual movie_id from API response URL
            actual_movie_id = captured_movie_id or movie_id
            
            # Fetch additional pages if has_next is True
            current_page = 2
            while has_next and current_page <= 20:  # Safety limit
                api_url = (
                    f"{self.api_base}/v1/schedules/movies/{actual_movie_id}"
                    f"?city_id={city_id}&date={date_str}&page={current_page}"
                )
                
                try:
                    response = await context.request.get(api_url, headers=captured_headers)
                    data = await response.json()
                    
                    if not data.get('success', True):
                        break
                    
                    page_theatres = data.get('data', {}).get('theaters', [])
                    has_next = data.get('data', {}).get('has_next', False)
                    
                    if page_theatres:
                        all_theatres.extend(page_theatres)
                    else:
                        break
                        
                    current_page += 1
                except Exception:
                    break
            
            # Unroute to avoid conflicts
            await page.unroute('**/v1/schedules/movies/**')
            
            # Parse all captured theatres
            theatres = []
            for t in all_theatres:
                theatre = {
                    'theatre_id': t.get('id'),
                    'theatre_name': t.get('name'),
                    'merchant': t.get('merchant', {}).get('merchant_name'),
                    'address': t.get('address'),
                    'rooms': []
                }
                
                for group in t.get('price_groups', []):
                    room = {
                        'category': group.get('category'),
                        'price': group.get('price_string'),
                        'showtimes': [],  # Available times (strings) - backward compatible
                        'all_showtimes': [],  # All times with status
                        'past_showtimes': []  # Past/unavailable times
                    }
                    
                    for show in group.get('show_time', []):
                        display_time = show.get('display_time')
                        status = show.get('status')
                        showtime_id = show.get('id')  # Capture showtime ID for seat scraping
                        
                        # Full showtime object with status
                        showtime_obj = {
                            'time': display_time,
                            'status': status,
                            'is_available': status == 1,
                            'showtime_id': showtime_id  # For seat layout API
                        }
                        room['all_showtimes'].append(showtime_obj)
                        
                        if status == 1:  # Available
                            room['showtimes'].append(display_time)
                        else:  # Past or sold out
                            room['past_showtimes'].append(display_time)
                            
                    # Include room if it has any showtimes (available or past)
                    if room['all_showtimes']:
                        theatre['rooms'].append(room)
                        
                if theatre['rooms']:
                    theatres.append(theatre)
                    
        except Exception as e:
            self.log(f"⚠️ Schedule fetch failed: {movie['title']} in {city_name}: {e}")
            try:
                await page.unroute('**/v1/schedules/movies/**')
            except:
                pass
            
        return theatres

    async def geocode_all_theatres(self, movie_map: Dict) -> Dict:
        """
        Geocode all theatre addresses in the movie data.
        Uses caching to avoid repeated API calls.
        """
        self.log("📍 Starting theatre geocoding...")
        
        # Load cache
        geocode_cache = {}
        try:
            if os.path.exists(GEOCODE_CACHE_FILE):
                with open(GEOCODE_CACHE_FILE, 'r') as f:
                    geocode_cache = json.load(f)
                self.log(f"   Loaded {len(geocode_cache)} cached locations")
        except Exception:
            pass
        
        # Collect all unique theatre addresses
        theatres_to_geocode = []
        for movie_id, movie in movie_map.items():
            if 'schedules' in movie:
                for city_name, theatres in movie['schedules'].items():
                    for theatre in theatres:
                        if theatre.get('address'):
                            cache_key = f"{theatre['address']}|{city_name}"
                            if cache_key not in geocode_cache:
                                theatres_to_geocode.append({
                                    'address': theatre['address'],
                                    'city': city_name,
                                    'theatre': theatre
                                })
        
        self.log(f"   {len(theatres_to_geocode)} theatres need geocoding")
        
        # Geocode with rate limiting (1 request per second for Nominatim)
        geocoded = 0
        failed = 0
        
        async with aiohttp.ClientSession() as session:
            for i, item in enumerate(theatres_to_geocode):
                coords = await geocode_address(
                    item['address'], 
                    item['city'], 
                    session, 
                    geocode_cache
                )
                
                if coords:
                    item['theatre']['lat'] = coords['lat']
                    item['theatre']['lng'] = coords['lng']
                    geocoded += 1
                else:
                    failed += 1
                
                # Progress every 10
                if (i + 1) % 10 == 0:
                    self.log(f"   Geocoded {i + 1}/{len(theatres_to_geocode)} ({geocoded} ok, {failed} failed)")
                
                # Rate limit: 1 request per second for Nominatim
                await asyncio.sleep(1.1)
        
        # Also update theatres that were in cache
        for movie_id, movie in movie_map.items():
            if 'schedules' in movie:
                for city_name, theatres in movie['schedules'].items():
                    for theatre in theatres:
                        if theatre.get('address') and 'lat' not in theatre:
                            cache_key = f"{theatre['address']}|{city_name}"
                            if cache_key in geocode_cache:
                                theatre['lat'] = geocode_cache[cache_key]['lat']
                                theatre['lng'] = geocode_cache[cache_key]['lng']
        
        # Save cache
        try:
            os.makedirs(os.path.dirname(GEOCODE_CACHE_FILE), exist_ok=True)
            with open(GEOCODE_CACHE_FILE, 'w') as f:
                json.dump(geocode_cache, f, indent=2)
            self.log(f"   Saved {len(geocode_cache)} locations to cache")
        except Exception as e:
            self.log(f"   ⚠️ Failed to save cache: {e}")
        
        self.log(f"📍 Geocoding complete: {geocoded} new, {failed} failed")
        return movie_map

    async def scrape(
        self,
        headless: bool = True,
        city_limit: Optional[int] = None,
        specific_city: Optional[str] = None,
        city_names: Optional[List[str]] = None,
        fetch_schedules: bool = False,
    ) -> Dict:
        """
        Scrape movie availability for all cities.
        
        Args:
            headless: Run browser in headless mode
            city_limit: Limit number of cities to scrape
            specific_city: Scrape only this city
            fetch_schedules: Also fetch detailed showtimes (slower)
            
        Returns:
            Dict with movies, city_stats, totals
        """
        self.log("🎬 Starting movie availability scrape...")
        if fetch_schedules:
            self.log("⚠️ Schedule fetching enabled - this will be significantly slower")
        
        # Filter cities
        if specific_city:
            cities = [c for c in self.cities if c['name'].upper() == specific_city.upper()]
            if not cities:
                self.log(f"❌ City '{specific_city}' not found")
                return {}
        elif city_names:
            city_names_upper = [n.upper() for n in city_names]
            cities = [c for c in self.cities if c['name'].upper() in city_names_upper]
        else:
            cities = self.cities[:city_limit] if city_limit else self.cities
            
        self.log(f"📍 Processing {len(cities)} cities")
        
        # Launch browser
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )
        
        context = await browser.new_context(
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
            locale=LOCALE,
            timezone_id=TIMEZONE,
        )
        
        page = await context.new_page()
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        
        movie_map = {}
        city_stats = {}
        
        try:
            # Auth via home page
            await page.goto(f'{self.app_base}/home', wait_until='networkidle')
            await asyncio.sleep(2)
            
            start_time = time.time()
            
            for i, city in enumerate(cities, 1):
                city_name = city['name']
                city_movies = []
                
                try:
                    # Navigate to city selection
                    await page.goto(f'{self.app_base}/cities', wait_until='networkidle')
                    await asyncio.sleep(1)
                    
                    # Search and select city
                    search_input = page.locator('input[type="text"]').first
                    await search_input.click()
                    await asyncio.sleep(0.2)
                    await search_input.fill(city_name)
                    await asyncio.sleep(0.8)
                    
                    city_result = page.get_by_text(city_name, exact=True)
                    if await city_result.count() > 0:
                        try:
                            async with page.expect_response(
                                lambda r: '/v1/movies' in r.url and 'api-b2b.tix.id' in r.url,
                                timeout=10000
                            ) as response_info:
                                await city_result.first.click(force=True, timeout=10000)
                            
                            response = await response_info.value
                            data = await response.json()
                            city_movies = data.get('data', [])
                        except Exception:
                            await asyncio.sleep(2)
                    
                    # Process movies
                    city_stats[city_name] = len(city_movies)
                    
                    for movie in city_movies:
                        movie_id = movie.get('movie_id') or movie.get('id')
                        
                        if movie_id not in movie_map:
                            movie_map[movie_id] = {
                                'id': movie_id,
                                'title': movie.get('title', 'Unknown'),
                                'genres': [g.get('name') for g in movie.get('genres', [])],
                                'poster': movie.get('poster_path', ''),
                                'age_category': movie.get('age_category', ''),
                                'country': movie.get('country', ''),
                                'merchants': [m.get('merchant_name') for m in movie.get('merchant', [])],
                                'is_presale': movie.get('presale_flag', 0) == 1,
                                'cities': [],
                                'schedules': {}
                            }
                        
                        if city_name not in movie_map[movie_id]['cities']:
                            movie_map[movie_id]['cities'].append(city_name)
                            
                        # Fetch schedule if requested
                        if fetch_schedules:
                            schedules = await self._fetch_movie_schedule(page, context, movie, city)
                            if schedules:
                                self.log(f"   + {movie['title']}: {len(schedules)} theatres")
                                movie_map[movie_id]['schedules'][city_name] = schedules
                                
                except Exception:
                    pass
                    
                # Progress update
                elapsed = time.time() - start_time
                avg_time = elapsed / i if i > 0 else 0
                remaining = (len(cities) - i) * avg_time
                self.log(f"   {i}/{len(cities)}: {city_name} ({len(city_movies)} movies) | ETA: {remaining/60:.1f}m")
                    
        finally:
            await browser.close()
            await playwright.stop()
            self.log("🏁 Done")
        
        # Sort by city count
        sorted_movies = sorted(movie_map.values(), key=lambda x: len(x['cities']), reverse=True)
        
        return {
            'movies': sorted_movies,
            'city_stats': city_stats,
            'total_movies': len(movie_map),
            'total_cities': len(cities),
            'cities': cities
        }
