#!/usr/bin/env python3
"""
CineRadar Scraper Log Analyzer
Fetches and analyzes scraper logs from Firestore for a specific date.

Usage:
    python -m backend.cli.analyze_logs              # Analyze today's logs
    python -m backend.cli.analyze_logs --date 2026-02-18  # Analyze specific date
    python -m backend.cli.analyze_logs --errors     # Focus on error analysis
"""

import argparse
import logging
import sys
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from backend.infrastructure.repositories.firestore_utils import get_firestore_client

logger = logging.getLogger(__name__)


def fetch_scraper_logs(db: Any, date_str: str) -> dict[str, Any] | None:
    """Fetch the daily scraper log document."""
    doc_ref = db.collection("scraper_logs").document(date_str)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None


def fetch_dispatches(db: Any, date_str: str) -> list[dict[str, Any]]:
    """Fetch all dispatch entries for a date."""
    dispatches = []
    dispatch_refs = db.collection("scraper_logs").document(date_str).collection("dispatches").stream()
    for doc in dispatch_refs:
        data = doc.to_dict()
        data["slot"] = doc.id
        dispatches.append(data)
    return sorted(dispatches, key=lambda x: x.get("slot", ""))


def fetch_errors_for_dispatch(db: Any, date_str: str, dispatch_slot: str) -> list[dict[str, Any]]:
    """Fetch all errors for a specific dispatch."""
    errors = []
    error_refs = (
        db.collection("scraper_logs")
        .document(date_str)
        .collection("dispatches")
        .document(dispatch_slot)
        .collection("errors")
        .stream()
    )
    for doc in error_refs:
        data = doc.to_dict()
        data["id"] = doc.id
        errors.append(data)
    return errors


def fetch_jobs_for_dispatch(db: Any, date_str: str, dispatch_slot: str) -> list[dict[str, Any]]:
    """Fetch all jobs for a specific dispatch."""
    jobs = []
    job_refs = (
        db.collection("scraper_logs")
        .document(date_str)
        .collection("dispatches")
        .document(dispatch_slot)
        .collection("jobs")
        .stream()
    )
    for doc in job_refs:
        data = doc.to_dict()
        data["id"] = doc.id
        jobs.append(data)
    return jobs


def analyze_logs(date_str: str, focus_errors: bool = False, verbose: bool = False) -> None:
    """Main analysis function."""
    logger.info(f"📊 Analyzing scraper logs for {date_str}")
    logger.info("=" * 60)
    
    db = get_firestore_client()
    
    # 1. Fetch daily log
    daily_log = fetch_scraper_logs(db, date_str)
    
    if not daily_log:
        logger.error(f"❌ No scraper logs found for {date_str}")
        logger.info("\n💡 Tip: The scraper_logs collection may not have data for this date.")
        logger.info("   Try checking Firestore directly or the Admin Dashboard.")
        return
    
    # 2. Morning Scrape Summary
    logger.info("\n🌅 MORNING SCRAPE")
    logger.info("-" * 40)
    morning_run = daily_log.get("morning_run", {})
    if morning_run:
        status = morning_run.get("status", "unknown")
        status_emoji = {"success": "✅", "partial": "⚠️", "failed": "❌", "running": "🔄"}.get(status, "❓")
        logger.info(f"   Status: {status_emoji} {status}")
        logger.info(f"   Movies found: {morning_run.get('movies_found', 0)}")
        logger.info(f"   Theatres: {morning_run.get('theatres_total', 0)}")
        logger.info(f"   Cities: {morning_run.get('cities_covered', 0)}")
        if morning_run.get("duration_seconds"):
            duration = morning_run["duration_seconds"]
            logger.info(f"   Duration: {duration // 60}m {duration % 60}s")
        if morning_run.get("error"):
            logger.error(f"   Error: {morning_run['error']}")
    else:
        logger.info("   No morning scrape data found")
    
    # 3. Fetch and analyze dispatches
    dispatches = fetch_dispatches(db, date_str)
    
    if not dispatches:
        logger.info("\n📭 No JIT dispatches found for this date")
        return
    
    logger.info(f"\n🚀 JIT DISPATCHES ({len(dispatches)} total)")
    logger.info("-" * 40)
    
    # Summary stats
    total_showtimes = sum(d.get("showtimes_found", 0) for d in dispatches)
    total_jobs = sum(d.get("jobs_published", 0) for d in dispatches)
    total_successes = sum(d.get("total_successes", 0) for d in dispatches)
    total_errors = sum(d.get("total_errors", 0) for d in dispatches)
    error_dispatches = [d for d in dispatches if d.get("status") == "error"]
    
    logger.info(f"   First dispatch: {dispatches[0].get('slot', 'N/A')}")
    logger.info(f"   Last dispatch: {dispatches[-1].get('slot', 'N/A')}")
    logger.info(f"   Total showtimes found: {total_showtimes}")
    logger.info(f"   Total jobs published: {total_jobs}")
    logger.info(f"   Total successes: {total_successes}")
    logger.info(f"   Total errors: {total_errors}")
    
    if total_jobs > 0:
        success_rate = (total_successes / total_jobs) * 100
        logger.info(f"   Success rate: {success_rate:.1f}%")
    
    # 4. Dispatch timeline
    if verbose:
        logger.info("\n📋 DISPATCH TIMELINE")
        logger.info("-" * 40)
        for d in dispatches:
            slot = d.get("slot", "??:??")
            status = d.get("status", "ok")
            emoji = "✅" if status == "ok" else "❌"
            showtimes = d.get("showtimes_found", 0)
            jobs = d.get("jobs_published", 0)
            successes = d.get("total_successes", 0)
            errors = d.get("total_errors", 0)
            logger.info(f"   {slot}: {emoji} {showtimes} showtimes, {jobs} jobs ({successes}✅ {errors}❌)")
    
    # 5. Error analysis
    if focus_errors or total_errors > 0:
        logger.info("\n🔍 ERROR ANALYSIS")
        logger.info("-" * 40)
        
        if error_dispatches:
            logger.info(f"   Dispatches with errors: {len(error_dispatches)}")
            for d in error_dispatches:
                logger.error(f"   ❌ {d.get('slot')}: {d.get('error', 'Unknown error')}")
        
        # Fetch detailed errors from subcollections
        all_errors = []
        for d in dispatches:
            slot = d.get("slot")
            if d.get("total_errors", 0) > 0:
                errors = fetch_errors_for_dispatch(db, date_str, slot)
                for e in errors:
                    e["dispatch_slot"] = slot
                    all_errors.append(e)
        
        if all_errors:
            logger.info(f"   Total error records: {len(all_errors)}")
            
            # Group by severity
            by_severity = defaultdict(list)
            for e in all_errors:
                by_severity[e.get("severity", "unknown")].append(e)
            
            for severity, errors in sorted(by_severity.items()):
                logger.info(f"\n   {severity.upper()} ({len(errors)} errors):")
                for e in errors[:5]:  # Show first 5 of each severity
                    logger.error(f"      [{e.get('dispatch_slot')}] {e.get('message', 'No message')[:80]}")
                    if verbose and e.get("context"):
                        context = e["context"]
                        if isinstance(context, dict):
                            for key, val in context.items():
                                logger.info(f"         {key}: {str(val)[:60]}")
                if len(errors) > 5:
                    logger.info(f"      ... and {len(errors) - 5} more")
            
            # Group by HTTP status code if available
            by_status = defaultdict(list)
            for e in all_errors:
                context = e.get("context", {})
                if isinstance(context, dict):
                    status_code = context.get("status_code", "unknown")
                    by_status[status_code].append(e)
            
            if len(by_status) > 1 or "unknown" not in by_status:
                logger.info("\n   By HTTP Status Code:")
                for status, errors in sorted(by_status.items()):
                    logger.info(f"      {status}: {len(errors)} errors")
    
    # 6. Job status breakdown
    if verbose:
        logger.info("\n📝 SAMPLE JOB STATUSES (first dispatch)")
        if dispatches:
            first_dispatch = dispatches[0]
            slot = first_dispatch.get("slot")
            jobs = fetch_jobs_for_dispatch(db, date_str, slot)
            
            status_counts = defaultdict(int)
            for job in jobs:
                status_counts[job.get("status", "unknown")] += 1
            
            logger.info(f"   Dispatch {slot} jobs:")
            for status, count in sorted(status_counts.items()):
                logger.info(f"      {status}: {count}")
            
            # Show failed jobs
            failed_jobs = [j for j in jobs if j.get("status") == "failed"]
            if failed_jobs:
                logger.info(f"\n   Failed jobs ({len(failed_jobs)}):")
                for job in failed_jobs[:3]:
                    logger.error(f"      {job.get('id')}: {job.get('error', 'No error message')}")
    
    # 7. Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 SUMMARY")
    logger.info("-" * 40)
    
    morning_status = morning_run.get("status", "unknown") if morning_run else "none"
    morning_emoji = {"success": "✅", "partial": "⚠️", "failed": "❌"}.get(morning_status, "❓")
    
    jit_status = "✅ OK" if total_errors == 0 else f"⚠️ {total_errors} errors"
    
    logger.info(f"   Morning Scrape: {morning_emoji} {morning_status}")
    logger.info(f"   JIT Dispatches: {jit_status}")
    logger.info(f"   Coverage: {total_showtimes} showtimes, {total_successes} seats scraped")
    
    if total_errors > 0:
        logger.warning(f"\n⚠️ Action required: {total_errors} errors detected")
    else:
        logger.info("\n✅ All systems operational")


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Analyze CineRadar scraper logs from Firestore")
    parser.add_argument(
        "--date", "-d",
        default=None,
        help="Date to analyze (YYYY-MM-DD). Default: today in Jakarta timezone"
    )
    parser.add_argument(
        "--errors", "-e",
        action="store_true",
        help="Focus on error analysis"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed dispatch timeline and job statuses"
    )
    
    args = parser.parse_args()
    
    # Determine date
    if args.date:
        date_str = args.date
    else:
        # Default to today in Jakarta timezone
        from zoneinfo import ZoneInfo
        jakarta_tz = ZoneInfo("Asia/Jakarta")
        date_str = datetime.now(jakarta_tz).strftime("%Y-%m-%d")
    
    try:
        analyze_logs(date_str, focus_errors=args.errors, verbose=args.verbose)
    except Exception as e:
        logger.error(f"❌ Error analyzing logs: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s"
    )
    main()
