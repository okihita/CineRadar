#!/usr/bin/env python3
"""
Fetch Movies from Firestore
Downloads the latest daily snapshot from Firestore 'snapshots/latest'
and saves it to data/movies_latest.json.
"""
import json
import logging
import os
import sys
from pathlib import Path
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("FetchMovies")

def get_firestore_client():
    """Get Firestore client with credentials."""
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if sa_json:
        import tempfile
        creds_data = json.loads(sa_json)
        # Create temp file for SDK
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(creds_data, f)
            temp_path = f.name
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_path
        return firestore.Client(project=creds_data.get('project_id', 'cineradar-481014'))
    
    return firestore.Client()

def fetch_latest_snapshot():
    """Fetch 'latest' document from 'snapshots' collection."""
    try:
        db = get_firestore_client()
        logger.info("🔌 Connected to Firestore")
        
        # List all documents in snapshots
        logger.info("📂 Listing snapshots collection:")
        docs = db.collection('snapshots').limit(10).stream() 
        found_docs = []
        for d in docs:
            logger.info(f"   - {d.id} (size: ~{len(str(d.to_dict()))} chars)")
            found_docs.append(d.id)
            
        # Try to fetch today's date document if it exists
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        target_id = 'latest'
        
        # If today exists, prefer it? Or 'latest'? 
        # Let's verify 'latest' content again vs dated docs
        
        doc_ref = db.collection('snapshots').document(target_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            logger.error("❌ 'snapshots/latest' document not found!")
            return False
        
        data = doc.to_dict()
        logger.info(f"✅ Downloaded snapshot '{target_id}' (date: {data.get('date', 'unknown')})")
        logger.info(f"   Movies count: {len(data.get('movies', []))}")
        
        # Check if schedules exist
        has_schedules = any('schedules' in m for m in data.get('movies', []))
        logger.info(f"   Has schedules: {has_schedules}")
        
        if not has_schedules:
            logger.warning("⚠️ 'latest' seems to lack schedules. Checking for dated document...")
            if today in found_docs:
                logger.info(f"   Fetching '{today}' instead...")
                doc = db.collection('snapshots').document(today).get()
                data = doc.to_dict()
                has_schedules = any('schedules' in m for m in data.get('movies', []))
                logger.info(f"   '{today}' has schedules: {has_schedules}")

        # Save to file
        output_path = Path("data/movies_latest.json")
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        logger.info(f"💾 Saved to {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error fetching snapshot: {e}")
        return False

if __name__ == "__main__":
    success = fetch_latest_snapshot()
    sys.exit(0 if success else 1)
