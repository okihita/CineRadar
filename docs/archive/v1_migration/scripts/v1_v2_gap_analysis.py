"""Analyze V1→V2 performance gap in Firestore."""

import os
import time

from google.cloud import firestore


def load_env(path: str) -> None:
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"')
            if key:
                os.environ[key] = value


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_env(os.path.join(script_dir, "..", "admin", ".env.local"))

    project_id = os.environ["FIREBASE_PROJECT_ID"]
    client_email = os.environ["FIREBASE_CLIENT_EMAIL"]
    private_key = os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n")

    import google.oauth2.service_account

    info = {
        "type": "service_account",
        "project_id": project_id,
        "private_key_type": "private_key",
        "private_key": private_key,
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    creds = google.oauth2.service_account.Credentials.from_service_account_info(info)
    db = firestore.Client(project=project_id, credentials=creds)

    print("=== Step 1: Build schedule_id → metadata_id mapping (collection group query) ===")
    schedule_to_metadata: dict[str, str | None] = {}
    metadata_to_schedules: dict[str, list[str]] = {}

    movies_query = db.collection_group("movies").select(["tix_metadata_id"])
    docs = movies_query.stream()
    for count, snap in enumerate(docs, 1):
        sid = snap.id
        data = snap.to_dict() or {}
        mid = data.get("tix_metadata_id")
        schedule_to_metadata[sid] = mid
        if mid:
            metadata_to_schedules.setdefault(mid, []).append(sid)

        if count % 200 == 0:
            print(f"  {count} movie docs processed...")
            time.sleep(0.5)

    print(f"Total schedule_ids mapped: {len(schedule_to_metadata)}")

    print("\n=== Step 2: Listing V1 performance root doc IDs ===")
    v1_ids = {d.id for d in db.collection("movie_performance").list_documents()}
    print(f"V1 root docs: {len(v1_ids)}")

    print("\n=== Step 3: Listing V2 performance root doc IDs ===")
    v2_ids = {d.id for d in db.collection("movie_performance_v2").list_documents()}
    print(f"V2 root docs: {len(v2_ids)}")

    print("\n=== Step 4: Analysis ===")

    covered = []
    gap_needs_backfill = []
    orphan_no_metadata = []
    not_in_schedule = []

    for sid in sorted(v1_ids):
        if sid not in schedule_to_metadata:
            not_in_schedule.append(sid)
            continue
        mid = schedule_to_metadata[sid]
        if mid is None:
            orphan_no_metadata.append(sid)
        elif mid in v2_ids:
            covered.append((sid, mid))
        else:
            gap_needs_backfill.append((sid, mid))

    covered_mids = {mid for _, mid in covered}
    gap_mids = {mid for _, mid in gap_needs_backfill}

    orphan_direct_v2 = [sid for sid in orphan_no_metadata if sid in v2_ids]
    orphan_no_v2 = [sid for sid in orphan_no_metadata if sid not in v2_ids]
    not_in_sched_direct_v2 = [sid for sid in not_in_schedule if sid in v2_ids]
    not_in_sched_no_v2 = [sid for sid in not_in_schedule if sid not in v2_ids]

    all_v2_accounted = covered_mids | gap_mids | set(orphan_direct_v2) | set(not_in_sched_direct_v2)
    v2_only = sorted(v2_ids - all_v2_accounted)

    print(f"\n{'Category':<50} {'Count':>6}")
    print("-" * 58)
    print(f"{'Total V1 perf docs':<50} {len(v1_ids):>6}")
    print(f"{'Total V2 perf docs':<50} {len(v2_ids):>6}")
    print()
    print(f"{'Covered (schedule→metadata mapped, in V2)':<50} {len(covered):>6}")
    print(f"{'Gap (schedule→metadata mapped, NOT in V2)':<50} {len(gap_needs_backfill):>6}")
    print(f"{'Orphan→direct match (no metadata_id, ID in V2)':<50} {len(orphan_direct_v2):>6}")
    print(f"{'Orphan→missing (no metadata_id, NOT in V2)':<50} {len(orphan_no_v2):>6}")
    print(f"{'Not in schedule→direct match (ID in V2)':<50} {len(not_in_sched_direct_v2):>6}")
    print(f"{'Not in schedule→missing (NOT in V2)':<50} {len(not_in_sched_no_v2):>6}")
    print(f"{'V2 Only (no V1 doc at all)':<50} {len(v2_only):>6}")
    print()
    total_covered = len(covered) + len(orphan_direct_v2) + len(not_in_sched_direct_v2)
    total_gap = len(gap_needs_backfill) + len(orphan_no_v2) + len(not_in_sched_no_v2)
    print(f"{'TOTAL V1 docs with V2 coverage':<50} {total_covered:>6}")
    print(f"{'TOTAL V1 docs missing from V2 (true gap)':<50} {total_gap:>6}")

    print("\n--- Covered via schedule mapping (first 10) ---")
    for sid, mid in covered[:10]:
        print(f"  {sid} → {mid}")

    print("\n--- Gap via schedule mapping (first 10) ---")
    for sid, mid in gap_needs_backfill[:10]:
        print(f"  {sid} → {mid}")

    print("\n--- Orphan but direct-match in V2 (first 10) ---")
    for sid in orphan_direct_v2[:10]:
        print(f"  V1:{sid} == V2:{sid}  (same ID)")

    print("\n--- Orphan and missing from V2 (first 10) ---")
    for sid in orphan_no_v2[:10]:
        print(f"  {sid}")

    print("\n--- V2 Only (first 10) ---")
    for mid in v2_only[:10]:
        sids = metadata_to_schedules.get(mid, [])
        print(f"  {mid}  (schedule_ids: {sids[:3]}{'...' if len(sids) > 3 else ''})")


if __name__ == "__main__":
    main()
