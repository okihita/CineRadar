"""
CineRadar Token Storage
Manages JWT token storage and retrieval for TIX.id API authentication.
Uses Firestore for persistence across GitHub Actions runs.
"""
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict

try:
    from google.cloud import firestore
    from google.oauth2 import service_account
    HAS_FIRESTORE = True
except ImportError:
    HAS_FIRESTORE = False


class TokenStorage:
    """Store and retrieve JWT tokens from Firestore."""
    
    COLLECTION = 'auth_tokens'
    DOC_ID = 'tix_jwt'
    TOKEN_TTL_HOURS = 20  # Refresh before 24h expiry
    
    def __init__(self):
        self.db = self._init_firestore()
    
    def _init_firestore(self):
        """Initialize Firestore client from environment."""
        if not HAS_FIRESTORE:
            return None
            
        # Try service account from env
        sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
        if sa_json:
            try:
                sa_info = json.loads(sa_json)
                credentials = service_account.Credentials.from_service_account_info(sa_info)
                return firestore.Client(credentials=credentials, project=sa_info.get('project_id'))
            except Exception as e:
                print(f"⚠️ Failed to init Firestore: {e}")
                return None
        
        # Try default credentials (local development)
        try:
            return firestore.Client()
        except Exception:
            return None
    
    def store_token(self, token: str, phone: str = None) -> bool:
        """
        Store JWT token in Firestore.
        
        Args:
            token: JWT token string
            phone: Optional phone number used for login
            
        Returns:
            True if stored successfully
        """
        if not self.db:
            print("⚠️ Firestore not available, token not stored")
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc_ref.set({
                'token': token,
                'phone': phone,
                'stored_at': datetime.utcnow().isoformat(),
                'expires_at': (datetime.utcnow() + timedelta(hours=self.TOKEN_TTL_HOURS)).isoformat()
            })
            print(f"✅ Token stored in Firestore (expires in {self.TOKEN_TTL_HOURS}h)")
            return True
        except Exception as e:
            print(f"⚠️ Failed to store token: {e}")
            return False
    
    def get_token(self) -> Optional[str]:
        """
        Retrieve valid JWT token from Firestore.
        
        Returns:
            Token string if valid, None if expired or not found
        """
        if not self.db:
            print("⚠️ Firestore not available")
            return None
        
        try:
            doc_ref = self.db.collection(self.COLLECTION).document(self.DOC_ID)
            doc = doc_ref.get()
            
            if not doc.exists:
                print("⚠️ No token found in storage")
                return None
            
            data = doc.to_dict()
            
            # Check expiry
            expires_at = datetime.fromisoformat(data.get('expires_at', '2000-01-01'))
            if datetime.utcnow() > expires_at:
                print("⚠️ Stored token has expired")
                return None
            
            token = data.get('token')
            stored_at = data.get('stored_at', 'unknown')
            print(f"✅ Retrieved token (stored at {stored_at})")
            return token
            
        except Exception as e:
            print(f"⚠️ Failed to get token: {e}")
            return None
    
    def get_token_info(self) -> Optional[Dict]:
        """Get token metadata without the actual token value."""
        if not self.db:
            return None
        
        try:
            doc = self.db.collection(self.COLLECTION).document(self.DOC_ID).get()
            if doc.exists:
                data = doc.to_dict()
                return {
                    'stored_at': data.get('stored_at'),
                    'expires_at': data.get('expires_at'),
                    'phone': data.get('phone', '')[:4] + '***' if data.get('phone') else None
                }
            return None
        except Exception:
            return None
    
    def is_token_valid(self) -> bool:
        """Check if stored token is still valid."""
        return self.get_token() is not None


# Singleton for easy access
_storage = None

def get_storage() -> TokenStorage:
    """Get singleton TokenStorage instance."""
    global _storage
    if _storage is None:
        _storage = TokenStorage()
    return _storage


def store_token(token: str, phone: str = None) -> bool:
    """Convenience function to store token."""
    return get_storage().store_token(token, phone)


def get_token() -> Optional[str]:
    """Convenience function to get token."""
    return get_storage().get_token()
