import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.ApplicationDefault()
    app = firebase_admin.initialize_app(cred, {'projectId': 'cineradar-481014'})
except Exception:
    app = firebase_admin.get_app()

db = firestore.client()

print("🔍 Checking 'movie_performance' collection...")
docs = list(db.collection("movie_performance").limit(5).stream())

if not docs:
    print("❌ Collection 'movie_performance' is EMPTY.")
else:
    print(f"✅ Found {len(docs)} documents (showing sample):")
    for doc in docs:
        print(f" - {doc.id}: {doc.to_dict().keys()}")
