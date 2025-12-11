#!/usr/bin/env python3
"""
CineRadar Daily Scraper
Scrapes movie availability across all Indonesian cities from TIX.id
Run daily to track which movies are showing where.
"""
import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

from playwright.async_api import async_playwright


class CineRadarScraper:
    """Movie availability scraper for TIX.id"""
    
    CITIES = [
        {"id": "973818519810478080", "name": "AMBON"},
        {"id": "1244607994935726080", "name": "BALI"},
        {"id": "973818512004878336", "name": "BALIKPAPAN"},
        {"id": "973818511275069440", "name": "BANDUNG"},
        {"id": "1244607994998640640", "name": "BANJARBARU"},
        {"id": "973818519542042624", "name": "BANJARMASIN"},
        {"id": "973818511182794752", "name": "BATAM"},
        {"id": "1244607995103498240", "name": "BAUBAU"},
        {"id": "973818511732248576", "name": "BEKASI"},
        {"id": "973818519986638848", "name": "BENGKULU"},
        {"id": "1244607994952503296", "name": "BINJAI"},
        {"id": "1178839445454016512", "name": "BLITAR"},
        {"id": "973818511514144768", "name": "BOGOR"},
        {"id": "1725288142161850368", "name": "BONDOWOSO"},
        {"id": "1711879790585196544", "name": "BONTANG"},
        {"id": "1651376867036377088", "name": "CIANJUR"},
        {"id": "1169755844871467008", "name": "CIKARANG"},
        {"id": "973818512071987200", "name": "CILEGON"},
        {"id": "973818512113930240", "name": "CIREBON"},
        {"id": "1178839445470793728", "name": "DEPOK"},
        {"id": "1222305861108510720", "name": "DUMAI"},
        {"id": "1244607995048972288", "name": "DURI"},
        {"id": "1005975403937935360", "name": "GARUT"},
        {"id": "973818520355737600", "name": "GORONTALO"},
        {"id": "1090769139527593984", "name": "GRESIK"},
        {"id": "1897438487989202944", "name": "INDRAMAYU"},
        {"id": "967969975509716992", "name": "JAKARTA"},
        {"id": "973818516421480448", "name": "JAMBI"},
        {"id": "973818520292823040", "name": "JAYAPURA"},
        {"id": "1111417698853597184", "name": "JEMBER"},
        {"id": "973818520678699008", "name": "KARAWANG"},
        {"id": "1129169668045549568", "name": "KEDIRI"},
        {"id": "1244607994969280512", "name": "KENDARI"},
        {"id": "1244607994981863424", "name": "KETAPANG"},
        {"id": "1055594867410874368", "name": "KISARAN"},
        {"id": "1867676382226558976", "name": "KLATEN"},
        {"id": "1722030173747949568", "name": "KUALA KAPUAS"},
        {"id": "973818520850665472", "name": "KUPANG"},
        {"id": "973818516572475392", "name": "LAMPUNG"},
        {"id": "1244607995032195072", "name": "LUBUKLINGGAU"},
        {"id": "1178839445361741824", "name": "MADIUN"},
        {"id": "973818514898948096", "name": "MAKASSAR"},
        {"id": "973818515335155712", "name": "MALANG"},
        {"id": "1244607995065749504", "name": "MAMUJU"},
        {"id": "973818515440013312", "name": "MANADO"},
        {"id": "1443370010952085504", "name": "MANOKWARI"},
        {"id": "973818520519315456", "name": "MATARAM"},
        {"id": "973818515087691776", "name": "MEDAN"},
        {"id": "1178839445403684864", "name": "MOJOKERTO"},
        {"id": "973818520594812928", "name": "PADANG"},
        {"id": "973818520158605312", "name": "PALANGKARAYA"},
        {"id": "973818515746197504", "name": "PALEMBANG"},
        {"id": "973818520410263552", "name": "PALU"},
        {"id": "1197682360502464512", "name": "PANGKAL PINANG"},
        {"id": "1070830258023837696", "name": "PEKALONGAN"},
        {"id": "973818519131000832", "name": "PEKANBARU"},
        {"id": "1244607995137052672", "name": "PEMATANG SIANTAR"},
        {"id": "1244607995116081152", "name": "PONOROGO"},
        {"id": "973818517893681152", "name": "PONTIANAK"},
        {"id": "1244607995015417856", "name": "PRABUMULIH"},
        {"id": "1178839445420462080", "name": "PROBOLINGGO"},
        {"id": "1178839445500153856", "name": "PURWAKARTA"},
        {"id": "1178839445437239296", "name": "PURWOKERTO"},
        {"id": "1103067679159234560", "name": "RANTAU PRAPAT"},
        {"id": "1584791871496925184", "name": "ROKAN HILIR"},
        {"id": "973818514064281600", "name": "SAMARINDA"},
        {"id": "1244607994877005824", "name": "SAMPIT"},
        {"id": "973818514206887936", "name": "SEMARANG"},
        {"id": "1244607995082526720", "name": "SERANG"},
        {"id": "987103552646156288", "name": "SIDOARJO"},
        {"id": "973818520464789504", "name": "SINGKAWANG"},
        {"id": "1072645973232070656", "name": "SOLO"},
        {"id": "1235714215080112128", "name": "SORONG"},
        {"id": "973818520808722432", "name": "SUMEDANG"},
        {"id": "973818513581936640", "name": "SURABAYA"},
        {"id": "973818514345299968", "name": "TANGERANG"},
        {"id": "973818520758390784", "name": "TANJUNG PINANG"},
        {"id": "1605700896530903040", "name": "TARAKAN"},
        {"id": "973818520234102784", "name": "TASIKMALAYA"},
        {"id": "1178839445546291200", "name": "TEGAL"},
        {"id": "996542011358056448", "name": "TERNATE"},
        {"id": "1851329662932758528", "name": "TIMIKA"},
        {"id": "973818517310672896", "name": "YOGYAKARTA"},
    ]
    
    def __init__(self):
        self.api_base = "https://api-b2b.tix.id"
        self.app_base = "https://app.tix.id"
        
    def log(self, message: str):
        print(f"[{time.strftime('%H:%M:%S')}] {message}")
        
    async def scrape_all(self, headless: bool = True, 
                         city_limit: Optional[int] = None,
                         delay: float = 2.0) -> Dict:
        """Scrape movie availability for all cities."""
        self.log("🎬 Starting movie availability scrape...")
        
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )
        
        context = await browser.new_context(
            viewport={'width': 430, 'height': 932},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            locale='id-ID',
            timezone_id='Asia/Jakarta',
        )
        
        page = await context.new_page()
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
        
        cities = self.CITIES[:city_limit] if city_limit else self.CITIES
        self.log(f"📍 Processing {len(cities)} cities")
        
        movie_map = {}
        city_stats = {}
        
        try:
            await page.goto(f'{self.app_base}/home', wait_until='networkidle')
            await asyncio.sleep(2)
            
            start_time = time.time()
            
            for i, city in enumerate(cities, 1):
                city_name = city['name']
                movies = []
                
                try:
                    await page.goto(f'{self.app_base}/cities', wait_until='networkidle')
                    await asyncio.sleep(1)  # Wait for Flutter to fully load
                    
                    # Focus and fill search
                    search_input = page.locator('input[type="text"]').first
                    await search_input.click()
                    await asyncio.sleep(0.2)
                    await search_input.fill(city_name)
                    await asyncio.sleep(0.8)  # Wait for search results
                    
                    # Click and wait for response
                    city_result = page.get_by_text(city_name, exact=True)
                    if await city_result.count() > 0:
                        try:
                            async with page.expect_response(
                                lambda r: '/v1/movies' in r.url and 'api-b2b.tix.id' in r.url,
                                timeout=15000
                            ) as response_info:
                                await city_result.first.click(force=True, timeout=10000)
                            
                            response = await response_info.value
                            data = await response.json()
                            movies = data.get('data', [])
                        except Exception:
                            await asyncio.sleep(2)
                    
                except Exception:
                    pass
                    
                city_stats[city_name] = len(movies)
                
                for movie in movies:
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
                            'cities': []
                        }
                    if city_name not in movie_map[movie_id]['cities']:
                        movie_map[movie_id]['cities'].append(city_name)
                    
                if i % 5 == 0 or i == len(cities):
                    elapsed = time.time() - start_time
                    self.log(f"   Progress: {i}/{len(cities)} | {len(movie_map)} movies | {city_stats.get(city_name, 0)} in {city_name}")
                    
        finally:
            await browser.close()
            await playwright.stop()
            self.log("🏁 Done")
        
        sorted_movies = sorted(movie_map.values(), key=lambda x: len(x['cities']), reverse=True)
        self.log(f"✅ Found {len(movie_map)} unique movies across {len(cities)} cities")
        
        return {
            'movies': sorted_movies,
            'city_stats': city_stats,
            'total_movies': len(movie_map),
            'total_cities': len(cities),
            'cities': cities
        }


def run_daily_scrape(output_dir: str = "data", headless: bool = True, 
                     city_limit: Optional[int] = None):
    async def _run():
        scraper = CineRadarScraper()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        date_str = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        print("\n" + "="*60)
        print("🎬 CineRadar - Daily Movie Availability Scraper")
        print(f"📅 Date: {date_str}")
        print("="*60 + "\n")
        
        result = await scraper.scrape_all(headless=headless, city_limit=city_limit)
        
        if not result['movies']:
            print("❌ No data collected.")
            return None
            
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        print(f"Total Cities: {result['total_cities']}")
        print(f"Total Movies: {result['total_movies']}")
        
        sorted_cities = sorted(result['city_stats'].items(), key=lambda x: x[1], reverse=True)
        print("\n🏙️ Cities by movie count:")
        for city, count in sorted_cities[:10]:
            print(f"   {city:<20} ({count} movies)")
        
        zero_count = sum(1 for c, cnt in result['city_stats'].items() if cnt == 0)
        if zero_count > 0:
            print(f"\n⚠️ {zero_count} cities with 0 movies")
            
        output_file = output_path / f"movies_{date_str}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'scraped_at': timestamp, 'date': date_str,
                'summary': {'total_cities': result['total_cities'], 'total_movies': result['total_movies']},
                'movies': result['movies'], 'city_stats': result['city_stats'],
            }, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Saved to: {output_file}")
        
        return result
        
    return asyncio.run(_run())


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='CineRadar Daily Scraper')
    parser.add_argument('--visible', action='store_true', help='Show browser')
    parser.add_argument('--limit', type=int, help='Limit cities')
    parser.add_argument('--output', default='data', help='Output dir')
    args = parser.parse_args()
    run_daily_scrape(output_dir=args.output, headless=not args.visible, city_limit=args.limit)
