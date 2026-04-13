import asyncio
import sys
import os
import time
from datetime import datetime, timedelta
from collections import Counter
from google.cloud import firestore

# Ensure backend module can be found
sys.path.insert(0, ".")

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import THEATRES, SCHEDULES_V2, MOVIE_PERFORMANCE_V2
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client

# CONCURRENCY CONTROL
THEATRE_BATCH_SIZE = 10
COLLISION_LOG = "detected_collisions.txt"

# ANSI ESCAPE CODES
def move_cursor_up(n): return f"\033[{n}A"
def move_cursor_to_col(n): return f"\033[{n}G"

def get_price_category(date_str):
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    wd = dt.weekday()
    if wd <= 3: return 'mon_thu'
    if wd == 4: return 'fri'
    return 'sat_sun'

def get_branding_color(name):
    """Map physical grade names to official branding colors."""
    n = name.upper()
    if any(x in n for x in ['IMAX', 'MACRO XE', 'ULTRA XD']): return '#3b82f6'
    if any(x in n for x in ['PREMIERE', 'GOLD', 'VELVET', 'VIP', 'PLATINUM']): return '#f59e0b'
    if 'SWEET' in n: return '#ec4899'
    if 'SATIN' in n: return '#a855f7'
    return '#71717a'

def get_fingerprint(raw_data):
    """Generate a physical dimension fingerprint for a layout."""
    sm = raw_data.get('seat_map', [])
    if not sm: return "EMPTY"
    if sm[0].get('seat_rows'): # Pattern A
        rows = len(sm)
        cols = max(len(r.get('seat_rows', [])) for r in sm)
    else: # Pattern B
        cols = raw_data.get('max_horizontal_seat', 10) or 10
        rows = len(sm) // cols if cols > 0 else 0
    return f"{rows}x{cols}"

async def fetch_one_sample_for_day_stable(db, tid, sid, date_str):
    try:
        m_docs = await db.collection(SCHEDULES_V2).document(date_str).collection('movies').get()
        for m in m_docs:
            m_data = m.to_dict()
            cities = m_data.get('cities', {})
            t_entry = None
            for theatres in cities.values():
                t_entry = next((t for t in theatres if str(t.get('theatre_id')) == str(tid)), None)
                if t_entry: break
            
            if t_entry:
                target_ids = set()
                for room in t_entry.get('rooms', []):
                    room_sid = str(room.get('studio_id'))
                    category = room.get('category', 'UNKNOWN')
                    for show in room.get('all_showtimes', []):
                        show_sid = str(show.get('studio_id'))
                        if room_sid == str(sid) or show_sid == str(sid):
                            target_ids.add((str(show.get('showtime_id')), category))
                
                if not target_ids: continue

                for show_id, cat in target_ids:
                    st_ref = db.collection(MOVIE_PERFORMANCE_V2).document(m.id).collection('days').document(date_str).collection('showtimes').document(show_id)
                    st_doc = await st_ref.get()
                    if st_doc.exists:
                        data = st_doc.to_dict()
                        raw_payload = data.get('initial_raw_layout') or data.get('raw_api_response')
                        if raw_payload and isinstance(raw_payload, dict) and 'data' in raw_payload:
                            return {
                                'raw': raw_payload['data'],
                                'category': cat,
                                'meta': {
                                    'movie_id': m.id, 'movie_title': m_data.get('title'),
                                    'date': date_str, 'time': data.get('showtime', 'Unknown'),
                                    'showtime_id': show_id,
                                    'price': raw_payload['data'].get('price') or (raw_payload['data'].get('price_group', [{}])[0].get('seat_grd_price')) or 0
                                }
                            }
    except: pass
    return None

async def build_twin_v3_3_autonomous(db, theatre_name, tid, sid, merchant):
    today = datetime.now(JAKARTA_TZ)
    valid_samples = []
    cat_counts = Counter()
    fp_counts = Counter()

    for i in range(1, 15): 
        date_str = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        sample = await fetch_one_sample_for_day_stable(db, tid, sid, date_str)
        if sample:
            valid_samples.append(sample)
            cat_counts[sample.get('category', 'UNKNOWN')] += 1
            fp_counts[get_fingerprint(sample['raw'])] += 1
        if len(valid_samples) >= 7: break

    if not valid_samples: return 0

    if len(fp_counts) > 1:
        with open(COLLISION_LOG, "a") as f:
            f.write(f"THEATRE: {theatre_name} | STUDIO: {sid} | HARD COLLISION: {dict(fp_counts)}\n")
        return 0

    all_categories = sorted(list(cat_counts.keys()))
    primary_category = cat_counts.most_common(1)[0][0]
    samples_data = [s['raw'] for s in valid_samples]
    evidence = [s['meta'] for s in valid_samples]
    
    price_groups = {}
    if merchant.upper() == 'XXI':
        price_map = {'mon_thu': 0, 'fri': 0, 'sat_sun': 0}
        for s in valid_samples:
            cat = get_price_category(s['meta']['date'])
            p = s['meta']['price']
            if p > price_map[cat]: price_map[cat] = p
        price_groups['01'] = {'name': primary_category.upper(), 'color': get_branding_color(primary_category), 'prices': price_map}
    else:
        all_grade_ids = set()
        for samp in samples_data:
            for pg in samp.get('price_group', []): all_grade_ids.add(pg.get('seat_grd_cd'))
        for g_id in all_grade_ids:
            if not g_id: continue
            p_map = {'mon_thu': 0, 'fri': 0, 'sat_sun': 0}
            g_name = "UNKNOWN"
            for s in valid_samples:
                tier = get_price_category(s['meta']['date'])
                for pg in s['raw'].get('price_group', []):
                    if pg.get('seat_grd_cd') == g_id:
                        val = pg.get('seat_grd_price') or pg.get('price', 0)
                        if val > p_map[tier]: p_map[tier] = val
                        g_name = pg.get('seat_grd_nm', g_name)
            price_groups[g_id] = {'name': g_name, 'color': get_branding_color(g_name), 'prices': p_map}

    grid = []
    total = 0
    master = max(samples_data, key=lambda x: len(x.get('seat_map', [])))
    seat_map = master.get('seat_map', [])
    
    if merchant.upper() == 'XXI':
        vertical_lanes = master.get('seat_rules', {}).get('vertical_lane') or []
        lane_indices = set(l['before_seat_column'] - 1 for l in vertical_lanes)
        for row in seat_map:
            row_code = row.get('seat_code', '')
            new_row = {'row_name': row_code, 'seats': []}
            for j, s in enumerate(row.get('seat_rows', [])):
                if j in lane_indices: new_row['seats'].append({'id': '', 'type': 'aisle'})
                label = s.get('seat_row')
                real = False
                if label:
                    for sr in samples_data:
                        for r in sr.get('seat_map', []):
                            if r.get('seat_code') == row_code:
                                for ss in r.get('seat_rows', []):
                                    if ss.get('seat_row') == label and ss.get('status') in [1, 5]:
                                        real = True; break
                            if real: break
                new_row['seats'].append({'id': label if real else '', 'type': 'seat' if real else 'aisle', 'grade': s.get('seat_grd_cd', '01') if real else None})
                if real: total += 1
            grid.append(new_row)
    else:
        max_cols = master.get('max_horizontal_seat', 10) or 10
        for i in range(0, len(seat_map), max_cols):
            chunk = seat_map[i : i + max_cols]
            r_label = next((x.get('row_name') for x in chunk if x.get('row_name')), '')
            new_row = {'row_name': r_label, 'seats': []}
            for s in chunk:
                lbl = f"{s.get('row_name', r_label)}{s.get('seat_no', '')}"
                real = False
                if s.get('seat_yn') == '1':
                    for sr in samples_data:
                        for ss in sr.get('seat_map', []):
                            if ss.get('row_name') == s.get('row_name') and ss.get('seat_no') == s.get('seat_no'):
                                if ss.get('seat_status') == 1:
                                    real = True; break
                        if real: break
                new_row['seats'].append({'id': lbl if real else '', 'type': 'seat' if real else 'aisle', 'grade': s.get('seat_grd_cd', '01') if real else None})
                if real: total += 1
            grid.append(new_row)

    doc_ref = db.collection(THEATRES).document(tid).collection('studios').document(sid)
    try:
        await doc_ref.update({
            'is_ground_truth': firestore.DELETE_FIELD, 'is_guessed': firestore.DELETE_FIELD,
            'verification_status': firestore.DELETE_FIELD, 'last_updated': firestore.DELETE_FIELD,
            'physical_layout.version': firestore.DELETE_FIELD, 'price_groups.01.price': firestore.DELETE_FIELD,
            'studio_id': firestore.DELETE_FIELD, 'total_seats': firestore.DELETE_FIELD
        })
    except: pass

    await doc_ref.set({
        'id': sid, 'room_category': primary_category, 'all_categories': all_categories,
        'physical_layout': {'total_capacity': total, 'grid': grid},
        'price_groups': price_groups, 'evidence': evidence, 'version': 3.3
    }, merge=True)
    return total

async def process_theatre_nitro(db, theatre):
    tid = theatre.id
    t_data = theatre.to_dict()
    merchant = t_data.get('merchant', 'UNKNOWN')
    name = t_data.get('name', tid)
    
    studio_docs = await db.collection(THEATRES).document(tid).collection('studios').get()
    studio_ids = [doc.id for doc in studio_docs]
    if not studio_ids: return f"SKIP: {name}"

    tasks = [build_twin_v3_3_autonomous(db, name, tid, sid, merchant) for sid in studio_ids]
    results = await asyncio.gather(*tasks)
    
    t_cap = sum(results)
    act_count = len([r for r in results if r > 0])
    
    if act_count > 0:
        t_ref = db.collection(THEATRES).document(tid)
        await t_ref.update({
            'is_ground_truth': firestore.DELETE_FIELD, 'is_guessed': firestore.DELETE_FIELD,
            'verification_status': firestore.DELETE_FIELD, 'last_updated': firestore.DELETE_FIELD
        })
        await t_ref.set({'total_capacity': t_cap, 'studio_count': act_count, 'version': 3.3, 'last_sync': datetime.now(JAKARTA_TZ).isoformat()}, merge=True)
        return f"SYNCED: {name} ({t_cap} seats)"
    return f"NONE: {name}"

def format_duration(seconds):
    return str(timedelta(seconds=int(seconds)))

async def main():
    db = await get_firestore_async_client()
    print(f"\n🚀 STARTING NATIONAL REBOOT (Parallel Batch: {THEATRE_BATCH_SIZE})")
    if os.path.exists(COLLISION_LOG): os.remove(COLLISION_LOG)

    theatre_docs = await db.collection(THEATRES).get()
    total_theatres = len(theatre_docs)
    print(f"==> Targeting {total_theatres} theatres...")

    start_time = time.time()
    
    # Chunking into batches of 10
    for i in range(0, total_theatres, THEATRE_BATCH_SIZE):
        batch = theatre_docs[i : i + THEATRE_BATCH_SIZE]
        print(f"\n🎬 Processing Batch {i//THEATRE_BATCH_SIZE + 1} ({len(batch)} theatres)...")
        
        batch_tasks = [process_theatre_nitro(db, t) for t in batch]
        batch_results = await asyncio.gather(*batch_tasks)
        
        for res in batch_results:
            print(f"   -> {res}")

        # Telemetry
        processed = i + len(batch)
        current_elapsed = time.time() - start_time
        avg_time = current_elapsed / processed
        remaining = (total_theatres - processed) * avg_time
        
        print(f"⏱️  ELAPSED: {format_duration(current_elapsed)} | ⏳ REMAINING: {format_duration(remaining)} (Avg: {avg_time:.1f}s/theatre)")
        sys.stdout.flush()

    print("\n🏁 NATIONAL REBOOT COMPLETE.")

if __name__ == "__main__":
    asyncio.run(main())
