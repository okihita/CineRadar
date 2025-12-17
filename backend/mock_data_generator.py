#!/usr/bin/env python3
"""
Extended Mock Data Generator for CineRadar BI Dashboard
Creates SQLite database with realistic cinema data for all intelligence modules
"""

import sqlite3
import random
from datetime import datetime, timedelta
from pathlib import Path
import math

# Database file
DB_PATH = Path(__file__).parent / "mock_cineradar.db"

# Cities with population weighting
CITIES = {
    "JAKARTA": {"region": "Jabodetabek", "weight": 1.0, "theatres": 25, "population": 10_500_000},
    "SURABAYA": {"region": "East Java", "weight": 0.8, "theatres": 12, "population": 2_900_000},
    "BANDUNG": {"region": "West Java", "weight": 0.75, "theatres": 10, "population": 2_500_000},
    "MEDAN": {"region": "Sumatra", "weight": 0.6, "theatres": 8, "population": 2_200_000},
    "SEMARANG": {"region": "Central Java", "weight": 0.55, "theatres": 6, "population": 1_700_000},
    "MAKASSAR": {"region": "Sulawesi", "weight": 0.45, "theatres": 5, "population": 1_500_000},
    "YOGYAKARTA": {"region": "Central Java", "weight": 0.5, "theatres": 5, "population": 420_000},
    "PALEMBANG": {"region": "Sumatra", "weight": 0.4, "theatres": 4, "population": 1_600_000},
    "MALANG": {"region": "East Java", "weight": 0.35, "theatres": 4, "population": 870_000},
    "BALIKPAPAN": {"region": "Kalimantan", "weight": 0.3, "theatres": 3, "population": 650_000},
    "MANADO": {"region": "Sulawesi", "weight": 0.25, "theatres": 2, "population": 430_000},
    "PONTIANAK": {"region": "Kalimantan", "weight": 0.2, "theatres": 2, "population": 620_000},
}

CHAINS = {
    "XXI": {"market_share": 0.55, "avg_seats": 180, "avg_price_mult": 1.0, "founded": 1990},
    "CGV": {"market_share": 0.30, "avg_seats": 150, "avg_price_mult": 1.15, "founded": 2006},
    "Cinépolis": {"market_share": 0.15, "avg_seats": 200, "avg_price_mult": 1.10, "founded": 2014},
}

ROOM_TYPES = {
    "2D": {"price_range": (35000, 50000), "popularity": 0.6, "concession_mult": 1.0},
    "3D": {"price_range": (55000, 75000), "popularity": 0.15, "concession_mult": 1.1},
    "IMAX": {"price_range": (90000, 120000), "popularity": 0.1, "concession_mult": 1.3},
    "GOLD CLASS": {"price_range": (150000, 200000), "popularity": 0.08, "concession_mult": 1.8},
    "VELVET": {"price_range": (100000, 130000), "popularity": 0.05, "concession_mult": 1.5},
    "PREMIERE": {"price_range": (120000, 160000), "popularity": 0.02, "concession_mult": 1.6},
}

MOVIES = [
    {"title": "AVATAR: FIRE AND ASH", "genre": "Sci-Fi", "popularity": 0.95, "weeks_out": 1, "budget_usd": 250_000_000},
    {"title": "AGAK LAEN 2", "genre": "Comedy", "popularity": 0.90, "weeks_out": 2, "budget_usd": 2_000_000},
    {"title": "ZOOTOPIA 2", "genre": "Animation", "popularity": 0.85, "weeks_out": 1, "budget_usd": 150_000_000},
    {"title": "TRANSFORMERS ONE", "genre": "Action", "popularity": 0.75, "weeks_out": 3, "budget_usd": 200_000_000},
    {"title": "DILAN 2025", "genre": "Romance", "popularity": 0.80, "weeks_out": 1, "budget_usd": 1_500_000},
    {"title": "QORIN 2", "genre": "Horror", "popularity": 0.70, "weeks_out": 2, "budget_usd": 800_000},
    {"title": "SIKSA NERAKA", "genre": "Horror", "popularity": 0.65, "weeks_out": 4, "budget_usd": 500_000},
    {"title": "KRAVEN THE HUNTER", "genre": "Action", "popularity": 0.60, "weeks_out": 3, "budget_usd": 120_000_000},
    {"title": "SONIC 3", "genre": "Animation", "popularity": 0.78, "weeks_out": 2, "budget_usd": 90_000_000},
    {"title": "NOSFERATU", "genre": "Horror", "popularity": 0.55, "weeks_out": 1, "budget_usd": 50_000_000},
]

GENRES = ["Action", "Comedy", "Horror", "Animation", "Romance", "Sci-Fi", "Drama", "Thriller"]

SHOWTIME_PATTERNS = {
    10: 0.3, 11: 0.35, 12: 0.5, 13: 0.55, 14: 0.6,
    15: 0.65, 16: 0.7, 17: 0.75, 18: 0.85, 19: 0.95,
    20: 0.90, 21: 0.80, 22: 0.60, 23: 0.40,
}

DAY_PATTERNS = {0: 0.5, 1: 0.45, 2: 0.5, 3: 0.55, 4: 0.7, 5: 1.0, 6: 0.95}


def create_schema(conn: sqlite3.Connection):
    """Create database schema for all intelligence modules."""
    conn.executescript("""
        DROP TABLE IF EXISTS revenue_daily;
        DROP TABLE IF EXISTS market_share;
        DROP TABLE IF EXISTS genre_trends;
        DROP TABLE IF EXISTS price_history;
        DROP TABLE IF EXISTS expansion_events;
        DROP TABLE IF EXISTS social_sentiment;
        DROP TABLE IF EXISTS occupancy;
        DROP TABLE IF EXISTS showtimes;
        DROP TABLE IF EXISTS theatres;
        DROP TABLE IF EXISTS movies;
        DROP TABLE IF EXISTS cities;
        
        -- Core Tables
        CREATE TABLE cities (
            city_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            region TEXT NOT NULL,
            population_weight REAL NOT NULL,
            population INTEGER NOT NULL
        );
        
        CREATE TABLE theatres (
            theatre_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            city_id INTEGER NOT NULL,
            chain TEXT NOT NULL,
            total_seats INTEGER NOT NULL,
            opened_date DATE,
            lat REAL,
            lng REAL,
            FOREIGN KEY (city_id) REFERENCES cities(city_id)
        );
        
        CREATE TABLE movies (
            movie_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            popularity REAL NOT NULL,
            release_week INTEGER NOT NULL,
            budget_usd INTEGER
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
        
        -- Revenue Intelligence Tables
        CREATE TABLE revenue_daily (
            id INTEGER PRIMARY KEY,
            theatre_id INTEGER NOT NULL,
            date DATE NOT NULL,
            ticket_revenue INTEGER NOT NULL,
            concession_revenue INTEGER NOT NULL,
            total_revenue INTEGER NOT NULL,
            tickets_sold INTEGER NOT NULL,
            avg_ticket_price REAL NOT NULL,
            FOREIGN KEY (theatre_id) REFERENCES theatres(theatre_id)
        );
        
        -- Competition Intelligence Tables
        CREATE TABLE market_share (
            id INTEGER PRIMARY KEY,
            city_id INTEGER NOT NULL,
            chain TEXT NOT NULL,
            month TEXT NOT NULL,
            share_pct REAL NOT NULL,
            theatre_count INTEGER NOT NULL,
            FOREIGN KEY (city_id) REFERENCES cities(city_id)
        );
        
        CREATE TABLE price_history (
            id INTEGER PRIMARY KEY,
            chain TEXT NOT NULL,
            room_type TEXT NOT NULL,
            month TEXT NOT NULL,
            avg_price INTEGER NOT NULL,
            min_price INTEGER NOT NULL,
            max_price INTEGER NOT NULL
        );
        
        CREATE TABLE expansion_events (
            id INTEGER PRIMARY KEY,
            chain TEXT NOT NULL,
            city_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            event_date DATE NOT NULL,
            theatre_name TEXT,
            notes TEXT,
            FOREIGN KEY (city_id) REFERENCES cities(city_id)
        );
        
        -- Trend Intelligence Tables
        CREATE TABLE genre_trends (
            id INTEGER PRIMARY KEY,
            genre TEXT NOT NULL,
            region TEXT NOT NULL,
            month TEXT NOT NULL,
            avg_occupancy REAL NOT NULL,
            revenue INTEGER NOT NULL,
            showtime_count INTEGER NOT NULL
        );
        
        CREATE TABLE social_sentiment (
            id INTEGER PRIMARY KEY,
            movie_id INTEGER NOT NULL,
            date DATE NOT NULL,
            twitter_mentions INTEGER NOT NULL,
            sentiment_score REAL NOT NULL,
            trending_rank INTEGER,
            FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
        );
        
        -- Indexes
        CREATE INDEX idx_occupancy_showtime ON occupancy(showtime_id);
        CREATE INDEX idx_showtimes_date ON showtimes(show_date);
        CREATE INDEX idx_theatres_city ON theatres(city_id);
        CREATE INDEX idx_revenue_date ON revenue_daily(date);
        CREATE INDEX idx_market_share_month ON market_share(month);
        CREATE INDEX idx_genre_trends_month ON genre_trends(month);
    """)


def generate_core_data(conn: sqlite3.Connection, days: int = 30):
    """Generate core data: cities, theatres, movies, showtimes, occupancy."""
    cursor = conn.cursor()
    
    # Insert cities
    city_map = {}
    for i, (city_name, info) in enumerate(CITIES.items(), 1):
        cursor.execute(
            "INSERT INTO cities (city_id, name, region, population_weight, population) VALUES (?, ?, ?, ?, ?)",
            (i, city_name, info["region"], info["weight"], info["population"])
        )
        city_map[city_name] = i
    
    # Insert movies
    for i, movie in enumerate(MOVIES, 1):
        cursor.execute(
            "INSERT INTO movies (movie_id, title, genre, popularity, release_week, budget_usd) VALUES (?, ?, ?, ?, ?, ?)",
            (i, movie["title"], movie["genre"], movie["popularity"], movie["weeks_out"], movie["budget_usd"])
        )
    
    # Insert theatres
    theatre_id = 0
    theatre_map = {}
    today = datetime.now().date()
    
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
            # Random opening date in past 10 years
            opened = today - timedelta(days=random.randint(30, 3650))
            cursor.execute(
                "INSERT INTO theatres (theatre_id, name, city_id, chain, total_seats, opened_date) VALUES (?, ?, ?, ?, ?, ?)",
                (theatre_id, name, city_id, chain, seats, opened.isoformat())
            )
            theatre_map[theatre_id] = {"city": city_name, "chain": chain, "seats": seats, "city_id": city_id}
    
    # Generate showtimes and occupancy for each day
    showtime_id = 0
    
    for day_offset in range(-days, 1):
        current_date = today + timedelta(days=day_offset)
        day_of_week = current_date.weekday()
        day_mult = DAY_PATTERNS[day_of_week]
        
        for t_id, t_info in theatre_map.items():
            city_weight = CITIES[t_info["city"]]["weight"]
            chain_price_mult = CHAINS[t_info["chain"]]["avg_price_mult"]
            
            movies_showing = random.sample(range(1, len(MOVIES) + 1), random.randint(3, min(5, len(MOVIES))))
            
            for movie_id in movies_showing:
                movie = MOVIES[movie_id - 1]
                movie_pop = movie["popularity"]
                weeks_penalty = 1 - (movie["weeks_out"] * 0.1)
                
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
                    
                    base_price = random.randint(*room_info["price_range"])
                    price = int(base_price * chain_price_mult)
                    
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
                        
                        time_mult = SHOWTIME_PATTERNS.get(hour, 0.5)
                        base_occupancy = (
                            city_weight * 0.3 +
                            movie_pop * 0.35 +
                            time_mult * 0.2 +
                            day_mult * 0.15
                        ) * weeks_penalty
                        
                        occupancy_pct = base_occupancy + random.uniform(-0.15, 0.15)
                        occupancy_pct = max(0.05, min(0.98, occupancy_pct))
                        
                        seats_sold = int(seats * occupancy_pct)
                        captured_at = datetime.combine(current_date, datetime.min.time()) + timedelta(hours=hour-1)
                        
                        cursor.execute(
                            """INSERT INTO occupancy (showtime_id, captured_at, seats_sold, occupancy_pct)
                               VALUES (?, ?, ?, ?)""",
                            (showtime_id, captured_at.isoformat(), seats_sold, round(occupancy_pct, 3))
                        )
    
    conn.commit()
    print(f"✅ Core data generated:")
    print(f"   Cities: {len(CITIES)}")
    print(f"   Theatres: {theatre_id}")
    print(f"   Movies: {len(MOVIES)}")
    print(f"   Showtimes: {showtime_id}")
    
    return theatre_map, city_map


def generate_revenue_data(conn: sqlite3.Connection, theatre_map: dict, days: int = 30):
    """Generate revenue intelligence data."""
    cursor = conn.cursor()
    today = datetime.now().date()
    
    for day_offset in range(-days, 0):
        current_date = today + timedelta(days=day_offset)
        
        for t_id, t_info in theatre_map.items():
            # Get actual occupancy data for this theatre/date
            cursor.execute("""
                SELECT SUM(o.seats_sold), AVG(s.price), COUNT(*)
                FROM showtimes s
                JOIN occupancy o ON s.showtime_id = o.showtime_id
                WHERE s.theatre_id = ? AND s.show_date = ?
            """, (t_id, current_date.isoformat()))
            
            result = cursor.fetchone()
            tickets_sold = result[0] or random.randint(100, 500)
            avg_price = result[1] or 50000
            
            ticket_revenue = int(tickets_sold * avg_price)
            concession_mult = random.uniform(0.3, 0.5)  # 30-50% of ticket revenue
            concession_revenue = int(ticket_revenue * concession_mult)
            
            cursor.execute("""
                INSERT INTO revenue_daily (theatre_id, date, ticket_revenue, concession_revenue, 
                                          total_revenue, tickets_sold, avg_ticket_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (t_id, current_date.isoformat(), ticket_revenue, concession_revenue,
                  ticket_revenue + concession_revenue, tickets_sold, avg_price))
    
    conn.commit()
    print(f"✅ Revenue data generated: {days} days × {len(theatre_map)} theatres")


def generate_competition_data(conn: sqlite3.Connection, city_map: dict):
    """Generate competition intelligence data."""
    cursor = conn.cursor()
    today = datetime.now().date()
    
    # Market share by city by month (last 12 months)
    for month_offset in range(-12, 1):
        month_date = today.replace(day=1) + timedelta(days=month_offset * 30)
        month_str = month_date.strftime("%Y-%m")
        
        for city_name, city_id in city_map.items():
            city_theatres = CITIES[city_name]["theatres"]
            
            for chain, chain_info in CHAINS.items():
                # Base share with some variability
                base_share = chain_info["market_share"]
                share = base_share + random.uniform(-0.05, 0.05)
                share = max(0.1, min(0.6, share))
                
                theatre_count = max(1, int(city_theatres * share))
                
                cursor.execute("""
                    INSERT INTO market_share (city_id, chain, month, share_pct, theatre_count)
                    VALUES (?, ?, ?, ?, ?)
                """, (city_id, chain, month_str, round(share * 100, 1), theatre_count))
    
    # Price history by chain and room type
    for month_offset in range(-12, 1):
        month_date = today.replace(day=1) + timedelta(days=month_offset * 30)
        month_str = month_date.strftime("%Y-%m")
        
        for chain, chain_info in CHAINS.items():
            for room_type, room_info in ROOM_TYPES.items():
                base_min, base_max = room_info["price_range"]
                price_mult = chain_info["avg_price_mult"]
                
                # Slight price inflation over time
                inflation = 1 + (month_offset + 12) * 0.005
                
                min_price = int(base_min * price_mult * inflation)
                max_price = int(base_max * price_mult * inflation)
                avg_price = int((min_price + max_price) / 2)
                
                cursor.execute("""
                    INSERT INTO price_history (chain, room_type, month, avg_price, min_price, max_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (chain, room_type, month_str, avg_price, min_price, max_price))
    
    # Expansion events
    expansion_events = [
        ("CGV", "SURABAYA", "opening", -180, "CGV Tunjungan Plaza 6"),
        ("XXI", "JAKARTA", "opening", -90, "XXI Puri Indah 2"),
        ("Cinépolis", "BANDUNG", "opening", -60, "Cinépolis Paris Van Java 2"),
        ("CGV", "MEDAN", "opening", -30, "CGV Sun Plaza 3"),
        ("XXI", "PONTIANAK", "renovation", -45, "XXI Gaia Bumi Raya"),
        ("CGV", "MAKASSAR", "opening", -15, "CGV Trans Studio"),
        ("Cinépolis", "SURABAYA", "planned", 30, "Cinépolis Galaxy Mall 2"),
        ("XXI", "BALIKPAPAN", "planned", 60, "XXI BSB 2"),
    ]
    
    for chain, city, event_type, days_ago, name in expansion_events:
        city_id = city_map.get(city, 1)
        event_date = today + timedelta(days=days_ago)
        cursor.execute("""
            INSERT INTO expansion_events (chain, city_id, event_type, event_date, theatre_name)
            VALUES (?, ?, ?, ?, ?)
        """, (chain, city_id, event_type, event_date.isoformat(), name))
    
    conn.commit()
    print(f"✅ Competition data generated: 12 months × {len(CITIES)} cities")


def generate_trend_data(conn: sqlite3.Connection, city_map: dict):
    """Generate trend intelligence data."""
    cursor = conn.cursor()
    today = datetime.now().date()
    
    regions = list(set(c["region"] for c in CITIES.values()))
    
    # Genre trends by region by month
    for month_offset in range(-12, 1):
        month_date = today.replace(day=1) + timedelta(days=month_offset * 30)
        month_str = month_date.strftime("%Y-%m")
        
        for genre in GENRES:
            for region in regions:
                # Different genres perform differently in different regions
                base_occupancy = random.uniform(0.4, 0.7)
                
                # Regional preferences
                if genre == "Horror" and region == "East Java":
                    base_occupancy += 0.15
                elif genre == "Comedy" and region == "Sumatra":
                    base_occupancy += 0.1
                elif genre == "Romance" and region == "Central Java":
                    base_occupancy += 0.08
                
                # Seasonal patterns
                month_num = month_date.month
                if genre == "Horror" and month_num in [3, 4]:  # Ramadan
                    base_occupancy += 0.1
                elif genre == "Animation" and month_num in [6, 7, 12]:  # School holidays
                    base_occupancy += 0.12
                
                base_occupancy = min(0.95, base_occupancy)
                revenue = int(base_occupancy * random.randint(500_000_000, 2_000_000_000))
                showtime_count = random.randint(500, 2000)
                
                cursor.execute("""
                    INSERT INTO genre_trends (genre, region, month, avg_occupancy, revenue, showtime_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (genre, region, month_str, round(base_occupancy, 3), revenue, showtime_count))
    
    # Social sentiment (last 30 days)
    for movie_id, movie in enumerate(MOVIES, 1):
        for day_offset in range(-30, 1):
            current_date = today + timedelta(days=day_offset)
            
            # Higher popularity = more mentions
            base_mentions = int(movie["popularity"] * 5000)
            mentions = base_mentions + random.randint(-1000, 2000)
            
            # Sentiment correlates with popularity
            sentiment = movie["popularity"] - 0.1 + random.uniform(-0.1, 0.1)
            sentiment = max(0.1, min(1.0, sentiment))
            
            # Trending rank (1-10 for top movies)
            trending_rank = None
            if movie["popularity"] > 0.7 and random.random() < 0.5:
                trending_rank = random.randint(1, 10)
            
            cursor.execute("""
                INSERT INTO social_sentiment (movie_id, date, twitter_mentions, sentiment_score, trending_rank)
                VALUES (?, ?, ?, ?, ?)
            """, (movie_id, current_date.isoformat(), mentions, round(sentiment, 2), trending_rank))
    
    conn.commit()
    print(f"✅ Trend data generated: {len(GENRES)} genres × {len(regions)} regions × 12 months")


def main():
    """Main entry point."""
    print(f"📦 Creating extended mock database at: {DB_PATH}")
    
    if DB_PATH.exists():
        DB_PATH.unlink()
    
    conn = sqlite3.connect(DB_PATH)
    
    try:
        create_schema(conn)
        theatre_map, city_map = generate_core_data(conn, days=30)
        generate_revenue_data(conn, theatre_map, days=30)
        generate_competition_data(conn, city_map)
        generate_trend_data(conn, city_map)
        
        print(f"\n✅ Database saved to: {DB_PATH}")
        print(f"   Size: {DB_PATH.stat().st_size / 1024 / 1024:.2f} MB")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
