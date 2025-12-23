"""
Refresh Token Use Case

Handles TIX.id authentication and token storage.
"""

from dataclasses import dataclass

from backend.application.ports.scraper import IMovieScraper
from backend.application.ports.storage import ITokenRepository
from backend.domain.errors import LoginFailedError
from backend.domain.models import Token


@dataclass
class RefreshTokenResult:
    """Result of token refresh."""

    token: Token | None
    success: bool
    error: str | None = None

    @property
    def minutes_valid(self) -> int:
        if self.token:
            return self.token.minutes_until_expiry
        return 0


class RefreshTokenUseCase:
    """Use case: Refresh TIX.id JWT token.

    Logs into TIX.id and stores the new token.

    Example:
        scraper = TixMovieScraper()
        token_repo = FirestoreTokenRepository()

        use_case = RefreshTokenUseCase(scraper, token_repo)
        result = await use_case.execute()

        if result.success:
            print(f"Token valid for {result.minutes_valid} minutes")
    """

    def __init__(
        self,
        scraper: IMovieScraper,
        token_repo: ITokenRepository,
    ):
        self.scraper = scraper
        self.token_repo = token_repo

    async def execute(self, phone: str = None) -> RefreshTokenResult:
        """Execute token refresh.

        Args:
            phone: Phone number for login (uses env var if not provided)

        Returns:
            RefreshTokenResult with new token if successful
        """
        try:
            # Step 1: Login to TIX.id
            success = await self.scraper.login()

            if not success:
                return RefreshTokenResult(
                    token=None, success=False, error="Login failed - could not capture token"
                )

            # Step 2: Create token domain object
            # Note: The scraper implementation should set auth_token after login
            token_string = getattr(self.scraper, "auth_token", None)

            if not token_string:
                return RefreshTokenResult(
                    token=None, success=False, error="Login succeeded but no token captured"
                )

            token = Token.create_new(token_string, phone)

            # Step 3: Store token
            if not self.token_repo.store(token):
                return RefreshTokenResult(
                    token=token, success=False, error="Token captured but storage failed"
                )

            return RefreshTokenResult(
                token=token,
                success=True,
            )

        except LoginFailedError as e:
            return RefreshTokenResult(token=None, success=False, error=f"Login failed: {e}")
        except Exception as e:
            return RefreshTokenResult(token=None, success=False, error=f"Unexpected error: {e}")

    def check_current_token(self) -> RefreshTokenResult:
        """Check status of current stored token.

        Returns:
            RefreshTokenResult with current token info
        """
        token = self.token_repo.get_current()

        if not token:
            return RefreshTokenResult(token=None, success=False, error="No token stored")

        if token.is_expired:
            return RefreshTokenResult(
                token=token,
                success=False,
                error=f"Token expired {abs(token.minutes_until_expiry)} minutes ago",
            )

        return RefreshTokenResult(
            token=token,
            success=True,
        )
