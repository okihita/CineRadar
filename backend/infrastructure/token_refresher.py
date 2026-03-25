import asyncio
import contextlib
import logging
import os
import time
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, cast

import httpx

from backend.infrastructure.repositories.firestore_token import (
    FirestoreTokenRepository,
    store_token_async,
)

if TYPE_CHECKING:
    from backend.domain.models import Token

logger = logging.getLogger(__name__)


class TokenRefreshError(Exception):
    """Raised when all token refresh methods fail."""

    pass


class AsyncTokenRefreshLock:
    """Distributed async lock for token refresh using Firestore."""

    def __init__(self, db: Any):
        self.db = db
        self.lock_ref = db.collection("auth_tokens").document("refresh_lock")
        self.timeout = 75  # seconds

    async def acquire(self, instance_id: str) -> bool:
        """Attempt to acquire the lock (async)."""
        now = datetime.now(UTC).isoformat()
        try:
            # Try to create lock doc
            await self.lock_ref.create({"locked_at": now, "instance_id": instance_id})
            return True
        except Exception:
            # Already exists, check if stale
            doc = await self.lock_ref.get()
            if not doc.exists:
                return await self.acquire(instance_id)

            data = doc.to_dict() or {}
            locked_at_str = data.get("locked_at", "")
            try:
                locked_at = datetime.fromisoformat(locked_at_str)
                if locked_at.tzinfo is None:
                    locked_at = locked_at.replace(tzinfo=UTC)
                age = (datetime.now(UTC) - locked_at).total_seconds()
                if age > self.timeout:
                    logger.warning(f"Taking over stale lock (age={age:.1f}s)")
                    await self.lock_ref.set(
                        {"locked_at": now, "instance_id": instance_id, "took_over": True}
                    )
                    return True
            except Exception:
                # Invalid timestamp, force take
                await self.lock_ref.set(
                    {"locked_at": now, "instance_id": instance_id, "took_over": True}
                )
                return True

            return False

    async def release(self) -> None:
        """Release the lock (async)."""
        with contextlib.suppress(Exception):
            await self.lock_ref.delete()


class TokenRefresher:
    """Manages token refresh with API-first approach and GHA fallback."""

    REFRESH_API_URL = "https://api-b2b.tix.id/v1/users/refresh"
    MIN_TTL_MINUTES = 5  # Minimum TTL before refresh is needed
    GHA_POLL_INTERVAL = 10  # Seconds between workflow status checks
    GHA_TIMEOUT = 300  # Max seconds to wait for GHA workflow

    def __init__(self, github_token: str | None = None):
        """Initialize the refresher."""
        self.repo = FirestoreTokenRepository()
        self.github_token = github_token or os.environ.get("GITHUB_TOKEN")
        self.github_repo = os.environ.get("GITHUB_REPOSITORY", "okihita/CineRadar")

    async def get_current_token_async(self) -> Token | None:
        """Get current token from storage (async)."""
        return await self.repo.get_current_async()

    async def needs_refresh_async(self, token: Token | None = None) -> bool:
        """Check if token needs refreshing (async)."""
        if token is None:
            token = await self.get_current_token_async()
        if not token:
            return True
        return token.minutes_until_expiry < self.MIN_TTL_MINUTES

    async def try_api_refresh(self, refresh_token: str) -> tuple[str | None, str | None]:
        """Attempt to refresh access token via API."""
        logger.info("🔄 Attempting API token refresh...")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
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
                    new_refresh = data.get("data", {}).get("refresh_token", refresh_token)
                    if new_token:
                        logger.info("✅ API refresh successful!")
                        return cast("str", new_token), cast("str", new_refresh)
                    else:
                        logger.error("❌ API refresh response missing token")
                elif response.status_code == 401:
                    logger.warning("⚠️ Refresh token expired or invalid (401)")
                else:
                    logger.error(f"❌ API refresh failed: {response.status_code}")

        except httpx.RequestError as e:
            logger.error(f"❌ API refresh request failed: {e}")

        return None, None

    async def trigger_gha_workflow(self) -> str | None:
        """Trigger the token-refresh GHA workflow."""
        if not self.github_token:
            logger.error("❌ No GITHUB_TOKEN available for workflow dispatch")
            return None

        logger.info("🚀 Triggering GHA Full Login workflow...")

        try:
            url = f"https://api.github.com/repos/{self.github_repo}/actions/workflows/token-refresh.yml/dispatches"
            async with httpx.AsyncClient() as client:
                response = await client.post(
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
                    await asyncio.sleep(2)
                    runs_url = f"https://api.github.com/repos/{self.github_repo}/actions/workflows/token-refresh.yml/runs"
                    runs_response = await client.get(
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
                    return "triggered"
                else:
                    logger.error(
                        f"❌ Failed to trigger workflow: {response.status_code} {response.text}"
                    )

        except httpx.RequestError as e:
            logger.error(f"❌ Workflow trigger request failed: {e}")

        return None

    async def wait_for_gha_completion(self, run_id: str) -> bool:
        """Wait for GHA workflow to complete."""
        if run_id == "triggered":
            logger.info("⏳ Waiting 90s for workflow (no run ID)...")
            await asyncio.sleep(90)
            return True

        logger.info(f"⏳ Waiting for GHA workflow {run_id} to complete...")

        start_time = time.monotonic()
        url = f"https://api.github.com/repos/{self.github_repo}/actions/runs/{run_id}"

        async with httpx.AsyncClient() as client:
            while time.monotonic() - start_time < self.GHA_TIMEOUT:
                try:
                    response = await client.get(
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

                except httpx.RequestError as e:
                    logger.warning(f"⚠️ Error checking workflow status: {e}")

                await asyncio.sleep(self.GHA_POLL_INTERVAL)

        logger.error("❌ GHA workflow timed out")
        return False

    async def ensure_valid_token(self, force_refresh: bool = False) -> Token:
        """Ensure a valid token is available, refreshing if needed.

        Now uses distributed async locking to prevent thundering herd.
        """
        # Check current token
        token = await self.get_current_token_async()

        if token and not await self.needs_refresh_async(token) and not force_refresh:
            logger.info(f"✅ Token valid ({token.minutes_until_expiry} min remaining)")
            return token

        # Distributed Lock Logic
        db = await self.repo.async_db
        instance_id = f"worker-{uuid.uuid4().hex[:8]}"
        lock = AsyncTokenRefreshLock(db)

        max_retries = 20
        acquired = False
        for i in range(max_retries):
            # Check if someone else refreshed while we were waiting
            token = await self.get_current_token_async()
            if token and not await self.needs_refresh_async(token) and not force_refresh:
                logger.info("Token refreshed by another instance while waiting")
                return token

            if await lock.acquire(instance_id):
                acquired = True
                break

            logger.info(f"Another instance is refreshing, waiting... ({i + 1}/{max_retries})")
            await asyncio.sleep(2.0)

        if not acquired:
            # Fallback: just return what's in Firestore
            token = await self.get_current_token_async()
            if token:
                logger.warning("Could not acquire lock, using existing token")
                return token
            raise TokenRefreshError("Could not acquire refresh lock and no token found")

        try:
            # Re-check inside lock
            token = await self.get_current_token_async()
            if token and not await self.needs_refresh_async(token) and not force_refresh:
                return token

            # Try API refresh first
            if token and token.refresh_token:
                new_access_token, new_refresh_token = await self.try_api_refresh(token.refresh_token)
                if new_access_token:
                    await store_token_async(
                        new_access_token,
                        token.phone,
                        refresh_token=new_refresh_token or token.refresh_token,
                    )
                    refreshed_token = await self.get_current_token_async()
                    if refreshed_token:
                        return refreshed_token

            # Fallback to GHA Full Login
            logger.warning("⚠️ API refresh failed, falling back to GHA Full Login...")
            run_id = await self.trigger_gha_workflow()

            if run_id and await self.wait_for_gha_completion(run_id):
                new_token = await self.get_current_token_async()
                if new_token and not await self.needs_refresh_async(new_token):
                    return new_token

            raise TokenRefreshError("All token refresh methods failed")
        finally:
            await lock.release()


# Convenience function for simple usage
async def ensure_valid_token(force_refresh: bool = False) -> Token:
    """Convenience function to get a valid token."""
    refresher = TokenRefresher()
    return await refresher.ensure_valid_token(force_refresh=force_refresh)
