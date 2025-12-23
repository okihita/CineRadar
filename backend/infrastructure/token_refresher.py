"""
Token Refresher Utility

Provides a unified interface for token refresh with automatic fallback:
1. Try API refresh (fast, uses refresh_token)
2. If fails, trigger GHA Full Login workflow
3. If that fails, alert user

Usage:
    from backend.infrastructure.token_refresher import TokenRefresher

    refresher = TokenRefresher()
    token = await refresher.ensure_valid_token()
"""

import logging
import os
import time

import requests

from backend.domain.models import Token
from backend.infrastructure.repositories.firestore_token import (
    FirestoreTokenRepository,
    store_token,
)

logger = logging.getLogger(__name__)


class TokenRefreshError(Exception):
    """Raised when all token refresh methods fail."""
    pass


class TokenRefresher:
    """Manages token refresh with API-first approach and GHA fallback."""

    REFRESH_API_URL = "https://api-b2b.tix.id/v1/users/refresh"
    MIN_TTL_MINUTES = 5  # Minimum TTL before refresh is needed
    GHA_POLL_INTERVAL = 10  # Seconds between workflow status checks
    GHA_TIMEOUT = 300  # Max seconds to wait for GHA workflow

    def __init__(self, github_token: str | None = None):
        """
        Initialize the refresher.

        Args:
            github_token: GitHub PAT for triggering workflows.
                         Falls back to GITHUB_TOKEN env var.
        """
        self.repo = FirestoreTokenRepository()
        self.github_token = github_token or os.environ.get("GITHUB_TOKEN")
        self.github_repo = os.environ.get("GITHUB_REPOSITORY", "okihita/CineRadar")

    def get_current_token(self) -> Token | None:
        """Get current token from storage."""
        return self.repo.get_current()

    def needs_refresh(self, token: Token | None = None) -> bool:
        """Check if token needs refreshing."""
        if token is None:
            token = self.get_current_token()
        if not token:
            return True
        return token.minutes_until_expiry < self.MIN_TTL_MINUTES

    def try_api_refresh(self, refresh_token: str) -> str | None:
        """
        Attempt to refresh access token via API.

        Args:
            refresh_token: The 91-day refresh token

        Returns:
            New access token string, or None if failed
        """
        logger.info("🔄 Attempting API token refresh...")

        try:
            response = requests.post(
                self.REFRESH_API_URL,
                headers={
                    "Authorization": f"Bearer {refresh_token}",
                    "Content-Type": "application/json",
                    "platform": "web",
                },
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                new_token = data.get("data", {}).get("token")
                if new_token:
                    logger.info("✅ API refresh successful!")
                    return new_token
                else:
                    logger.error("❌ API refresh response missing token")
            elif response.status_code == 401:
                logger.warning("⚠️ Refresh token expired or invalid (401)")
            else:
                logger.error(f"❌ API refresh failed: {response.status_code}")

        except requests.RequestException as e:
            logger.error(f"❌ API refresh request failed: {e}")

        return None

    def trigger_gha_workflow(self) -> str | None:
        """
        Trigger the token-refresh GHA workflow.

        Returns:
            Run ID if triggered successfully, None otherwise
        """
        if not self.github_token:
            logger.error("❌ No GITHUB_TOKEN available for workflow dispatch")
            return None

        logger.info("🚀 Triggering GHA Full Login workflow...")

        try:
            url = f"https://api.github.com/repos/{self.github_repo}/actions/workflows/token-refresh.yml/dispatches"
            response = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {self.github_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json={"ref": "main"},
                timeout=30,
            )

            if response.status_code == 204:
                logger.info("✅ GHA workflow triggered!")
                # Get the run ID by listing recent runs
                time.sleep(2)
                runs_url = f"https://api.github.com/repos/{self.github_repo}/actions/workflows/token-refresh.yml/runs"
                runs_response = requests.get(
                    runs_url,
                    headers={
                        "Authorization": f"Bearer {self.github_token}",
                        "Accept": "application/vnd.github+json",
                    },
                    params={"per_page": 1},
                    timeout=30,
                )
                if runs_response.status_code == 200:
                    runs = runs_response.json().get("workflow_runs", [])
                    if runs:
                        return str(runs[0]["id"])
                return "triggered"  # Fallback if we can't get run ID
            else:
                logger.error(f"❌ Failed to trigger workflow: {response.status_code} {response.text}")

        except requests.RequestException as e:
            logger.error(f"❌ Workflow trigger request failed: {e}")

        return None

    def wait_for_gha_completion(self, run_id: str) -> bool:
        """
        Wait for GHA workflow to complete.

        Returns:
            True if workflow succeeded, False otherwise
        """
        if run_id == "triggered":
            # Can't track without run ID, just wait a fixed time
            logger.info("⏳ Waiting 90s for workflow (no run ID)...")
            time.sleep(90)
            return True  # Assume success, will verify token anyway

        logger.info(f"⏳ Waiting for GHA workflow {run_id} to complete...")

        start_time = time.time()
        url = f"https://api.github.com/repos/{self.github_repo}/actions/runs/{run_id}"

        while time.time() - start_time < self.GHA_TIMEOUT:
            try:
                response = requests.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.github_token}",
                        "Accept": "application/vnd.github+json",
                    },
                    timeout=30,
                )

                if response.status_code == 200:
                    run = response.json()
                    status = run.get("status")
                    conclusion = run.get("conclusion")

                    if status == "completed":
                        if conclusion == "success":
                            logger.info("✅ GHA workflow completed successfully!")
                            return True
                        else:
                            logger.error(f"❌ GHA workflow failed: {conclusion}")
                            return False
                    else:
                        logger.debug(f"   Workflow status: {status}")

            except requests.RequestException as e:
                logger.warning(f"⚠️ Error checking workflow status: {e}")

            time.sleep(self.GHA_POLL_INTERVAL)

        logger.error("❌ GHA workflow timed out")
        return False

    async def ensure_valid_token(self) -> Token:
        """
        Ensure a valid token is available, refreshing if needed.

        Returns:
            Valid Token object

        Raises:
            TokenRefreshError: If all refresh methods fail
        """
        # Check current token
        token = self.get_current_token()

        if token and not self.needs_refresh(token):
            logger.info(f"✅ Token valid ({token.minutes_until_expiry} min remaining)")
            return token

        # Try API refresh first
        if token and token.refresh_token:
            new_access_token = self.try_api_refresh(token.refresh_token)
            if new_access_token:
                # Store new token, preserve refresh token
                store_token(new_access_token, token.phone, refresh_token=token.refresh_token)
                return self.get_current_token()

        # Fallback to GHA Full Login
        logger.warning("⚠️ API refresh failed, falling back to GHA Full Login...")
        run_id = self.trigger_gha_workflow()

        if run_id:
            if self.wait_for_gha_completion(run_id):
                # Reload token from storage
                new_token = self.get_current_token()
                if new_token and not self.needs_refresh(new_token):
                    return new_token

        # All methods failed
        raise TokenRefreshError(
            "All token refresh methods failed! "
            "The TIX.id login flow may have changed. Please check manually."
        )


# Convenience function for simple usage
async def ensure_valid_token() -> Token:
    """Convenience function to get a valid token."""
    refresher = TokenRefresher()
    return await refresher.ensure_valid_token()
