"""
Firestore Theatre Repository

Implements ITheatreRepository using Firebase Firestore.
"""

from datetime import datetime
from typing import Any

from backend.application.ports.storage import ITheatreRepository
from backend.domain.models import Theatre

# Reuse firestore client helper
from backend.infrastructure.repositories.firestore_token import _get_firestore_client


class FirestoreTheatreRepository(ITheatreRepository):
    """Firestore implementation of theatre storage.

    Manages the theatres collection with geocoding data.

    Example:
        repo = FirestoreTheatreRepository()

        # Upsert theatre
        theatre = Theatre(theatre_id="123", name="XXI", merchant="XXI", city="JAKARTA")
        repo.upsert(theatre)

        # Get theatres without location
        ungeocoded = repo.get_without_location()
    """

    COLLECTION = "theatres"

    def __init__(self) -> None:
        self._db = None

    @property
    def db(self) -> Any:
        if self._db is None:
            self._db = _get_firestore_client()
        return self._db

    def upsert(self, theatre: Theatre) -> bool:
        """Insert or update a theatre.

        If theatre exists, merges room_types and updates last_seen.

        Args:
            theatre: Theatre domain object

        Returns:
            True if operation successful
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(str(theatre.theatre_id))
            doc = doc_ref.get()
            now = datetime.utcnow().isoformat()

            if doc.exists:
                # Update existing
                existing = doc.to_dict()

                # Merge room types
                existing_rooms = set(existing.get("room_types", []))
                new_rooms = set(theatre.room_types)
                merged_rooms = list(existing_rooms | new_rooms)

                update_data = {
                    "name": theatre.name,
                    "merchant": theatre.merchant,
                    "city": theatre.city,
                    "address": theatre.address,
                    "last_seen": now,
                    "updated_at": now,
                    "room_types": merged_rooms,
                }

                # Only update location if provided and not already set
                if theatre.lat is not None and existing.get("lat") is None:
                    update_data["lat"] = theatre.lat
                if theatre.lng is not None and existing.get("lng") is None:
                    update_data["lng"] = theatre.lng
                if theatre.place_id and not existing.get("place_id"):
                    update_data["place_id"] = theatre.place_id

                doc_ref.update(update_data)
            else:
                # Create new
                doc_ref.set(
                    {
                        "theatre_id": str(theatre.theatre_id),
                        "name": theatre.name,
                        "merchant": theatre.merchant,
                        "city": theatre.city,
                        "address": theatre.address,
                        "lat": theatre.lat,
                        "lng": theatre.lng,
                        "place_id": theatre.place_id,
                        "room_types": theatre.room_types,
                        "last_seen": now,
                        "created_at": now,
                        "updated_at": now,
                    }
                )

            return True

        except Exception as e:
            print(f"⚠️ Error upserting theatre {theatre.theatre_id}: {e}")
            return False

    def get_by_id(self, theatre_id: str) -> Theatre | None:
        """Get theatre by ID."""
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(str(theatre_id))
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return Theatre.from_dict(doc.to_dict())
        except Exception:
            return None

    def get_all(self) -> list[Theatre]:
        """Get all theatres."""
        try:
            docs = self.db.collection(self.COLLECTION).stream()
            return [Theatre.from_dict(doc.to_dict()) for doc in docs]
        except Exception as e:
            print(f"⚠️ Error getting theatres: {e}")
            return []

    def get_by_city(self, city: str) -> list[Theatre]:
        """Get theatres in a specific city."""
        try:
            docs = self.db.collection(self.COLLECTION).where("city", "==", city.upper()).stream()
            return [Theatre.from_dict(doc.to_dict()) for doc in docs]
        except Exception as e:
            print(f"⚠️ Error getting theatres for {city}: {e}")
            return []

    def get_by_merchant(self, merchant: str) -> list[Theatre]:
        """Get theatres by cinema chain."""
        try:
            docs = self.db.collection(self.COLLECTION).where("merchant", "==", merchant).stream()
            return [Theatre.from_dict(doc.to_dict()) for doc in docs]
        except Exception as e:
            print(f"⚠️ Error getting theatres for {merchant}: {e}")
            return []

    def get_without_location(self) -> list[Theatre]:
        """Get theatres that haven't been geocoded."""
        try:
            docs = self.db.collection(self.COLLECTION).where("lat", "==", None).stream()
            return [Theatre.from_dict(doc.to_dict()) for doc in docs]
        except Exception:
            # Firestore doesn't handle null queries well, get all and filter
            all_theatres = self.get_all()
            return [t for t in all_theatres if not t.has_location]

    def update_location(
        self, theatre_id: str, lat: float, lng: float, place_id: str | None = None
    ) -> bool:
        """Update theatre location."""
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(str(theatre_id))

            update_data = {
                "lat": lat,
                "lng": lng,
                "updated_at": datetime.utcnow().isoformat(),
            }
            if place_id:
                update_data["place_id"] = place_id

            doc_ref.update(update_data)
            return True
        except Exception as e:
            print(f"⚠️ Error updating location for {theatre_id}: {e}")
            return False

    def count(self) -> int:
        """Get total theatre count."""
        try:
            # Use aggregation query if available
            return len(self.get_all())
        except Exception:
            return 0
