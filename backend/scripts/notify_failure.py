#!/usr/bin/env python3
"""Workflow Failure Alert Dispatcher.

Executes as a fail-safe step in GitHub Actions when any step fails.
Dispatches high-priority push notifications to both Telegram and Resend Email.
Loads secrets safely from environment variables and Firestore.
"""

import argparse
import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, ".")

from google.cloud import firestore
from google.oauth2 import service_account

from backend.infrastructure.core.resend_notification_service import ResendNotificationService

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client safely."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        try:
            sa_info = json.loads(sa_json)
            credentials = service_account.Credentials.from_service_account_info(sa_info)
            return firestore.Client(credentials=credentials, project=sa_info.get("project_id"))
        except Exception as e:
            logger.warning(f"Could not load service account: {e}")
    return firestore.Client()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Send workflow failure alert")
    parser.add_argument("--workflow", required=True, help="Name of the failed workflow")
    parser.add_argument("--run-id", required=True, help="GitHub Action Run ID")
    parser.add_argument("--repo", required=True, help="GitHub Repository (owner/repo)")
    args = parser.parse_args()

    run_url = f"https://github.com/{args.repo}/actions/runs/{args.run_id}"

    try:
        db = get_firestore_client()
        notifier = ResendNotificationService(db=db)
    except Exception as exc:
        logger.error(f"Failed to initialize ResendNotificationService: {exc}")
        return

    subject = f"🚨 [CineRadar CRITICAL] {args.workflow} Failed!"
    body = (
        f"🚨 *[CineRadar CRITICAL] GitHub Action Failed!*\n\n"
        f"⚙️ *Workflow:* {args.workflow}\n"
        f"🔗 *Run URL:* {run_url}\n\n"
        f"A failure occurred during workflow execution. Immediate investigation required."
    )

    metadata = {
        "Workflow": args.workflow,
        "Run ID": args.run_id,
        "Run URL": run_url,
        "Status": "GITHUB_WORKFLOW_FAILURE",
    }

    logger.info(f"Dispatching dual failure notification for {args.workflow}...")
    await notifier.send_alert(subject=subject, body=body, metadata=metadata)
    logger.info("✅ Dual failure alert dispatched successfully.")


if __name__ == "__main__":
    asyncio.run(main())
