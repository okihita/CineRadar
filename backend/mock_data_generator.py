#!/usr/bin/env python3
"""
Mock Data Generator for CineRadar BI Dashboard
Creates SQLite database with realistic cinema occupancy data
"""

import sqlite3
import random
from datetime import datetime, timedelta
from pathlib import Path

# Database file (with "mock" in name as requested)
DB_PATH = Path(__file__).parent / "mock_cineradar.db"

# Cities with population weighting (affects base occupancy)
CITIES = {
    "JAKARTA": {"region": "Jabodetabek", "weight": 1.0, "theatres": 25},
    "SURABAYA": {"region": "East Java", "weight": 0.8, "theatres": 12},
    "BANDUNG": {"region": "West Java", "weight": 0.75, "theatres": 10},
    "MEDAN": {"region": "Sumatra", "weight": 0.6, "theatres": 8},
    "SEMARANG": {"region": "Central Java", "weight": 0.55, "theatres": 6},
    "MAKASSAR": {"region": "Sulawesi", "weight": 0.45, "theatres": 5},
    "YOGYAKARTA": {"region": "Central Java", "weight": 0.5, "theatres": 5},
    "PALEMBANG": {"region": "Sumatra", "weight": 0.4, "theatres": 4},
    "MALANG": {"region": "East Java", "weight": 0.35, "theatres": 4},
    "BALIKPAPAN": {"region": "Kalimantan", "weight": 0.3, "theatres": 3},
    "MANADO": {"region": "Sulawesi", "weight": 0.25, "theatres": 2},
    "PONTIANAK": {"region": "Kalimantan", "weight": 0.2, "theatres": 2},
}

CHAINS = {
    "XXI": {"market_share": 0.55, "avg_seats": 180},
    "CGV": {"market_share": 0.30, "avg_seats": 150},
    "Cinépolis": {"market_share": 0.15, "avg_seats": 200},
}

ROOM_TYPES = {
    "2D": {"price_range": (35000, 50000), "popularity": 0.6},
    "3D": {"price_range": (55000, 75000), "popularity": 0.15},
    "IMAX": {"price_range": (90000, 120000), "popularity": 0.1},
    "GOLD CLASS": {"price_range": (150000, 200000), "popularity": 0.08},
    "VELVET": {"price_range": (100000, 130000), "popularity": 0.05},
    "PREMIERE": {"price_range": (120000, 160000), "popularity": 0.02},
}

MOVIES = [
    {"title": "AVATAR: FIRE AND ASH", "genre": "Sci-Fi", "popularity": 0.95, "weeks_out": 1},
    {"title": "AGAK LAEN 2", "genre": "Comedy", "popularity": 0.90, "weeks_out": 2},
    {"title": "ZOOTOPIA 2", "genre": "Animation", "popularity": 0.85, "weeks_out": 1},
    {"title": "TRANSFORMERS ONE", "genre": "Action", "popularity": 0.75, "weeks_out": 3},
    {"title": "DILAN 2025", "genre": "Romance", "popularity": 0.80, "weeks_out": 1},
    {"title": "QORIN 2", "genre": "Horror", "popularity": 0.70, "weeks_out": 2},
    {"title": "SIKSA NERAKA", "genre": "Horror", "popularity": 0.65, "weeks_out": 4},
    {"title": "KRAVEN THE HUNTER", "genre": "Action", "popularity": 0.60, "weeks_out": 3},
    {"title": "SONIC 3", "genre": "Animation", "popularity": 0.78, "weeks_out": 2},
    {"title": "NOSFERATU", "genre": "Horror", "popularity": 0.55, "weeks_out": 1},
]

# Showtime patterns (hour: occupancy multiplier)
SHOWTIME_PATTERNS = {
    10: 0.3, 11: 0.35, 12: 0.5, 13: 0.55, 14: 0.6,
    15: 0.65, 16: 0.7, 17: 0.75, 18: 0.85, 19: 0.95,
    20: 0.90, 21: 0.80, 22: 0.60, 23: 0.40,
}

# Day of week patterns (0=Mon, 6=Sun)
DAY_PATTERNS = {
    0: 0.5, 1: 0.45, 2: 0.5, 3: 0.55, 4: 0.7,  # Mon-Fri
    5: 1.0, 6: 0.95,  # Sat-Sun
}


def create_schema(conn: sqlite3.Connection):
    """Create database schema."""
    conn.executescript("""
        DROP TABLE IF EXISTS occupancy;
        DROP TABLE IF EXISTS showtimes;
        DROP TABLE IF EXISTS theatres;
        DROP TABLE IF EXISTS movies;
        DROP TABLE IF EXISTS cities;
        
        CREATE TABLE cities (
            city_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            region TEXT NOT NULL,
            population_weight REAL NOT NULL
        );
        
        CREATE TABLE theatres (
            theatre_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            city_id INTEGER NOT NULL,
            chain TEXT NOT NULL,
            total_seats INTEGER NOT NULL,
            lat REAL,
            lng REAL,
            FOREIGN KEY (city_id) REFERENCES cities(city_id)
        );
        
        CREATE TABLE movies (
            movie_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            popularity REAL NOT NULL,
            release_week INTEGER NOT NULL
        );
        
        CREATE TABLE showtimes (
            showtime_id INTEGER PRIMARY KEY,
            theatre_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            room_type TEXT NOT NULL,
            show_date DATE NOT NULL,
            show_time TIME NOT NULL,
            price INTEGER NOT NULL,
            total_seats INTEGER NOT NULL,
            FOREIGN KEY (theatre_id) REFERENCES theatres(theatre_id),
            FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
        );
        
        CREATE TABLE occupancy (
            id INTEGER PRIMARY KEY,
            showtime_id INTEGER NOT NULL,
            captured_at DATETIME NOT NULL,
            seats_sold INTEGER NOT NULL,
            occupancy_pct REAL NOT NULL,
            FOREIGN KEY (showtime_id) REFERENCES showtimes(showtime_id)
        );
        
        CREATE INDEX idx_occupancy_showtime ON occupancy(showtime_id);
        CREATE INDEX idx_showtimes_date ON showtimes(show_date);
        CREATE INDEX idx_theatres_city ON theatres(city_id);
    """)


def generate_data(conn: sqlite3.Connection, days: int = 7):
    """Generate realistic mock data."""
    cursor = conn.cursor()
    
    # Insert cities
    city_map = {}
    for i, (city_name, info) in enumerate(CITIES.items(), 1):
        cursor.execute(
            "INSERT INTO cities (city_id, name, region, population_weight) VALUES (?, ?, ?, ?)",
            (i, city_name, info["region"], info["weight"])
        )
        city_map[city_name] = i
    
    # Insert movies
    for i, movie in enumerate(MOVIES, 1):
        cursor.execute(
            "INSERT INTO movies (movie_id, title, genre, popularity, release_week) VALUES (?, ?, ?, ?, ?)",
            (i, movie["title"], movie["genre"], movie["popularity"], movie["weeks_out"])
        )
    
    # Insert theatres
    theatre_id = 0
    theatre_map = {}
    for city_name, city_info in CITIES.items():
        city_id = city_map[city_name]
        for t in range(city_info["theatres"]):
            theatre_id += 1
            chain = random.choices(
                list(CHAINS.keys()),
                weights=[CHAINS[c]["market_share"] for c in CHAINS]
            )[0]
            name = f"{city_name} {chain} {t+1}"
            seats = CHAINS[chain]["avg_seats"] + random.randint(-30, 50)
            cursor.execute(
                "INSERT INTO theatres (theatre_id, name, city_id, chain, total_seats) VALUES (?, ?, ?, ?, ?)",
                (theatre_id, name, city_id, chain, seats)
            )
            theatre_map[theatre_id] = {"city": city_name, "chain": chain, "seats": seats}
    
    # Generate showtimes and occupancy for each day
    showtime_id = 0
    today = datetime.now().date()
    
    for day_offset in range(-days, 1):  # Past days + today
        current_date = today + timedelta(days=day_offset)
        day_of_week = current_date.weekday()
        day_mult = DAY_PATTERNS[day_of_week]
        
        for t_id, t_info in theatre_map.items():
            city_weight = CITIES[t_info["city"]]["weight"]
            
            # Each theatre shows 3-5 movies per day
            movies_showing = random.sample(range(1, len(MOVIES) + 1), random.randint(3, min(5, len(MOVIES))))
            
            for movie_id in movies_showing:
                movie = MOVIES[movie_id - 1]
                movie_pop = movie["popularity"]
                
                # Reduce popularity for older movies
                weeks_penalty = 1 - (movie["weeks_out"] * 0.1)
                
                # Pick 1-2 room types
                room_types = random.choices(
                    list(ROOM_TYPES.keys()),
                    weights=[ROOM_TYPES[r]["popularity"] for r in ROOM_TYPES],
                    k=random.randint(1, 2)
                )
                
                for room_type in set(room_types):
                    room_info = ROOM_TYPES[room_type]
                    seats = t_info["seats"]
                    if room_type in ["GOLD CLASS", "PREMIERE"]:
                        seats = min(50, seats // 3)
                    elif room_type == "IMAX":
                        seats = int(seats * 1.5)
                    
                    price = random.randint(*room_info["price_range"])
                    
                    # Generate 4-8 showtimes per movie per room
                    showtime_hours = random.sample(range(10, 23), random.randint(4, 8))
                    
                    for hour in sorted(showtime_hours):
                        showtime_id += 1
                        show_time = f"{hour:02d}:{random.choice(['00', '15', '30', '45'])}"
                        
                        cursor.execute(
                            """INSERT INTO showtimes 
                               (showtime_id, theatre_id, movie_id, room_type, show_date, show_time, price, total_seats)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (showtime_id, t_id, movie_id, room_type, current_date.isoformat(), show_time, price, seats)
                        )
                        
                        # Calculate occupancy
                        time_mult = SHOWTIME_PATTERNS.get(hour, 0.5)
                        
                        # Base occupancy formula
                        base_occupancy = (
                            city_weight * 0.3 +     # City factor
                            movie_pop * 0.35 +      # Movie popularity
                            time_mult * 0.2 +       # Time of day
                            day_mult * 0.15         # Day of week
                        ) * weeks_penalty
                        
                        # Add randomness
                        occupancy_pct = base_occupancy + random.uniform(-0.15, 0.15)
                        occupancy_pct = max(0.05, min(0.98, occupancy_pct))
                        
                        # For past/current showtimes, record occupancy
                        if day_offset <= 0:
                            seats_sold = int(seats * occupancy_pct)
                            captured_at = datetime.combine(current_date, datetime.min.time()) + timedelta(hours=hour-1)
                            
                            cursor.execute(
                                """INSERT INTO occupancy (showtime_id, captured_at, seats_sold, occupancy_pct)
                                   VALUES (?, ?, ?, ?)""",
                                (showtime_id, captured_at.isoformat(), seats_sold, round(occupancy_pct, 3))
                            )
    
    conn.commit()
    print(f"✅ Generated data:")
    print(f"   Cities: {len(CITIES)}")
    print(f"   Theatres: {theatre_id}")
    print(f"   Movies: {len(MOVIES)}")
    print(f"   Showtimes: {showtime_id}")
    print(f"   Occupancy records: {cursor.execute('SELECT COUNT(*) FROM occupancy').fetchone()[0]}")


def run_bi_queries(conn: sqlite3.Connection):
    """Run sample BI queries to demonstrate insights."""
    cursor = conn.cursor()
    
    print("\n" + "="*60)
    print("📊 BUSINESS INTELLIGENCE INSIGHTS")
    print("="*60)
    
    # 1. Low-performing cities
    print("\n🔴 LOW-PERFORMING CITIES (Avg Occupancy < 50%)")
    print("-" * 50)
    cursor.execute("""
        SELECT c.name, c.region, 
               ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
               COUNT(DISTINCT t.theatre_id) as theatres,
               COUNT(DISTINCT s.showtime_id) as showtimes
        FROM cities c
        JOIN theatres t ON c.city_id = t.city_id
        JOIN showtimes s ON t.theatre_id = s.theatre_id
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        GROUP BY c.city_id
        HAVING avg_occupancy < 50
        ORDER BY avg_occupancy ASC
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:15} | {row[1]:12} | {row[2]:5}% | {row[3]} theatres")
    
    # 2. Low-performing theatres
    print("\n🔴 BOTTOM 10 THEATRES BY OCCUPANCY")
    print("-" * 50)
    cursor.execute("""
        SELECT t.name, t.chain, c.name as city,
               ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
               COUNT(s.showtime_id) as showtimes
        FROM theatres t
        JOIN cities c ON t.city_id = c.city_id
        JOIN showtimes s ON t.theatre_id = s.theatre_id
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        GROUP BY t.theatre_id
        ORDER BY avg_occupancy ASC
        LIMIT 10
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:25} | {row[1]:10} | {row[2]:12} | {row[3]:5}%")
    
    # 3. Time-slot analysis
    print("\n⏰ OCCUPANCY BY TIME SLOT")
    print("-" * 50)
    cursor.execute("""
        SELECT 
            CASE 
                WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 12 THEN 'Morning (10-12)'
                WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 15 THEN 'Afternoon (12-15)'
                WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 18 THEN 'Evening (15-18)'
                WHEN CAST(substr(s.show_time, 1, 2) AS INTEGER) < 21 THEN 'Prime (18-21)'
                ELSE 'Late (21+)'
            END as time_slot,
            ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
            COUNT(*) as showtimes
        FROM showtimes s
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        GROUP BY time_slot
        ORDER BY avg_occupancy DESC
    """)
    for row in cursor.fetchall():
        bar = "█" * int(row[1] / 5)
        print(f"  {row[0]:20} | {row[1]:5}% | {bar}")
    
    # 4. Chain performance
    print("\n🎬 CHAIN PERFORMANCE COMPARISON")
    print("-" * 50)
    cursor.execute("""
        SELECT t.chain,
               COUNT(DISTINCT t.theatre_id) as theatres,
               ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
               ROUND(AVG(s.price), 0) as avg_price
        FROM theatres t
        JOIN showtimes s ON t.theatre_id = s.theatre_id
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        GROUP BY t.chain
        ORDER BY avg_occupancy DESC
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:12} | {row[1]:3} theatres | {row[2]:5}% occ | Rp{row[3]:,} avg")
    
    # 5. Movies needing promotion
    print("\n📽️ MOVIES NEEDING MARKETING PUSH (Low occupancy)")
    print("-" * 50)
    cursor.execute("""
        SELECT m.title, m.genre,
               ROUND(AVG(o.occupancy_pct) * 100, 1) as avg_occupancy,
               COUNT(DISTINCT s.showtime_id) as showtimes
        FROM movies m
        JOIN showtimes s ON m.movie_id = s.movie_id
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        GROUP BY m.movie_id
        ORDER BY avg_occupancy ASC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:30} | {row[1]:10} | {row[2]:5}%")
    
    # 6. Real-time marketing triggers
    print("\n🚨 MARKETING ACTIVATION TRIGGERS")
    print("-" * 50)
    cursor.execute("""
        SELECT 
            t.name as theatre,
            c.name as city,
            m.title as movie,
            s.show_time,
            s.room_type,
            ROUND(o.occupancy_pct * 100, 1) as occupancy,
            s.total_seats - o.seats_sold as empty_seats
        FROM showtimes s
        JOIN theatres t ON s.theatre_id = t.theatre_id
        JOIN cities c ON t.city_id = c.city_id
        JOIN movies m ON s.movie_id = m.movie_id
        JOIN occupancy o ON s.showtime_id = o.showtime_id
        WHERE s.show_date = date('now')
          AND o.occupancy_pct < 0.3
        ORDER BY o.occupancy_pct ASC
        LIMIT 10
    """)
    triggers = cursor.fetchall()
    if triggers:
        for row in triggers:
            print(f"  ⚠️  {row[1]} | {row[0][:20]} | {row[2][:20]} | {row[3]} | {row[5]}% ({row[6]} empty)")
    else:
        print("  No critical triggers today (sample data ends today)")
    
    print("\n" + "="*60)
    print("💡 ACTIONABLE INSIGHTS")
    print("="*60)
    print("""
    1. 🎯 FLASH SALE CANDIDATES
       - Target: Theatres with <30% occupancy 2 hours before showtime
       - Action: Push notification with 20-30% discount
       
    2. 📱 GEO-TARGETED PROMOTIONS  
       - Target: Low-performing cities (Pontianak, Manado, Balikpapan)
       - Action: Local social media ads, partnership with local influencers
       
    3. ⏰ OFF-PEAK INCENTIVES
       - Target: Morning shows (10-12) with <40% occupancy
       - Action: "Early Bird Special" - combo deals, lower prices
       
    4. 🎬 MOVIE-SPECIFIC CAMPAIGNS
       - Target: Underperforming new releases
       - Action: TikTok challenges, review incentives, group discounts
       
    5. 🔄 REAL-TIME TRIGGERS
       - Condition: <25% occupancy 1 hour before show
       - Action: Auto-trigger push notification to nearby app users
    """)


def main():
    """Main entry point."""
    print(f"📦 Creating mock database at: {DB_PATH}")
    
    # Remove existing
    if DB_PATH.exists():
        DB_PATH.unlink()
    
    conn = sqlite3.connect(DB_PATH)
    
    try:
        create_schema(conn)
        generate_data(conn, days=7)
        run_bi_queries(conn)
    finally:
        conn.close()
    
    print(f"\n✅ Database saved to: {DB_PATH}")


if __name__ == "__main__":
    main()
