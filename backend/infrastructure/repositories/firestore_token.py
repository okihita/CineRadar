"""
Firestore Token Repository

Implements ITokenRepository using Firebase Firestore.
"""

import json
import os
import tempfile

from backend.application.ports.storage import ITokenRepository
from backend.domain.errors import FirestoreError
from backend.domain.models import Token


def _get_firestore_client():
    """Get Firestore client with proper credentials.

    Supports:
    - FIREBASE_SERVICE_ACCOUNT env var (JSON string) for CI/CD
    - GOOGLE_APPLICATION_CREDENTIALS file path
    - Default application credentials (local dev)
    """
    from google.cloud import firestore

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if service_account_json:
        creds_data = json.loads(service_account_json)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(creds_data, f)
            temp_path = f.name
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
        return firestore.Client(project=creds_data.get("project_id", "cineradar-481014"))

    return firestore.Client(project=os.environ.get("FIREBASE_PROJECT_ID", "cineradar-481014"))


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

    def __init__(self):
        """Initialize repository."""
        self._db = None

    @property
    def db(self):
        """Lazy-load Firestore client."""
        if self._db is None:
            self._db = _get_firestore_client()
        return self._db

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
            print(f"⚠️ Error getting token: {e}")
            return None

    def is_valid(self) -> bool:
        """Check if stored token is still valid.

        Returns:
            True if token exists and not expired
        """
        token = self.get_current()
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
            print(f"⚠️ Error deleting token: {e}")
            return False

    def get_token_info(self) -> dict | None:
        """Get token info without loading full Token object.

        Returns:
            Dict with token metadata or None
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            return doc.to_dict()
        except Exception:
            return None


# Legacy function for backwards compatibility
def get_storage() -> FirestoreTokenRepository:
    """Get token storage instance (legacy compat)."""
    return FirestoreTokenRepository()


def store_token(token: str, phone: str = None, refresh_token: str = None) -> bool:
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
