"""
CineRadar Test Suite - Domain Models

Tests for pure domain objects. No mocks needed - these are pure Python.
"""

import pytest
from datetime import datetime, timedelta

from backend.domain.models import (
    Movie,
    Theatre,
    Token,
    Showtime,
    Room,
    TheatreSchedule,
    ScrapeResult,
    SeatOccupancy,
)


class TestShowtime:
    """Tests for Showtime dataclass."""
    
    def test_create_showtime(self):
        st = Showtime(time="19:35", showtime_id="12345")
        assert st.time == "19:35"
        assert st.showtime_id == "12345"
        assert st.is_available == True
    
    def test_hour_extraction(self):
        st = Showtime(time="14:30")
        assert st.hour == 14
    
    def test_morning_showtime(self):
        st = Showtime(time="10:00")
        assert st.is_morning == True
        assert st.is_evening == False
    
    def test_evening_showtime(self):
        st = Showtime(time="19:00")
        assert st.is_morning == False
        assert st.is_evening == True
    
    def test_to_dict_and_back(self):
        st = Showtime(time="15:00", showtime_id="abc", status=1)
        data = st.to_dict()
        st2 = Showtime.from_dict(data)
        assert st2.time == st.time
        assert st2.showtime_id == st.showtime_id


class TestRoom:
    """Tests for Room dataclass."""
    
    def test_create_room(self):
        room = Room(category="2D", price="Rp35.000")
        assert room.category == "2D"
        assert room.showtime_count == 0
    
    def test_room_with_showtimes(self):
        showtimes = [Showtime(time="10:00"), Showtime(time="13:00")]
        room = Room(category="IMAX", price="Rp80.000", showtimes=showtimes)
        assert room.showtime_count == 2
        assert room.available_count == 2
    
    def test_available_count(self):
        showtimes = [
            Showtime(time="10:00", is_available=True),
            Showtime(time="13:00", is_available=False),
        ]
        room = Room(category="2D", price="Rp35.000", showtimes=showtimes)
        assert room.available_count == 1


class TestTheatreSchedule:
    """Tests for TheatreSchedule dataclass."""
    
    def test_create_schedule(self):
        ts = TheatreSchedule(
            theatre_id="123",
            theatre_name="XXI Mall",
            merchant="XXI",
        )
        assert ts.theatre_id == "123"
        assert ts.total_showtimes == 0
    
    def test_total_showtimes(self):
        rooms = [
            Room(category="2D", price="35k", showtimes=[Showtime(time="10:00")]),
            Room(category="GOLD", price="150k", showtimes=[Showtime(time="19:00"), Showtime(time="21:00")]),
        ]
        ts = TheatreSchedule(
            theatre_id="123",
            theatre_name="Test",
            merchant="XXI",
            rooms=rooms,
        )
        assert ts.total_showtimes == 3
        assert ts.room_categories == ["2D", "GOLD"]


class TestMovie:
    """Tests for Movie dataclass."""
    
    def test_create_movie(self):
        movie = Movie(id="123", title="Avatar")
        assert movie.id == "123"
        assert movie.title == "Avatar"
        assert movie.city_count == 0
    
    def test_city_count_from_cities_list(self):
        movie = Movie(
            id="123",
            title="Test",
            cities=["JAKARTA", "BANDUNG", "SURABAYA"],
        )
        assert movie.city_count == 3
    
    def test_is_showing_in(self):
        movie = Movie(id="1", title="Test", cities=["JAKARTA", "BANDUNG"])
        assert movie.is_showing_in("JAKARTA") == True
        assert movie.is_showing_in("jakarta") == True  # Case insensitive
        assert movie.is_showing_in("MALANG") == False
    
    def test_total_theatres(self):
        schedules = {
            "JAKARTA": [
                TheatreSchedule(theatre_id="1", theatre_name="A", merchant="XXI"),
                TheatreSchedule(theatre_id="2", theatre_name="B", merchant="CGV"),
            ],
            "BANDUNG": [
                TheatreSchedule(theatre_id="3", theatre_name="C", merchant="XXI"),
            ],
        }
        movie = Movie(id="1", title="Test", schedules=schedules)
        assert movie.total_theatres == 3
    
    def test_to_dict_and_back(self):
        movie = Movie(
            id="123",
            title="Test Movie",
            genres=["Action", "Sci-Fi"],
            cities=["JAKARTA"],
        )
        data = movie.to_dict()
        movie2 = Movie.from_dict(data)
        assert movie2.id == movie.id
        assert movie2.title == movie.title
        assert movie2.genres == movie.genres


class TestTheatre:
    """Tests for Theatre dataclass."""
    
    def test_create_theatre(self):
        theatre = Theatre(
            theatre_id="123",
            name="ARAYA XXI",
            merchant="XXI",
            city="MALANG",
        )
        assert theatre.theatre_id == "123"
        assert theatre.city == "MALANG"
    
    def test_has_location(self):
        theatre = Theatre(theatre_id="1", name="T", merchant="XXI", city="JKT")
        assert theatre.has_location == False
        
        theatre.lat = -6.2
        theatre.lng = 106.8
        assert theatre.has_location == True
    
    def test_is_premium(self):
        regular = Theatre(
            theatre_id="1", name="T", merchant="XXI", city="JKT",
            room_types=["2D", "3D"],
        )
        assert regular.is_premium == False
        
        premium = Theatre(
            theatre_id="2", name="T", merchant="XXI", city="JKT",
            room_types=["2D", "IMAX", "GOLD CLASS"],
        )
        assert premium.is_premium == True
    
    def test_display_name(self):
        theatre = Theatre(theatre_id="1", name="Mall XXI", merchant="XXI", city="JKT")
        assert theatre.display_name == "Mall XXI"  # XXI already in name
        
        theatre2 = Theatre(theatre_id="2", name="Mall Cinema", merchant="CGV", city="JKT")
        assert theatre2.display_name == "Mall Cinema (CGV)"


class TestToken:
    """Tests for Token dataclass."""
    
    def test_create_new_token(self):
        token = Token.create_new("eyJ...", phone="628***")
        assert token.token == "eyJ..."
        assert token.phone == "628***"
        assert token.minutes_until_expiry > 0
    
    def test_is_expired(self):
        # Create expired token (stored 2 hours ago, TTL is 30 min)
        from datetime import datetime, timedelta
        old_time = (datetime.utcnow() - timedelta(hours=2)).isoformat()
        expired = Token(
            token="test",
            stored_at=old_time,
        )
        assert expired.is_expired == True
        
        # Create valid token (stored now)
        valid = Token.create_new("test")
        assert valid.is_expired == False
    
    def test_is_valid_for_scrape(self):
        # Valid token with plenty of time (just created)
        valid = Token.create_new("test")
        assert valid.is_valid_for_scrape == True
        
        # Token about to expire (stored 26 min ago, only 4 min left)
        now = datetime.utcnow()
        almost_expired = Token(
            token="test",
            stored_at=(now - timedelta(minutes=26)).isoformat(),
        )
        assert almost_expired.is_valid_for_scrape == False  # < 5 min remaining
    
    def test_status_message(self):
        valid = Token.create_new("test")
        assert "✅" in valid.get_status_message()


class TestScrapeResult:
    """Tests for ScrapeResult dataclass."""
    
    def test_movie_count(self):
        movies = [Movie(id=str(i), title=f"Movie {i}") for i in range(5)]
        result = ScrapeResult(
            movies=movies,
            scraped_at="2025-12-18T00:00:00",
            date="2025-12-18",
        )
        assert result.movie_count == 5
    
    def test_presale_count(self):
        movies = [
            Movie(id="1", title="Regular"),
            Movie(id="2", title="Presale", is_presale=True),
            Movie(id="3", title="Another Presale", is_presale=True),
        ]
        result = ScrapeResult(movies=movies, scraped_at="", date="")
        assert result.presale_count == 2


class TestSeatOccupancy:
    """Tests for SeatOccupancy dataclass."""
    
    def test_occupancy_category(self):
        low = SeatOccupancy(showtime_id="1", occupancy_pct=20.0)
        assert low.occupancy_category == "low"
        
        moderate = SeatOccupancy(showtime_id="2", occupancy_pct=50.0)
        assert moderate.occupancy_category == "moderate"
        
        nearly_full = SeatOccupancy(showtime_id="3", occupancy_pct=80.0)
        assert nearly_full.occupancy_category == "nearly_full"
        
        sold_out = SeatOccupancy(showtime_id="4", occupancy_pct=95.0)
        assert sold_out.occupancy_category == "sold_out"
    
    def test_calculate_occupancy(self):
        occ = SeatOccupancy(showtime_id="1", total_seats=100, sold_seats=75)
        occ.calculate_occupancy()
        assert occ.occupancy_pct == 75.0
        assert occ.available_seats == 25
