#!/usr/bin/env python3
"""Audit Studio Database.

Initializes the 'audit' object for all studios in the master table.
Labels studios as 'guessed' if they are old/low-version, or 'raw' if V3.
"""

import asyncio
import logging
import sys
from datetime import datetime

sys.path.insert(0, ".")

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import THEATRES
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

async def audit_all_studios():
    db = await get_firestore_async_client()
    theatre_docs = await db.collection(THEATRES).get()
    
    total_studios = 0
    updated = 0
    
    logger.info(f"📋 Starting audit of {len(theatre_docs)} theatres...")
    
    for t_doc in theatre_docs:
        studios = await t_doc.reference.collection("studios").get()
        for s_doc in studios:
            total_studios += 1
            data = s_doc.to_dict()
            
            # Skip if audit already exists and is locked/confirmed
            existing_audit = data.get("audit", {})
            if existing_audit.get("is_confirmed"):
                continue
                
            version = data.get("version", 0)
            
            # Determine source and confidence
            if version >= 3:
                source = "raw_initial_layout"
                method = "multi_movie_consensus"
            else:
                source = "guessed_compressed_layout"
                method = "snapshot_inference"
                
            audit_data = {
                "source": source,
                "method": method,
                "is_confirmed": existing_audit.get("is_confirmed", False),
                "confirmed_at": existing_audit.get("confirmed_at"),
                "version": version,
                "audited_at": datetime.now(JAKARTA_TZ).isoformat()
            }
            
            # Keep sample count if it was there (V3)
            if "sample_count" in existing_audit:
                audit_data["sample_count"] = existing_audit["sample_count"]
            elif version >= 3:
                # If V3 but missing sample_count (shouldn't happen with new script)
                audit_data["sample_count"] = 1

            await s_doc.reference.update({"audit": audit_data})
            updated += 1
            
        if updated % 100 == 0 and updated > 0:
            logger.info(f"   Processed {updated} studios...")

    logger.info(f"✅ Audit complete. Total studios scanned: {total_studios}. Updated: {updated}.")

if __name__ == "__main__":
    asyncio.run(audit_all_studios())
