import os
import time
from google.cloud import firestore
from datetime import datetime, timedelta

# Configuration
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")

def check_status():
    print(f"🔍 Connecting to Firestore (Project: {PROJECT_ID})...")
    try:
        db = firestore.Client(project=PROJECT_ID)
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        print("💡 Try running: gcloud auth application-default login")
        return

    # 1. Check Errors
    print("\n🚨 Checking 'scraper_errors' collection...")
    try:
        # Get errors from the last 24 hours (roughly) to be safe
        # In a real scenario we might filter by timestamp, but specific format is needed
        # For now, fetch all and filter in python for simplicity of script
        errors_ref = db.collection("scraper_errors")
        errors = list(errors_ref.stream())
        
        error_count = len(errors)
        print(f"   found {error_count} error documents")

        if error_count > 0:
            by_severity = {}
            by_type = {}
            recent = []
            
            for doc in errors:
                d = doc.to_dict()
                severity = d.get("severity", "UNKNOWN")
                msg = d.get("message", "No message")
                ts = d.get("timestamp", "")
                ctx = d.get("context", {})
                err_type = ctx.get("error_type", "unknown") if isinstance(ctx, dict) else "unknown"

                by_severity[severity] = by_severity.get(severity, 0) + 1
                by_type[err_type] = by_type.get(err_type, 0) + 1
                recent.append((ts, severity, msg, err_type))

            # Breakdown
            print("\n   [Severity Breakdown]")
            for k, v in by_severity.items():
                print(f"   - {k}: {v}")
            
            print("\n   [Error Type Breakdown]")
            for k, v in by_type.items():
                print(f"   - {k}: {v}")

            # Recent
            recent.sort(key=lambda x: x[0], reverse=True)
            print("\n   [Most Recent 5 Errors]")
            for ts, sev, msg, etype in recent[:5]:
                print(f"   - {ts} | {sev} | {etype} | {msg}")

    except Exception as e:
        print(f"   ❌ Error querying errors: {e}")

    # 2. Check Success Stats
    print("\n✅ Checking 'jit_stats' collection...")
    try:
        stats_ref = db.collection("jit_stats")
        # Limit to recent 1000 to avoid huge read costs if it ran a lot
        stats = list(stats_ref.limit(1000).stream())
        success_count = len(stats)
        
        print(f"   Found {success_count} recent stats documents (limit 1000)")
        
        if success_count > 0:
            durations = []
            for doc in stats:
                d = doc.to_dict()
                if "duration_ms" in d:
                    durations.append(d["duration_ms"])
            
            if durations:
                avg_dur = sum(durations) / len(durations)
                max_dur = max(durations)
                min_dur = min(durations)
                print(f"   - Average Duration: {avg_dur:.2f} ms")
                print(f"   - Min Duration: {min_dur} ms")
                print(f"   - Max Duration: {max_dur} ms")

            # Calculate Error Rate roughly
            total_ops = success_count + error_count
            if total_ops > 0:
                error_rate = (error_count / total_ops) * 100
                print(f"\n📊 Approximate Error Rate: {error_rate:.2f}%")
            
    except Exception as e:
        print(f"   ❌ Error querying stats: {e}")

if __name__ == "__main__":
    check_status()
