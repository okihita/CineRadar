"""Firestore Token Repository.

Implements ITokenRepository using Firebase Firestore.
"""

import logging
from typing import Any, cast

from backend.application.ports.storage import ITokenRepository
from backend.domain.errors import FirestoreError
from backend.domain.models import Token
from backend.infrastructure.repositories.firestore_utils import get_firestore_client

logger = logging.getLogger(__name__)


class FirestoreTokenRepository(ITokenRepository):
    """Firestore implementation of token storage.

    Stores JWT tokens in the auth_tokens collection.

    Example:
        repo = FirestoreTokenRepository()

        # Store new token
        token = Token.create_new("eyJ...", phone="628***")
        repo.store(token)

        # Check if valid
        if repo.is_valid():
            current = repo.get_current()
            print(f"Token valid for {current.minutes_until_expiry} min")

    """

    COLLECTION = "auth_tokens"
    DOC_ID = "tix_jwt"
    DEFAULT_TTL_HOURS = 20

    def __init__(self) -> None:
        """Initialize repository."""
        self._db: Any = None
        self._async_db: Any = None

    @property
    def db(self) -> Any:
        """Lazy-load Firestore client."""
        if self._db is None:
            self._db = get_firestore_client()
        return self._db

    @property
    async def async_db(self) -> Any:
        """Lazy-load async Firestore client."""
        if self._async_db is None:
            from backend.infrastructure.repositories.firestore_utils import (
                get_firestore_async_client,
            )

            self._async_db = await get_firestore_async_client()
        return self._async_db

    def store(self, token: Token) -> bool:
        """Store a token in Firestore.

        Args:
            token: Token domain object

        Returns:
            True if stored successfully

        Raises:
            FirestoreError: If store fails

        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc_ref.set(token.to_dict())
            return True
        except Exception as e:
            raise FirestoreError(f"Failed to store token: {e}") from e

    async def store_async(self, token: Token) -> bool:
        """Store a token in Firestore (async)."""
        try:
            db = await self.async_db
            doc_ref = db.collection(self.COLLECTION).document(self.DOC_ID)
            await doc_ref.set(token.to_dict())
            return True
        except Exception as e:
            raise FirestoreError(f"Failed to store token: {e}") from e

    def get_current(self) -> Token | None:
        """Get the current stored token.

        Returns:
            Token or None if no token stored

        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            data = doc.to_dict()
            return Token.from_dict(data)

        except Exception as e:
            logger.error(f"⚠️ Error getting token: {e}")
            return None

    async def get_current_async(self) -> Token | None:
        """Get the current stored token (async)."""
        try:
            db = await self.async_db
            doc_ref = db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = await doc_ref.get()

            if not doc.exists:
                return None

            data = doc.to_dict()
            return Token.from_dict(data)

        except Exception as e:
            logger.error(f"⚠️ Error getting token: {e}")
            return None

    def is_valid(self) -> bool:
        """Check if stored token is still valid.

        Returns:
            True if token exists and not expired

        """
        token = self.get_current()
        return token is not None and not token.is_expired

    async def is_valid_async(self) -> bool:
        """Check if stored token is still valid (async)."""
        token = await self.get_current_async()
        return token is not None and not token.is_expired

    def is_valid_for_scrape(self, min_minutes: int = 25) -> bool:
        """Check if token has enough TTL for scraping.

        Args:
            min_minutes: Minimum minutes required

        Returns:
            True if token has sufficient TTL

        """
        token = self.get_current()
        if not token:
            return False
        return token.minutes_until_expiry >= min_minutes

    async def is_valid_for_scrape_async(self, min_minutes: int = 25) -> bool:
        """Check if token has enough TTL for scraping (async)."""
        token = await self.get_current_async()
        if not token:
            return False
        return token.minutes_until_expiry >= min_minutes

    def delete(self) -> bool:
        """Delete the stored token.

        Returns:
            True if deleted successfully

        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc_ref.delete()
            return True
        except Exception as e:
            logger.error(f"⚠️ Error deleting token: {e}")
            return False

    async def delete_async(self) -> bool:
        """Delete the stored token (async)."""
        try:
            db = await self.async_db
            doc_ref = db.collection(self.COLLECTION).document(self.DOC_ID)
            await doc_ref.delete()
            return True
        except Exception as e:
            logger.error(f"⚠️ Error deleting token: {e}")
            return False

    def get_token_info(self) -> dict[str, str | int | None] | None:
        """Get token info without loading full Token object.

        Returns:
            Dict with token metadata or None

        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return cast("dict[str, str | int | None]", doc.to_dict())
        except Exception:
            return None

    async def get_token_info_async(self) -> dict[str, str | int | None] | None:
        """Get token info without loading full Token object (async)."""
        try:
            db = await self.async_db
            doc_ref = db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = await doc_ref.get()

            if not doc.exists:
                return None

            return cast("dict[str, str | int | None]", doc.to_dict())
        except Exception:
            return None


# Legacy function for backwards compatibility
def get_storage() -> FirestoreTokenRepository:
    """Get token storage instance (legacy compat)."""
    return FirestoreTokenRepository()


def store_token(token: str, phone: str | None = None, refresh_token: str | None = None) -> bool:
    """Store a token string (legacy compat).

    Args:
        token: JWT token string
        phone: Phone number used for login
        refresh_token: Refresh token for programmatic refresh

    Returns:
        True if stored successfully

    """
    repo = FirestoreTokenRepository()
    token_obj = Token.create_new(token, phone, refresh_token=refresh_token)
    return repo.store(token_obj)


async def store_token_async(
    token: str, phone: str | None = None, refresh_token: str | None = None
) -> bool:
    """Store a token string (legacy compat - async)."""
    repo = FirestoreTokenRepository()
    token_obj = Token.create_new(token, phone, refresh_token=refresh_token)
    return await repo.store_async(token_obj)
