import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.ApplicationDefault()
    app = firebase_admin.initialize_app(cred, {'projectId': 'cineradar-481014'})
except Exception:
    app = firebase_admin.get_app()

db = firestore.client()

print("🔍 Checking 'snapshots/latest' structure...")
doc = db.collection("snapshots").document("latest").get()

if not doc.exists:
    print("❌ 'snapshots/latest' does not exist.")
    exit(0)

data = doc.to_dict()
movies = data.get("movies", [])
if not movies:
    print("❌ No movies in snapshot.")
    exit(0)

# distinct finding of showtime keys
keys_found = set()
has_showtime_id = False

# Deep dive into first movie
m = movies[0]
print(f"Movie: {m.get('title')}")
schedules = m.get("schedules", {})
for city,scheds in schedules.items():
    for sched in scheds:
        for room in sched.get("rooms", []):
            sts = room.get("showtimes", [])
            for st in sts:
                if isinstance(st, dict):
                    keys_found.update(st.keys())
                    if "showtime_id" in st:
                        has_showtime_id = True
                        print(f"✅ Found showtime_id: {st['showtime_id']}")
                        exit(0)

print(f"❌ No showtime_id found. Keys in showtime objects: {keys_found}")
