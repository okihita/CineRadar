"""JIT Seat Scraper - Scraper Function.

Pub/Sub-triggered Cloud Function that:
1. Receives showtime data from Pub/Sub message
2. Loads auth token from Firestore
3. Calls TIX.id API to get seat layout
4. Saves compressed snapshot to Firestore

Configure max_instances=5 to balance throughput and rate limiting.

⚠️ SELF-CONTAINED FUNCTION CONSTRAINT ⚠️
This function MUST be entirely self-contained. DO NOT:
- Import from `backend.*` (will break deployment - paths don't exist in container)
- Extract constants/helpers to shared modules (will break deployment)
- Attempt to "clean up" duplication with infrastructure code

Code duplication with backend/infrastructure/ is INTENTIONAL and required for:
- Deployment isolation (--source=. only uploads this directory)
- Cold start performance (minimal dependencies)
- Independent deployments (update one function without affecting others)

Duplicated code in this file:
- PROJECT_ID, JAKARTA_TZ constants → also in dispatcher/main.py, sweeper/main.py
- MERCHANT_PATHS dict → also in infrastructure/core/seat_scraper.py
- get_firestore_client() → also in infrastructure/repositories/firestore_utils.py
- Token refresh logic → also in infrastructure/token_refresher.py

See: backend/functions/README.md#critical-self-contained-function-constraint
See: backend/docs/cloud-functions-architecture.md
"""

import base64
import contextlib
import gzip
import json
import logging
import os
from datetime import UTC, datetime
from typing import Any, cast
from zoneinfo import ZoneInfo

import functions_framework
import httpx
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
REFRESH_API_URL = "https://api-b2b.tix.id/v1/users/refresh"
ENABLE_SCHEMA_VALIDATION = os.environ.get("ENABLE_SCHEMA_VALIDATION", "true").lower() == "true"

# Merchant to API path mapping
MERCHANT_PATHS = {
    "CGV": "cgv",
    "XXI": "xxi",
    "Cinépolis": "cinepolis",
    "CINEPOLIS": "cinepolis",
}


def get_merchant_path(merchant: str) -> str:
    """Convert merchant name to API path."""
    return MERCHANT_PATHS.get(merchant, merchant.lower())


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def _parse_batch_id(batch_id: str) -> tuple[str, str]:
    """Parse batch_id (e.g. '20260213-162200') into (date_str, dispatch_slot).

    Returns:
        (date_str, dispatch_slot) e.g. ('2026-02-13', '16-22')
        Falls back to today's date and '_unbatched' if parsing fails.

    """
    if batch_id:
        try:
            dt = datetime.strptime(batch_id, "%Y%m%d-%H%M%S")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H-%M")
        except ValueError:
            pass
    # Fallback: use today's date
    now = datetime.now(JAKARTA_TZ)
    return now.strftime("%Y-%m-%d"), "_unbatched"


def _get_dispatch_ref(db: firestore.Client, date_str: str, dispatch_slot: str) -> Any:
    """Get Firestore reference to scraper_logs/{date}/dispatches/{dispatch_slot}."""
    return (
        db.collection("scraper_logs")
        .document(date_str)
        .collection("dispatches")
        .document(dispatch_slot)
    )


def log_error_to_firestore(severity: str, message: str, context: dict[str, Any]) -> None:
    """Log error to scraper_logs/{date}/dispatches/{HH-MM}/errors/{auto-id}.

    Also atomically increments total_errors on the dispatch summary doc.
    """
    try:
        db = get_firestore_client()
        now_iso = datetime.now(UTC).isoformat()

        batch_id = context.get("batch_id", "")
        date_str, dispatch_slot = _parse_batch_id(batch_id)

        dispatch_ref = _get_dispatch_ref(db, date_str, dispatch_slot)

        # Atomically increment total_errors on the dispatch summary doc
        dispatch_ref.set(
            {"total_errors": firestore.Increment(1)},
            merge=True,
        )

        # Write individual error to subcollection
        error_doc = {
            "timestamp": now_iso,
            "severity": severity,
            "message": message,
            "showtime_id": context.get("showtime_id", ""),
            "movie_title": context.get("movie_title", ""),
            "theatre": context.get("theatre", ""),
            "merchant": context.get("merchant", ""),
            "http_status": context.get("http_status", 0),
            "api_error": context.get("api_error", ""),
            "error_type": context.get("error_type", ""),
            "resolved": False,
        }
        dispatch_ref.collection("errors").add(error_doc)
    except Exception as e:
        # Fallback to stdout if Firestore logging fails
        logger.error(f"Failed to log error to Firestore: {e}")


def log_success_to_firestore(batch_id: str) -> None:
    """Atomically increment total_successes on scraper_logs/{date}/dispatches/{HH-MM}.

    Called after a successful scrape to track completion rate per dispatch batch.
    """
    try:
        db = get_firestore_client()
        date_str, dispatch_slot = _parse_batch_id(batch_id)
        dispatch_ref = _get_dispatch_ref(db, date_str, dispatch_slot)

        dispatch_ref.set(
            {"total_successes": firestore.Increment(1)},
            merge=True,
        )
    except Exception as e:
        logger.warning(f"Failed to log success to Firestore: {e}")


# ============================================================================
# Job Lifecycle Logger - Tracks job progress through checkpoints
# ============================================================================


class JobLogger:
    """Tracks job lifecycle checkpoints with timestamps.

    Logs each job's progress to:
    scraper_logs/{date}/dispatches/{dispatch_slot}/jobs/{showtime_id}

    Checkpoints:
    1. JOB_STARTED - Scraper picked up the job
    2. TOKEN_ACQUIRED - Auth token obtained
    3. API_CALLED - TIX API request started
    4. API_COMPLETED - TIX API response received
    5. SCHEMA_VALIDATED - Response schema validated
    6. OCCUPANCY_CALCULATED - Seat occupancy computed
    7. SNAPSHOT_SAVED - Data saved to Firestore
    8. JOB_COMPLETED - Final status (success/error)
    """

    def __init__(self, db: firestore.Client, batch_id: str, showtime_id: str):
        self.db = db
        self.batch_id = batch_id
        self.showtime_id = showtime_id
        self.date_str, self.dispatch_slot = self._parse_batch_id(batch_id)
        self.job_ref = self._get_job_ref()
        self.timestamps: dict[str, str] = {}
        self.checkpoints: dict[str, dict[str, Any]] = {}
        self._start_time: float | None = None

    def _parse_batch_id(self, batch_id: str) -> tuple[str, str]:
        """Parse batch_id into (date_str, dispatch_slot)."""
        if batch_id:
            try:
                dt = datetime.strptime(batch_id, "%Y%m%d-%H%M%S")
                return dt.strftime("%Y-%m-%d"), dt.strftime("%H-%M")
            except ValueError:
                pass
        now = datetime.now(JAKARTA_TZ)
        return now.strftime("%Y-%m-%d"), "_unbatched"

    def _get_job_ref(self) -> firestore.DocumentReference:
        """Get Firestore reference to job document."""
        return (
            self.db.collection("scraper_logs")
            .document(self.date_str)
            .collection("dispatches")
            .document(self.dispatch_slot)
            .collection("jobs")
            .document(self.showtime_id)
        )

    def _now(self) -> str:
        """Get current UTC timestamp as ISO string."""
        return datetime.now(UTC).isoformat()

    def _now_ms(self) -> float:
        """Get current time in milliseconds for timing calculations."""
        import time

        return time.time() * 1000

    def _update(self, data: dict[str, Any]) -> None:
        """Update job document with new data (fire-and-forget)."""
        try:
            data["updated_at"] = self._now()
            self.job_ref.set(data, merge=True)
        except Exception as e:
            logger.warning(f"JobLogger: Failed to update job doc: {e}")

    # -------------------------------------------------------------------------
    # Checkpoint Methods
    # -------------------------------------------------------------------------

    def log_started(self, job_data: dict[str, Any]) -> None:
        """Checkpoint 1: Job started processing."""
        self._start_time = self._now_ms()
        self.timestamps["started_at"] = self._now()
        self._update(
            {
                "showtime_id": self.showtime_id,
                "batch_id": self.batch_id,
                "job_data": {
                    "movie_id": job_data.get("movie_id"),
                    "movie_title": job_data.get("movie_title"),
                    "theatre_id": job_data.get("theatre_id"),
                    "theatre_name": job_data.get("theatre_name"),
                    "city": job_data.get("city"),
                    "merchant": job_data.get("merchant"),
                    "showtime": job_data.get("showtime"),
                },
                "lifecycle": self.timestamps,
                "status": "running",
                "created_at": self._now(),  # Document creation time
            }
        )

    def log_token_acquired(self, age_minutes: float, was_refreshed: bool) -> None:
        """Checkpoint 2: Token acquired."""
        self.timestamps["token_acquired_at"] = self._now()
        self.checkpoints["token"] = {
            "acquired": True,
            "age_minutes": round(age_minutes, 1),
            "was_refreshed": was_refreshed,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_token_failed(self, reason: str) -> None:
        """Checkpoint 2 (error): Token acquisition failed."""
        self.timestamps["token_failed_at"] = self._now()
        self.checkpoints["token"] = {
            "acquired": False,
            "reason": reason,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_api_started(self) -> None:
        """Checkpoint 3: API call started."""
        self.timestamps["api_called_at"] = self._now()
        self._update({"lifecycle": self.timestamps})

    def log_api_completed(self, http_status: int, retries: int, error_detail: str | None) -> None:
        """Checkpoint 4: API call completed."""
        self.timestamps["api_completed_at"] = self._now()
        self.checkpoints["api"] = {
            "http_status": http_status,
            "retries": retries,
            "error_detail": error_detail,
            "success": http_status == 200 and error_detail is None,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_schema_validated(
        self, is_valid: bool, severity: str | None, message: str | None
    ) -> None:
        """Checkpoint 5: Schema validation completed."""
        self.timestamps["schema_validated_at"] = self._now()
        self.checkpoints["schema"] = {
            "validated": True,
            "is_valid": is_valid,
            "severity": severity,
            "message": message,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_occupancy_calculated(
        self, total_seats: int, sold_seats: int, occupancy_pct: float
    ) -> None:
        """Checkpoint 6: Occupancy calculation completed."""
        self.timestamps["occupancy_calculated_at"] = self._now()
        self.checkpoints["occupancy"] = {
            "total_seats": total_seats,
            "sold_seats": sold_seats,
            "occupancy_pct": round(occupancy_pct, 1),
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_snapshot_saved(self, document_path: str) -> None:
        """Checkpoint 7: Snapshot saved to Firestore."""
        self.timestamps["snapshot_saved_at"] = self._now()
        self.checkpoints["snapshot"] = {
            "saved": True,
            "document_path": document_path,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_snapshot_failed(self, reason: str) -> None:
        """Checkpoint 7 (error): Snapshot save failed."""
        self.timestamps["snapshot_failed_at"] = self._now()
        self.checkpoints["snapshot"] = {
            "saved": False,
            "reason": reason,
        }
        self._update(
            {
                "lifecycle": self.timestamps,
                "checkpoints": self.checkpoints,
            }
        )

    def log_success(self) -> None:
        """Checkpoint 8: Job completed successfully."""
        self.timestamps["finished_at"] = self._now()
        timing = self._compute_timing()

        self._update(
            {
                "lifecycle": self.timestamps,
                "timing": timing,
                "status": "success",
                "error": None,
            }
        )

    def log_error(
        self, checkpoint: str, error_code: str, message: str, details: dict[str, Any] | None = None
    ) -> None:
        """Checkpoint 8 (error): Job failed with error."""
        self.timestamps["finished_at"] = self._now()
        timing = self._compute_timing()

        error_info: dict[str, Any] = {
            "checkpoint": checkpoint,
            "code": error_code,
            "message": message,
        }
        if details:
            error_info.update(details)

        self._update(
            {
                "lifecycle": self.timestamps,
                "timing": timing,
                "status": "error",
                "error": error_info,
            }
        )

    # -------------------------------------------------------------------------
    # Timing Calculations
    # -------------------------------------------------------------------------

    def _compute_timing(self) -> dict[str, int]:
        """Compute timing metrics from timestamps."""

        def parse_ts(ts: str | None) -> datetime | None:
            if not ts:
                return None
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                return None

        timing: dict[str, int] = {}

        # Queue time: started_at - created_at (from existing doc)
        if "started_at" in self.timestamps:
            try:
                doc = self.job_ref.get()
                if doc.exists:
                    doc_data = doc.to_dict() or {}
                    created_at = doc_data.get("lifecycle", {}).get("created_at")
                    started_at = parse_ts(self.timestamps.get("started_at"))
                    if created_at and started_at:
                        created_dt = parse_ts(created_at)
                        if created_dt:
                            timing["queue_time_ms"] = int(
                                (started_at - created_dt).total_seconds() * 1000
                            )
            except Exception:
                pass

        # Token acquire time
        if "token_acquired_at" in self.timestamps and "started_at" in self.timestamps:
            token_at = parse_ts(self.timestamps["token_acquired_at"])
            started_at = parse_ts(self.timestamps["started_at"])
            if token_at and started_at:
                timing["token_acquire_ms"] = int((token_at - started_at).total_seconds() * 1000)

        # API call time
        if "api_completed_at" in self.timestamps and "api_called_at" in self.timestamps:
            api_end = parse_ts(self.timestamps["api_completed_at"])
            api_start = parse_ts(self.timestamps["api_called_at"])
            if api_end and api_start:
                timing["api_call_ms"] = int((api_end - api_start).total_seconds() * 1000)

        # Processing time: finished_at - started_at
        if "finished_at" in self.timestamps and "started_at" in self.timestamps:
            finished_at = parse_ts(self.timestamps["finished_at"])
            started_at = parse_ts(self.timestamps["started_at"])
            if finished_at and started_at:
                timing["processing_ms"] = int((finished_at - started_at).total_seconds() * 1000)

        return timing


def log_critical(message: str, context: dict[str, Any]) -> None:
    """Log critical error with context for alerting."""
    logger.critical(f"🚨 CRITICAL: {message} | Context: {context}")
    log_error_to_firestore("CRITICAL", message, context)


def log_warning(message: str, context: dict[str, Any]) -> None:
    """Log warning with context for alerting."""
    logger.warning(f"⚠️ WARNING: {message} | Context: {context}")
    # Optional: We can choose to log specific warnings to Firestore too
    # For now, let's log them to keep track of schema drifts
    log_error_to_firestore("WARNING", message, context)


def log_info(message: str) -> None:
    """Log info message."""
    logger.info(f"i INFO: {message}")


def load_token_data(db: firestore.Client) -> dict[str, Any] | None:
    """Load TIX.id auth token data from Firestore.

    Returns dict with keys: token, refresh_token, stored_at
    Token strings are stripped of surrounding quotes.
    """
    try:
        doc = db.collection("auth_tokens").document("tix_jwt").get()
        if doc.exists:
            data = doc.to_dict()
            if not data:
                return None

            # Sanitize token strings (strip quotes)
            token = data.get("token", "").strip('"')
            refresh_token = data.get("refresh_token", "").strip('"')
            stored_at = data.get("stored_at", "")

            return {"token": token, "refresh_token": refresh_token, "stored_at": stored_at}
    except Exception as e:
        logger.error(f"Failed to load token data: {e}")
    return None


class TokenRefreshLock:
    """Distributed lock for token refresh using Firestore."""

    def __init__(self, db: firestore.Client):
        self.db = db
        self.lock_ref = db.collection("auth_tokens").document("refresh_lock")
        self.timeout = 75  # seconds (increased from 60 to safely cover the 60s max propagation wait plus network latency)

    def acquire(self, instance_id: str) -> bool:
        """Attempt to acquire the lock."""
        now = datetime.now(UTC).isoformat()
        try:
            # Try to create lock doc
            self.lock_ref.create({"locked_at": now, "instance_id": instance_id})
            return True
        except Exception:
            # Already exists, check if stale
            doc = self.lock_ref.get()
            if not doc.exists:
                return self.acquire(instance_id)  # Race condition handled

            data = doc.to_dict()
            locked_at_str = data.get("locked_at", "")
            try:
                locked_at = datetime.fromisoformat(locked_at_str)
                if locked_at.tzinfo is None:
                    locked_at = locked_at.replace(tzinfo=UTC)
                age = (datetime.now(UTC) - locked_at).total_seconds()
                if age > self.timeout:
                    logger.warning(f"Taking over stale lock (age={age:.1f}s)")
                    self.lock_ref.set(
                        {"locked_at": now, "instance_id": instance_id, "took_over": True}
                    )
                    return True
            except Exception:
                # Invalid timestamp, force take
                self.lock_ref.set({"locked_at": now, "instance_id": instance_id, "took_over": True})
                return True

            return False

    def release(self) -> None:
        """Release the lock."""
        with contextlib.suppress(Exception):
            self.lock_ref.delete()


def refresh_access_token(db: firestore.Client, refresh_token: str) -> str | None:
    """Refresh access token using the validation API with distributed locking."""
    import time
    import uuid

    instance_id = f"scraper-{uuid.uuid4().hex[:8]}"
    lock = TokenRefreshLock(db)

    # Try to acquire lock with retry
    # If another instance is refreshing, we wait for it to finish instead of failing
    max_retries = 20  # 20 * 2s = 40s wait (reduced to give instance more headroom)
    acquired = False
    for i in range(max_retries):
        # Check if another instance already refreshed the token while we were waiting
        token_data = load_token_data(db)
        if token_data and token_data.get("token") and token_data.get("stored_at"):
            try:
                stored_at = datetime.fromisoformat(token_data["stored_at"])
                if stored_at.tzinfo is None:
                    stored_at = stored_at.replace(tzinfo=UTC)
                age_seconds = (datetime.now(UTC) - stored_at).total_seconds()

                # If token was refreshed in the last 2 minutes, it's fresh! Use it immediately.
                if age_seconds < 120:
                    logger.info(
                        f"Token was refreshed by another instance while waiting (age: {age_seconds:.1f}s)"
                    )
                    return str(token_data["token"])
            except ValueError:
                pass

        if lock.acquire(instance_id):
            acquired = True
            break

        logger.info(f"Another instance is refreshing, waiting... ({i + 1}/{max_retries})")
        time.sleep(2.0)  # Wait 2s between checks

    if not acquired and lock.acquire(instance_id):
        # Try one last time just in case it was released right as we gave up
        acquired = True

    # If we still don't have the lock after retries, try one last check
    if not acquired:
        # Just return whatever is there, hoping it was refreshed
        token_data = load_token_data(db)
        if token_data and token_data.get("token"):
            logger.warning("Could not acquire lock, using existing token")
            return str(token_data["token"])
        return None

    logger.info("🔄 Acquired lock, attempting token refresh...")

    try:
        response = httpx.post(
            REFRESH_API_URL,
            headers={
                "Authorization": f"Bearer {refresh_token}",
                "Content-Type": "application/json",
                "platform": "web",
            },
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            new_token = data.get("data", {}).get("token")
            # Get the new refresh token from the response, fallback to the old one
            new_refresh = data.get("data", {}).get("refresh_token", refresh_token)

            if new_token:
                # Wait for token to propagate to TIX's Redis nodes.
                # Total max wait = 10s + 10s + 10s = 30s.
                retry_schedule = [2] * 5 + [2] * 5 + [2] * 5
                validated_at_attempt = -1

                for attempt, delay in enumerate(retry_schedule):
                    if test_token_valid(new_token):
                        validated_at_attempt = attempt
                        elapsed = sum(retry_schedule[:attempt])
                        logger.info(
                            f"✅ Token validated after {attempt} attempts ({elapsed}s elapsed)"
                        )
                        break

                    # Log every few attempts to reduce noise
                    if attempt % 5 == 0 or attempt >= 10:
                        logger.warning(
                            f"⏳ Token not propagated, waiting {delay}s (attempt {attempt + 1}/{len(retry_schedule)})"
                        )
                    time.sleep(delay)

                if validated_at_attempt < 0:
                    # All retries failed - keep old token
                    logger.error("❌ Token never propagated after 60s, keeping old token")
                    lock.release()
                    return None

                # Save validated token to Firestore
                now_iso = datetime.now(UTC).isoformat()
                elapsed_s = sum(retry_schedule[:validated_at_attempt])
                db.collection("auth_tokens").document("tix_jwt").set(
                    {
                        "token": new_token,
                        "refresh_token": new_refresh,
                        "stored_at": now_iso,
                        "updated_by": instance_id,
                        "validated": True,
                        "propagation_attempts": validated_at_attempt,
                        "propagation_elapsed_s": elapsed_s,
                    },
                    merge=True,
                )

                logger.info(f"✅ Token refreshed & validated (propagation: {elapsed_s}s)")
                return cast("str", new_token)
            else:
                logger.error("❌ Refresh response missing token")
        else:
            logger.error(f"❌ Refresh failed: {response.status_code} {response.text[:100]}")

    except httpx.RequestError as e:
        logger.error(f"❌ Refresh request exception: {e}")
    finally:
        lock.release()

    return None


def get_valid_token(db: firestore.Client, force_refresh: bool = False) -> str | None:
    """Get a valid token, refreshing if necessary."""
    token_data = load_token_data(db)
    if not token_data or not token_data.get("token"):
        return None

    current_token = token_data["token"]
    refresh_token = token_data.get("refresh_token")
    stored_at_str = token_data.get("stored_at")

    should_refresh = force_refresh

    if not should_refresh and stored_at_str:
        try:
            # Handle potentially naive or aware inputs
            stored_at = datetime.fromisoformat(stored_at_str)
            if stored_at.tzinfo is None:
                # Legacy data without timezone - assume it was stored as UTC
                # (Previously stored by CLI in Jakarta time, but we now store as UTC)
                # To handle old data correctly, we need to check if the timestamp
                # looks like Jakarta time (afternoon hours = morning UTC)
                # For safety, treat as UTC but log a warning
                logger.warning(f"Token stored_at has no timezone, assuming UTC: {stored_at_str}")
                stored_at = stored_at.replace(tzinfo=UTC)

            # Always use UTC for comparison
            age = datetime.now(UTC) - stored_at

            age_minutes = age.total_seconds() / 60

            # Dispatcher refreshes at 20 mins. We only force refresh at 25 mins (emergency).
            # Reduced from 28 to 25 to allow more buffer before expiration.
            if age_minutes >= 25:
                logger.info(
                    f"⚠️ Token is {age_minutes:.1f} min old. Refreshing (emergency fallback)..."
                )
                should_refresh = True
            else:
                logger.info(f"Token is {age_minutes:.1f} min old (valid).")

        except ValueError:
            logger.warning("Could not parse stored_at time, forcing refresh check if possible")
            should_refresh = True
    elif not stored_at_str:
        should_refresh = True

    if should_refresh and refresh_token:
        new_token = refresh_access_token(db, refresh_token)
        if new_token:
            return new_token
        # If refresh fails, fall back to current token (better than nothing)
        logger.warning("Refresh failed, using existing token as fallback")

    return cast("str", current_token)


def get_valid_token_with_metadata(
    db: firestore.Client, force_refresh: bool = False
) -> tuple[str | None, float, bool]:
    """Get a valid token with metadata for job logging.

    Returns:
        Tuple of (token, age_minutes, was_refreshed)
        - token: The auth token, or None if unavailable
        - age_minutes: Age of the token in minutes (0 if refreshed)
        - was_refreshed: True if token was just refreshed

    """
    token_data = load_token_data(db)
    if not token_data or not token_data.get("token"):
        return None, 0.0, False

    current_token = token_data["token"]
    refresh_token = token_data.get("refresh_token")
    stored_at_str = token_data.get("stored_at")

    age_minutes = 0.0
    should_refresh = force_refresh

    if stored_at_str:
        try:
            stored_at = datetime.fromisoformat(stored_at_str)
            if stored_at.tzinfo is None:
                stored_at = stored_at.replace(tzinfo=UTC)
            age = datetime.now(UTC) - stored_at
            age_minutes = age.total_seconds() / 60

            if age_minutes >= 25:
                should_refresh = True
        except ValueError:
            should_refresh = True
    else:
        should_refresh = True

    if should_refresh and refresh_token:
        new_token = refresh_access_token(db, refresh_token)
        if new_token:
            return new_token, 0.0, True  # Fresh token, age = 0
        # Refresh failed, use existing token
        logger.warning("Refresh failed, using existing token as fallback")

    return cast("str", current_token), age_minutes, False


def fetch_seat_layout(showtime_id: str, merchant: str, token: str) -> dict[str, Any] | None:
    """Fetch seat layout from TIX.id API.

    Args:
        showtime_id: TIX.id showtime identifier
        merchant: Cinema chain (CGV, XXI, Cinépolis)
        token: JWT auth token

    Returns:
        Seat layout dict or None if failed

    """
    merchant_path = get_merchant_path(merchant)
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    }

    params = {
        "show_time_id": showtime_id,
        "tz": "7",  # UTC+7 offset
    }

    try:
        response = httpx.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return cast("dict[str, Any]", data)
            else:
                logger.error(f"API error: {data.get('error', {}).get('message', 'Unknown')}")
                return None
        elif response.status_code == 401:
            logger.warning("Auth token expired (401)")
            return None  # Caller should handle retry
        else:
            body = response.text[:200] if response.text else "No body"
            logger.error(f"API error {response.status_code}: {body}")
            return None

    except httpx.RequestError as e:
        logger.error(f"Request failed: {e}")
        return None


def test_token_valid(token: str) -> bool:
    """Test if a token is valid by making a lightweight API call.

    Returns True if the token is accepted (any response except 401).
    This checks if the token's session has propagated to TIX's Redis nodes.
    """
    try:
        response = httpx.get(
            "https://api-b2b.tix.id/v1/movies/cgv/layout",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            },
            params={"show_time_id": "0", "tz": "7"},
            timeout=5,
        )
        # Any non-401 response means token is valid (session exists in Redis)
        return bool(response.status_code != 401)
    except Exception as e:
        logger.warning(f"Token test failed: {e}")
        return False


def fetch_seat_layout_with_retry(
    showtime_id: str, merchant: str, token: str, db: firestore.Client
) -> tuple[dict[str, Any] | None, int, str]:
    """Fetch seat layout with 401 retry logic. Returns (data, status_code, error_detail)."""
    import time

    # First attempt (using direct request to capture status)
    merchant_path = get_merchant_path(merchant)
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

    current_token = token
    last_status = 0
    last_error_detail = ""

    for attempt in range(2):
        headers = {
            "Authorization": f"Bearer {current_token}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        }
        params = {"show_time_id": showtime_id, "tz": "7"}

        try:
            response = httpx.get(url, headers=headers, params=params, timeout=10)
            last_status = response.status_code

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return cast("dict[str, Any]", data), 200, ""
                else:
                    error_obj = data.get("error", {})
                    error_code = error_obj.get("code", "UNKNOWN")
                    error_msg = error_obj.get("message", "Unknown")
                    last_error_detail = f"{error_code}: {error_msg}"
                    logger.error(f"API error: {last_error_detail}")
                    # API returned 200 but logical error
                    return None, 200, last_error_detail

            elif response.status_code == 401:
                last_error_detail = "Token expired (401)"
                if attempt == 0:
                    logger.warning("Token 401 expired. Refreshing and retrying...")
                    new_token = get_valid_token(db, force_refresh=True)
                    if new_token:
                        current_token = new_token
                        time.sleep(0.5)
                        continue  # Retry with new token
                    else:
                        logger.error("Failed to refresh token after 401.")
                        return None, 401, last_error_detail
                else:
                    logger.error("Still 401 after refresh.")
                    return None, 401, last_error_detail
            else:
                # Parse error body for details
                body = response.text[:500] if response.text else "No body"
                try:
                    error_json = response.json()
                    error_obj = error_json.get("error", {})
                    error_code = error_obj.get("code", "")
                    error_msg = error_obj.get("message", "")
                    last_error_detail = f"{error_code}: {error_msg}" if error_code else body[:200]
                except Exception:
                    last_error_detail = body[:200]
                logger.error(f"API error {response.status_code}: {last_error_detail}")
                return None, response.status_code, last_error_detail

        except httpx.RequestError as e:
            last_error_detail = str(e)
            logger.error(f"Request failed: {e}")
            if attempt == 0:
                time.sleep(1)
                continue
            return None, 0, last_error_detail

    return None, last_status, last_error_detail


def validate_api_response(raw_response: dict[str, Any]) -> tuple[bool, str, str]:
    """Validate raw API response structure and detect schema changes.

    Returns:
        (is_valid, severity, error_message)

    Severity levels:
    - CRITICAL: Schema change that will break all scrapes
    - WARNING: Potential issue but might recover
    - INFO: Minor anomaly

    """
    if not isinstance(raw_response, dict):
        return False, "CRITICAL", "API response is not a dict"

    if not raw_response.get("success"):
        error = raw_response.get("error", {}).get("message", "Unknown")
        return False, "CRITICAL", f"API success=false: {error}"

    data = raw_response.get("data", {})
    seat_map = data.get("seat_map")

    if not isinstance(seat_map, list):
        return False, "CRITICAL", "seat_map is not a list - schema changed!"

    if not seat_map:
        return False, "WARNING", "Empty seat_map returned by API"

    # Check seat types detection
    seat_types = set()
    for item in seat_map:
        if "seat_rows" in item:
            for seat in item.get("seat_rows", []):
                if "seat_type" in seat:
                    seat_types.add(seat["seat_type"])

    if seat_types:
        log_info(f"Detected seat types: {', '.join(sorted(seat_types))}")

    return True, "INFO", "Schema validation passed"


def calculate_occupancy(
    seat_map: list[dict[str, Any]],
) -> tuple[int, int, float, list[Any]]:
    """Calculate occupancy from seat map.

    Status codes:
    - 1: Available (can purchase)
    - 5, 6: Unavailable (sold or blocked)

    Returns:
        Tuple of (total_seats, sold_seats, occupancy_pct, layout_grid)

    """
    total_seats = 0
    sold_seats = 0
    layout_grid = []

    for item in seat_map:
        if "seat_rows" in item:
            # Nested structure (XXI/CGV)
            row_name = item.get("row_name", "")
            row_statuses = []
            for seat in item.get("seat_rows", []):
                status = seat.get("status", 0)
                if status == 1:  # Available
                    total_seats += 1
                    row_statuses.append(1)
                elif status in (5, 6):  # Sold/blocked
                    total_seats += 1
                    sold_seats += 1
                    row_statuses.append(0)
            if row_statuses:
                layout_grid.append([row_name, row_statuses])
        else:
            # Flat structure (Cinépolis/CGV B2B)
            row_name = item.get("row_name", "ALL")
            status = item.get("seat_status", item.get("status", 0))
            seat_yn = item.get("seat_yn", "1")

            if seat_yn == "0":  # Aisle, skip
                continue

            seat_status_val = -1
            if seat_yn == "1" and status == 0:  # Sold
                total_seats += 1
                sold_seats += 1
                seat_status_val = 0
            elif status == 1:  # Available
                total_seats += 1
                seat_status_val = 1
            elif status in (5, 6):  # Sold/blocked
                total_seats += 1
                sold_seats += 1
                seat_status_val = 0

            if seat_status_val != -1:
                # Add to layout grid
                # Check if we need to start a new row
                if not layout_grid or layout_grid[-1][0] != row_name:
                    layout_grid.append([row_name, []])
                layout_grid[-1][1].append(seat_status_val)

    occupancy_pct = (sold_seats / total_seats * 100) if total_seats > 0 else 0.0
    return total_seats, sold_seats, round(occupancy_pct, 1), layout_grid


def save_snapshot(
    db: firestore.Client,
    showtime_data: dict[str, Any],
    layout: list[dict[str, Any]],
    total_seats: int,
    sold_seats: int,
    occupancy_pct: float,
    raw_api_response: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """Save showtime snapshot to Firestore with compressed layout and raw API response.

    Path: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}

    Returns:
        Tuple of (success, document_path)

    """
    movie_id = showtime_data["movie_id"]
    metadata_id = showtime_data.get("metadata_id")  # V2: immutable movie entity ID
    date = showtime_data["date"]
    showtime_id = showtime_data["showtime_id"]

    document_path = f"movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}"

    # Compress layout
    layout_json_str = json.dumps(layout)
    layout_compressed = gzip.compress(layout_json_str.encode("utf-8"))

    # V1 document reference (existing - keep for backward compatibility)
    doc_ref = (
        db.collection("movie_performance")
        .document(movie_id)
        .collection("days")
        .document(date)
        .collection("showtimes")
        .document(showtime_id)
    )

    # V2 document reference (new - only if metadata_id available)
    doc_ref_v2 = None
    if metadata_id:
        doc_ref_v2 = (
            db.collection("movie_performance_v2")
            .document(metadata_id)
            .collection("days")
            .document(date)
            .collection("showtimes")
            .document(showtime_id)
        )

    # Calculate actual audience from morning baseline
    initial_unavailable = 0
    try:
        existing_doc = doc_ref.get()
        if existing_doc.exists:
            initial_unavailable = existing_doc.to_dict().get("initial_unavailable", 0)
    except Exception as e:
        logger.warning(f"Could not load initial_unavailable for {showtime_id}: {e}")

    # The True Metric:
    audience_count = max(0, sold_seats - initial_unavailable)
    audience_pct = (audience_count / total_seats * 100) if total_seats > 0 else 0.0

    snapshot_data = {
        "showtime_id": showtime_id,
        "movie_id": movie_id,
        "movie_title": showtime_data.get("movie_title", ""),
        "theatre_id": showtime_data.get("theatre_id", ""),
        "theatre_name": showtime_data.get("theatre_name", ""),
        "city": showtime_data.get("city", ""),
        "room_category": showtime_data.get("room_category", ""),
        "merchant": showtime_data.get("merchant", ""),
        "showtime": showtime_data.get("showtime", ""),
        "date": date,
        "total_seats": total_seats,
        "sold_seats": sold_seats,
        "occupancy_pct": occupancy_pct,
        "layout_compressed": layout_compressed,
        "raw_api_response": raw_api_response,
        "scraped_at": datetime.now(JAKARTA_TZ).isoformat(),
        "scrape_phase": showtime_data.get("scrape_phase", "T-30"),  # Track which phase captured this
        # New True Audience Metrics
        "initial_unavailable": initial_unavailable,
        "final_unavailable": sold_seats,
        "audience_count": audience_count,
        "audience_pct": round(audience_pct, 1),
    }

    try:
        # V1 write (existing - keep for backward compatibility)
        # Use merge=True to preserve initial_layout_compressed from morning scrape
        doc_ref.set(snapshot_data, merge=True)
        logger.info(f"Saved V1 snapshot for {showtime_id}")

        # V2 write (new - only if metadata_id available)
        if doc_ref_v2:
            v2_snapshot_data = {**snapshot_data, "schedule_id": movie_id}
            doc_ref_v2.set(v2_snapshot_data, merge=True)
            logger.info(f"Saved V2 snapshot for {showtime_id} (metadata_id={metadata_id})")

        return True, document_path
    except Exception as e:
        logger.error(f"Failed to save snapshot: {e}")
        return False, document_path


@functions_framework.cloud_event  # type: ignore[untyped-decorator]
def scrape_seat(cloud_event: Any) -> None:
    """Pub/Sub Cloud Function entry point.

    Triggered by messages on scrape-seat-jit topic.
    Scrapes one showtime and saves to Firestore.

    Job lifecycle checkpoints are logged via JobLogger:
    1. JOB_STARTED - Entry point
    2. TOKEN_ACQUIRED - After token load
    3. API_CALLED/COMPLETED - TIX API interaction
    4. SCHEMA_VALIDATED - Response validation
    5. OCCUPANCY_CALCULATED - Seat processing
    6. SNAPSHOT_SAVED - Firestore write
    7. JOB_COMPLETED - Success or error
    """
    # Decode Pub/Sub message
    message_data = base64.b64decode(cloud_event.data["message"]["data"])
    showtime_data = json.loads(message_data)

    showtime_id = showtime_data.get("showtime_id")
    theatre_name = showtime_data.get("theatre_name", "")[:30]
    showtime_time = showtime_data.get("showtime", "")
    batch_id = showtime_data.get("batch_id", "")
    movie_title = showtime_data.get("movie_title", "Unknown")[:50]
    merchant = showtime_data.get("merchant", "XXI")
    scrape_phase = showtime_data.get("scrape_phase", "T-30")

    logger.info(f"[{scrape_phase}] Scraping {theatre_name} @ {showtime_time}")

    db = get_firestore_client()

    # Initialize job logger for lifecycle tracking
    job_logger = JobLogger(db, batch_id, showtime_id) if batch_id else None

    # CHECKPOINT 1: Job started
    if job_logger:
        job_logger.log_started(showtime_data)

    # CHECKPOINT 1.5: If T-10, check if already closed by T-20 to avoid unnecessary API calls
    if scrape_phase == "T-10":
        try:
            metadata_id = showtime_data.get("metadata_id")
            date = showtime_data.get("date")
            if metadata_id and date:
                doc_ref_v2 = (
                    db.collection("movie_performance_v2")
                    .document(metadata_id)
                    .collection("days")
                    .document(date)
                    .collection("showtimes")
                    .document(showtime_id)
                )
                existing = doc_ref_v2.get(["is_closed"])
                if existing.exists and existing.to_dict().get("is_closed"):
                    logger.info(f"[{scrape_phase} SKIP] Showtime {showtime_id} was already marked closed by a previous phase. Skipping API call.")
                    if job_logger:
                        job_logger.log_success()
                    if batch_id:
                        log_success_to_firestore(batch_id)
                    return
        except Exception as e:
            logger.warning(f"Failed to check is_closed flag: {e}")

    # CHECKPOINT 2: Load token (with auto-refresh)
    token, token_age, was_refreshed = get_valid_token_with_metadata(db)
    if not token:
        if job_logger:
            job_logger.log_token_failed("No valid token available")
            job_logger.log_error("token_acquire", "NO_TOKEN", "No valid token available")
        log_critical(
            "No valid token available - authentication failure",
            {
                "batch_id": batch_id,
                "showtime_id": showtime_id,
                "movie_title": movie_title,
                "theatre": theatre_name,
                "time": showtime_time,
            },
        )
        return  # Pub/Sub will retry

    if job_logger:
        job_logger.log_token_acquired(token_age, was_refreshed)

    # CHECKPOINT 3: API call started
    if job_logger:
        job_logger.log_api_started()

    raw_api_response, status_code, error_detail = fetch_seat_layout_with_retry(
        showtime_id, merchant, token, db
    )

    # CHECKPOINT 4: API call completed
    if job_logger:
        # Track if there was a retry (401 triggers retry)
        retries = 1 if status_code == 401 else 0
        job_logger.log_api_completed(status_code, retries, error_detail)

    if not raw_api_response:
        # Graceful fallback for closed showtimes in later phases
        if scrape_phase in ("T-20", "T-15", "T-10") and status_code in (400, 404):
            logger.info(f"[{scrape_phase} SKIP] Showtime closed/passed (HTTP {status_code}). Preserving previous data for {showtime_id}.")

            # Mark as closed in Firestore to prevent future phases from attempting
            try:
                metadata_id = showtime_data.get("metadata_id")
                date = showtime_data.get("date")
                if metadata_id and date:
                    doc_ref_v2 = (
                        db.collection("movie_performance_v2")
                        .document(metadata_id)
                        .collection("days")
                        .document(date)
                        .collection("showtimes")
                        .document(showtime_id)
                    )
                    doc_ref_v2.set({"is_closed": True}, merge=True)
            except Exception as e:
                logger.warning(f"Failed to mark showtime as closed in Firestore: {e}")

            if job_logger:
                job_logger.log_success() # Treat as success so queue doesn't retry
            if batch_id:
                log_success_to_firestore(batch_id)
            return

        if job_logger:
            job_logger.log_error(
                "api_call",
                f"HTTP_{status_code}",
                f"Failed to fetch seat layout: {error_detail}",
                {"http_status": status_code, "api_error": error_detail},
            )
        log_critical(
            f"Failed to fetch seat layout (HTTP {status_code})",
            {
                "batch_id": batch_id,
                "showtime_id": showtime_id,
                "movie_title": movie_title,
                "theatre": theatre_name,
                "time": showtime_time,
                "merchant": merchant,
                "scrape_phase": scrape_phase,
                "error_type": "fetch_layout_failed",
                "http_status": status_code,
                "api_error": error_detail,
            },
        )
        return  # Pub/Sub will retry

    # CHECKPOINT 5: Schema validation
    if ENABLE_SCHEMA_VALIDATION:
        is_valid, severity, validation_msg = validate_api_response(raw_api_response)

        if job_logger:
            job_logger.log_schema_validated(
                is_valid,
                severity if not is_valid else None,
                validation_msg if not is_valid else None,
            )

        if not is_valid:
            if severity == "CRITICAL":
                log_critical(
                    f"Schema validation failed: {validation_msg}",
                    {
                        "batch_id": batch_id,
                        "showtime_id": showtime_id,
                        "movie_title": movie_title,
                        "theatre": theatre_name,
                        "severity": "CRITICAL",
                        "impact": "all_scrapes_affected",
                    },
                )
                # Store anyway for debugging
            else:
                log_warning(
                    f"Schema validation issue: {validation_msg}",
                    {
                        "batch_id": batch_id,
                        "showtime_id": showtime_id,
                        "movie_title": movie_title,
                        "theatre": theatre_name,
                        "severity": severity,
                    },
                )
        else:
            log_info(f"Schema validation passed for {showtime_id}")

    # Extract seat map from response
    data = raw_api_response.get("data", {})
    seat_map = data.get("seat_map", [])

    # CHECKPOINT 6: Occupancy calculation
    total_seats, sold_seats, occupancy_pct, layout = calculate_occupancy(seat_map)

    if job_logger:
        job_logger.log_occupancy_calculated(total_seats, sold_seats, occupancy_pct)

    # CHECKPOINT 7: Save snapshot
    success, doc_path = save_snapshot(
        db, showtime_data, layout, total_seats, sold_seats, occupancy_pct, raw_api_response
    )

    if job_logger:
        if success:
            job_logger.log_snapshot_saved(doc_path)
        else:
            job_logger.log_snapshot_failed("Failed to save to Firestore")
            job_logger.log_error(
                "snapshot_save", "SAVE_FAILED", "Failed to save snapshot to Firestore"
            )

    logger.info(
        f"✓ [{scrape_phase}] {theatre_name} @ {showtime_time}: {occupancy_pct}% ({sold_seats}/{total_seats})"
    )

    # CHECKPOINT 8: Job completed successfully
    if success:
        if job_logger:
            job_logger.log_success()

        # Log success to dispatch summary
        if batch_id:
            log_success_to_firestore(batch_id)
