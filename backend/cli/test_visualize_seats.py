
import asyncio
import random
import sys
from backend.cli.cli import load_movie_data, extract_showtimes_from_data
from backend.infrastructure._legacy.seat_scraper import SeatScraper
from backend.config import CITIES

def visualize_layout(layout_data, title_info):
    """Generate ASCII art for seat layout."""
    if not layout_data or 'data' not in layout_data:
        return "No layout data available"

    seat_map = layout_data['data'].get('seat_map', [])
    if not seat_map:
        return "Empty seat map"

    # Symbols
    SYMBOLS = {
        1: 'X',  # Sold
        5: '_',  # Available
        6: '#',  # Blocked
        0: ' '   # Unknown
    }
    
    # Calculate stats
    total = 0
    sold = 0
    available = 0
    blocked = 0

    lines = []
    lines.append(f"🎬 {title_info}")
    lines.append("-" * 40)
    lines.append("Legend: [X] Sold  [_] Available  [#] Blocked")
    lines.append("-" * 40)
    lines.append("   Screen this way")
    lines.append("   " + "—" * 20)
    lines.append("")

    # Detect structure type
    is_flat = len(seat_map) > 0 and 'seat_rows' not in seat_map[0]

    if is_flat:
        # Group by row
        rows = {}
        for seat in seat_map:
            row_id = seat.get('row_name', '?')
            if row_id not in rows:
                rows[row_id] = []
            rows[row_id].append(seat)
        
        # Sort rows (A, B, C...)
        sorted_row_ids = sorted(rows.keys())
        
        for row_id in sorted_row_ids:
            row_seats = rows[row_id]
            # Sort seats by seat_no (numeric or string)
            # Some seat_no are "1", "10", etc.
            def get_seat_num(s):
                val = s.get('seat_no', '0')
                if val is None: val = '0'
                try:
                    return int(val)
                except ValueError:
                    # If conversion fails (e.g. seat "A1"), return 0 or parse digits
                    # But if we return string here and int elsewhere, it crashes.
                    # Let's return 0 to be safe, or hash the string to keep deterministic order
                    return 0
            
            row_seats.sort(key=get_seat_num)
            
            row_str = f"{row_id:<3} "
            for seat in row_seats:
                # Map status
                # Cinépolis status might be 'seat_status'
                status = seat.get('seat_status', seat.get('status', 0))
                symbol = SYMBOLS.get(status, '?')
                
                row_str += f"{symbol} "
                
                if status == 1: sold += 1
                if status == 5: available += 1
                if status == 6: blocked += 1
                if status in [1, 5]: total += 1
                
            lines.append(row_str)
            
    else:
        # Nested (XXI/CGV)
        for row_group in seat_map:
            row_id = row_group.get('seat_code', '?')
            seats = row_group.get('seat_rows', [])
            
            # Build row string
            row_str = f"{row_id:<3} "
            
            # Simple rendering - just simple spacing
            for seat in seats:
                status = seat.get('status', 0)
                symbol = SYMBOLS.get(status, '?')
                row_str += f"{symbol} "
                
                if status == 1: sold += 1
                if status == 5: available += 1
                if status == 6: blocked += 1
                if status in [1, 5]: total += 1
                
            lines.append(row_str)


    occupancy = (sold / total * 100) if total > 0 else 0
    stats = f"\n📊 Stats: {sold}/{total} sold ({occupancy:.1f}%) | {blocked} blocked"
    lines.append(stats)
    lines.append("=" * 40)
    
    return "\n".join(lines)

async def main():
    # 1. Load Data
    print("📂 Loading movie data...")
    movie_data = load_movie_data()
    if not movie_data:
        print("❌ No movie data found")
        return

    # 2. Pick 3 Random Cities
    all_cities = [c['name'] for c in CITIES]
    # Filter cities that actually have showtimes in our data
    # (Checking quickly by extracting all showtimes first might be slow, 
    # but let's try just picking random and falling back if empty)
    
    # 2. Pick 3 Random Cities
    all_cities = [c['name'] for c in CITIES]
    # To save time, let's filter cities that have showtimes roughly
    # (But simple random sample is fine if we accept some might be empty, 
    #  or we can loop until we find 3 valid ones)
    
    selected_cities = random.sample(all_cities, 3)
    print(f"🏙️  Selected cities: {', '.join(selected_cities)}")
    
    # 3. Initialize Scraper
    scraper = SeatScraper()
    # Ensure parsing token
    if not scraper.load_token_from_storage():
        print("❌ Could not load token")
        return

    output = []
    
    for city in selected_cities:
        print(f"\n🔍 Processing {city}...")
        showtimes = extract_showtimes_from_data(movie_data, city_filter=city)
        
        if not showtimes:
            print(f"   ⚠️ No showtimes found for {city}")
            continue
            
        # Pick 3 random showtimes
        sample_size = min(3, len(showtimes))
        sample_showtimes = random.sample(showtimes, sample_size)
        
        for st in sample_showtimes:
            print(f"   REQUESTING layout for: {st['movie_title']} @ {st['showtime']}")
            layout = await scraper._fetch_seat_layout_api(st['showtime_id'], st['merchant'])
            
            info = f"{st['movie_title']}\n   {st['theatre_name']} - {st['room_name']}\n   Time: {st['showtime']} ({st['merchant']})"


            info = f"{st['movie_title']}\n   {st['theatre_name']} - {st['room_name']}\n   Time: {st['showtime']} ({st['merchant']})"
            
            viz = visualize_layout(layout, info)
            output.append(viz)
            
            # small delay
            await asyncio.sleep(0.5)

    # Print all visualizations
    print("\n" + "="*50)
    print("SEAT LAYOUT VISUALIZATIONS")
    print("="*50 + "\n")
    for viz in output:
        print(viz)
        print("\n\n")

if __name__ == "__main__":
    asyncio.run(main())
