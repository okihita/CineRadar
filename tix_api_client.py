"""
TIX API Client with Anti-Bot Detection Measures
Scrapes cities, movies, and showtimes from TIX.id
"""
import asyncio
import json
import random
import time
from playwright.async_api import async_playwright


class TixAPIClient:
    """
    TIX scraper that intercepts API responses with anti-detection measures.
    Uses browser to appear legitimate, then captures API responses.
    """
    
    def __init__(self):
        self.base_url = 'https://app.tix.id'
        self.api_base = 'https://api-b2b.tix.id'
        self.api_responses = {}
        
        # Realistic device fingerprints
        self.devices = [
            {
                'name': 'iPhone 14 Pro',
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'viewport': {'width': 393, 'height': 852},
                'device_scale_factor': 3,
                'is_mobile': True,
                'has_touch': True,
            },
            {
                'name': 'Samsung Galaxy S23',
                'user_agent': 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'viewport': {'width': 360, 'height': 780},
                'device_scale_factor': 3,
                'is_mobile': True,
                'has_touch': True,
            },
            {
                'name': 'Pixel 8',
                'user_agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'viewport': {'width': 412, 'height': 915},
                'device_scale_factor': 2.625,
                'is_mobile': True,
                'has_touch': True,
            },
            {
                'name': 'MacBook Pro',
                'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'viewport': {'width': 1440, 'height': 900},
                'device_scale_factor': 2,
                'is_mobile': False,
                'has_touch': False,
            },
        ]
        
    def log(self, message):
        """Print timestamped log messages"""
        print(f"[{time.strftime('%H:%M:%S')}] {message}")
        
    async def _random_delay(self, min_ms=500, max_ms=2000):
        """Add random human-like delay"""
        delay = random.randint(min_ms, max_ms) / 1000
        await asyncio.sleep(delay)
        
    async def _apply_stealth(self, page):
        """Apply stealth measures to avoid bot detection"""
        
        # Override webdriver detection
        await page.add_init_script("""
            // Remove webdriver flag
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Mock plugins (headless browsers have none)
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                ]
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en', 'id']
            });
            
            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Add realistic screen properties
            Object.defineProperty(screen, 'availWidth', { get: () => window.innerWidth });
            Object.defineProperty(screen, 'availHeight', { get: () => window.innerHeight });
            
            // Mock WebGL vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.apply(this, arguments);
            };
            
            // Mask automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        """)
        
    async def _setup_request_interception(self, page):
        """Set up request/response interception"""
        
        async def handle_response(response):
            url = response.url
            
            # Capture all API responses
            if self.api_base in url:
                try:
                    content_type = response.headers.get('content-type', '')
                    if 'json' in content_type:
                        body = await response.json()
                        endpoint = url.replace(self.api_base, '')
                        self.log(f"📡 API: {endpoint[:80]}...")
                        
                        # Store by endpoint pattern
                        if 'cities' in url:
                            self.api_responses['cities'] = body
                        elif 'movie' in url.lower():
                            if 'movies' not in self.api_responses:
                                self.api_responses['movies'] = []
                            self.api_responses['movies'].append(body)
                        elif 'theater' in url.lower() or 'cinema' in url.lower():
                            if 'theaters' not in self.api_responses:
                                self.api_responses['theaters'] = []
                            self.api_responses['theaters'].append(body)
                        else:
                            # Store other endpoints
                            key = endpoint.split('?')[0].replace('/', '_').strip('_')
                            self.api_responses[key] = body
                except Exception:
                    pass
                    
        page.on('response', handle_response)
        
    async def create_session(self, headless=False):
        """Create a stealthy browser session"""
        
        # Pick random device
        device = random.choice(self.devices)
        self.log(f"🎭 Using device: {device['name']}")
        
        playwright = await async_playwright().start()
        
        browser = await playwright.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ]
        )
        
        context = await browser.new_context(
            viewport=device['viewport'],
            user_agent=device['user_agent'],
            device_scale_factor=device['device_scale_factor'],
            is_mobile=device['is_mobile'],
            has_touch=device['has_touch'],
            locale='id-ID',
            timezone_id='Asia/Jakarta',
            geolocation={'latitude': -6.2088, 'longitude': 106.8456},  # Jakarta
            permissions=['geolocation'],
        )
        
        page = await context.new_page()
        
        # Apply stealth
        await self._apply_stealth(page)
        
        # Setup interception
        await self._setup_request_interception(page)
        
        return playwright, browser, context, page
        
    async def get_cities(self, headless=False):
        """Get list of cities with anti-detection"""
        
        playwright, browser, context, page = await self.create_session(headless)
        
        try:
            self.log("🌐 Navigating to TIX...")
            
            # First visit homepage (more natural behavior)
            await page.goto(f'{self.base_url}/home', wait_until='domcontentloaded')
            await self._random_delay(1000, 2000)
            
            # Then navigate to cities
            self.log("🏙️ Going to cities page...")
            await page.goto(f'{self.base_url}/cities', wait_until='networkidle')
            await self._random_delay(2000, 4000)
            
            # Simulate some human behavior
            await page.mouse.move(
                random.randint(100, 300),
                random.randint(100, 400)
            )
            await self._random_delay(500, 1000)
            
            # Wait for API responses
            self.log("⏳ Waiting for API data...")
            await asyncio.sleep(3)
            
            if 'cities' in self.api_responses:
                cities_data = self.api_responses['cities']
                if isinstance(cities_data, dict) and 'data' in cities_data:
                    cities = cities_data['data']
                    self.log(f"✅ Captured {len(cities)} cities!")
                    return cities
                    
            self.log("⚠️ No cities data captured")
            return []
            
        finally:
            await self._random_delay(1000, 2000)
            await browser.close()
            await playwright.stop()
            self.log("🏁 Session closed")
            
    async def get_all_data(self, headless=False):
        """Get all available data from TIX"""
        
        playwright, browser, context, page = await self.create_session(headless)
        
        try:
            # Natural browsing pattern
            pages_to_visit = [
                (f'{self.base_url}/home', 'Homepage'),
                (f'{self.base_url}/cities', 'Cities'),
                (f'{self.base_url}/schedule-movies/now-showing', 'Movies'),
            ]
            
            for url, name in pages_to_visit:
                self.log(f"🌐 Visiting {name}...")
                await page.goto(url, wait_until='networkidle')
                await self._random_delay(2000, 4000)
                
                # Random mouse movement
                for _ in range(random.randint(2, 5)):
                    await page.mouse.move(
                        random.randint(50, 400),
                        random.randint(100, 700)
                    )
                    await self._random_delay(200, 500)
                    
                # Maybe scroll
                if random.random() > 0.5:
                    await page.evaluate('window.scrollBy(0, 300)')
                    await self._random_delay(500, 1000)
                    
            self.log(f"📊 Captured data from {len(self.api_responses)} endpoints")
            return self.api_responses
            
        finally:
            await browser.close()
            await playwright.stop()
            self.log("🏁 Session closed")

    async def get_movies_by_city(self, city_id: str, city_name: str, headless=False):
        """Get movies for a specific city"""
        
        playwright, browser, context, page = await self.create_session(headless)
        
        try:
            self.log(f"🎬 Getting movies for {city_name}...")
            
            # Navigate directly to schedule with city context
            # TIX stores city preference, so we need to set it first
            await page.goto(f'{self.base_url}/home', wait_until='domcontentloaded')
            await self._random_delay(1000, 2000)
            
            # Go to schedule movies
            self.log("🎬 Navigating to Now Showing...")
            await page.goto(f'{self.base_url}/schedule-movies/now-showing', wait_until='networkidle')
            await self._random_delay(2000, 3000)
            
            # Wait for API responses
            await asyncio.sleep(3)
            
            # Extract movies from captured responses
            movies = []
            if 'movies' in self.api_responses:
                for resp in self.api_responses['movies']:
                    if isinstance(resp, dict) and 'data' in resp:
                        movies.extend(resp['data'])
                    elif isinstance(resp, list):
                        movies.extend(resp)
                        
            self.log(f"✅ Found {len(movies)} movies for {city_name}")
            return movies
            
        finally:
            await self._random_delay(500, 1000)
            await browser.close()
            await playwright.stop()
            self.log("🏁 Session closed")
            
    async def get_all_movies_and_cities(self, headless=False, limit_cities=None):
        """Get cities and movies in one session (more efficient)"""
        
        playwright, browser, context, page = await self.create_session(headless)
        
        try:
            result = {
                'cities': [],
                'movies': [],
                'all_api_responses': {}
            }
            
            # Step 1: Get cities
            self.log("🏙️ Step 1: Getting cities...")
            await page.goto(f'{self.base_url}/home', wait_until='domcontentloaded')
            await self._random_delay(1000, 2000)
            
            await page.goto(f'{self.base_url}/cities', wait_until='networkidle')
            await self._random_delay(2000, 3000)
            
            if 'cities' in self.api_responses:
                cities_data = self.api_responses['cities']
                if isinstance(cities_data, dict) and 'data' in cities_data:
                    result['cities'] = cities_data['data']
                    self.log(f"✅ Got {len(result['cities'])} cities")
            
            # Step 2: Get movies (current city context)
            self.log("🎬 Step 2: Getting movies...")
            await page.goto(f'{self.base_url}/schedule-movies/now-showing', wait_until='networkidle')
            await self._random_delay(2000, 3000)
            
            # Simulate scrolling to load more movies
            for i in range(3):
                await page.evaluate('window.scrollBy(0, 500)')
                await self._random_delay(500, 1000)
                self.log(f"   Scrolling... ({i+1}/3)")
            
            # Wait for all API calls
            await asyncio.sleep(2)
            
            # Extract movies
            if 'movies' in self.api_responses:
                for resp in self.api_responses['movies']:
                    if isinstance(resp, dict) and 'data' in resp:
                        result['movies'].extend(resp['data'])
                    elif isinstance(resp, list):
                        result['movies'].extend(resp)
                        
            self.log(f"✅ Got {len(result['movies'])} movies")
            
            # Store all captured API responses
            result['all_api_responses'] = self.api_responses
            
            return result
            
        finally:
            await self._random_delay(500, 1000)
            await browser.close()
            await playwright.stop()
            self.log("🏁 Session closed")


async def main():
    client = TixAPIClient()
    
    print("\n" + "="*60)
    print("🎬 TIX API CLIENT - Anti-Bot Detection Mode")
    print("="*60 + "\n")
    
    # Get all data in one session
    data = await client.get_all_movies_and_cities(headless=False)
    
    # Display cities
    print("\n" + "="*60)
    print(f"🏙️ CITIES ({len(data['cities'])} total)")
    print("="*60)
    
    for i, city in enumerate(data['cities'][:10], 1):
        print(f"{i:3}. {city['name']} (ID: {city['id']})")
    
    if len(data['cities']) > 10:
        print(f"    ... and {len(data['cities']) - 10} more cities")
    
    # Display movies
    print("\n" + "="*60)
    print(f"🎬 MOVIES ({len(data['movies'])} total)")
    print("="*60)
    
    for i, movie in enumerate(data['movies'][:10], 1):
        title = movie.get('title') or movie.get('name') or movie.get('movieTitle', 'Unknown')
        movie_id = movie.get('id') or movie.get('movieId', 'N/A')
        print(f"{i:3}. {title}")
        if movie.get('genre'):
            print(f"      Genre: {movie['genre']}")
        if movie.get('rating'):
            print(f"      Rating: {movie['rating']}")
    
    if len(data['movies']) > 10:
        print(f"    ... and {len(data['movies']) - 10} more movies")
    
    # Show captured API endpoints
    print("\n" + "="*60)
    print("📡 CAPTURED API ENDPOINTS")
    print("="*60)
    
    for endpoint in data['all_api_responses'].keys():
        print(f"  • {endpoint}")
    
    # Save results
    output_file = 'tix_full_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'cities': data['cities'],
            'movies': data['movies'],
            'api_endpoints': list(data['all_api_responses'].keys()),
            'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'stats': {
                'total_cities': len(data['cities']),
                'total_movies': len(data['movies']),
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Saved to {output_file}")
    
    # Also save raw API responses for analysis
    raw_file = 'tix_raw_api.json'
    with open(raw_file, 'w', encoding='utf-8') as f:
        # Convert to serializable format
        serializable = {}
        for key, value in data['all_api_responses'].items():
            try:
                json.dumps(value)  # Test if serializable
                serializable[key] = value
            except:
                serializable[key] = str(value)
        json.dump(serializable, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Raw API responses saved to {raw_file}")


if __name__ == "__main__":
    asyncio.run(main())
