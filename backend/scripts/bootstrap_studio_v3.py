import asyncio
import sys
from datetime import datetime, timedelta
from google.cloud import firestore

# Ensure backend module can be found
sys.path.insert(0, ".")

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import THEATRES, SCHEDULES_V2, MOVIE_PERFORMANCE_V2
from backend.infrastructure.repositories.firestore_utils import get_firestore_async_client

def get_price_category(date_str):
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    wd = dt.weekday()
    if wd <= 3: return 'mon_thu'
    if wd == 4: return 'fri'
    return 'sat_sun'

async def fetch_one_sample_for_day(db, tid, sid, date_str):
    """
    Scans every showtime inside the schedule to find our target Studio ID.
    Directly fetches performance documents by Document ID.
    """
    try:
        m_docs = await db.collection(SCHEDULES_V2).document(date_str).collection('movies').get()
        for m in m_docs:
            m_data = m.to_dict()
            cities = m_data.get('cities', {})
            
            t_entry = None
            for city_theatres in cities.values():
                t_entry = next((t for t in city_theatres if str(t.get('theatre_id')) == str(tid)), None)
                if t_entry: break
            
            if t_entry:
                target_showtime_ids = set()
                for room in t_entry.get('rooms', []):
                    for show in room.get('all_showtimes', []):
                        if str(show.get('studio_id')) == str(sid):
                            target_showtime_ids.add(str(show.get('showtime_id')))
                
                if not target_showtime_ids: continue

                for show_id in target_showtime_ids:
                    st_ref = db.collection(MOVIE_PERFORMANCE_V2).document(m.id).collection('days').document(date_str).collection('showtimes').document(show_id)
                    st_doc = await st_ref.get()
                    
                    if st_doc.exists:
                        data = st_doc.to_dict()
                        raw_payload = data.get('initial_raw_layout') or data.get('raw_api_response')
                        if raw_payload and isinstance(raw_payload, dict) and 'data' in raw_payload:
                            raw_data = raw_payload['data']
                            price = raw_data.get('price')
                            if price is None:
                                pgs = raw_data.get('price_group', [])
                                if pgs: price = pgs[0].get('seat_grd_price')
                            
                            return {
                                'raw': raw_data,
                                'meta': {
                                    'movie_id': m.id,
                                    'movie_title': m_data.get('title'),
                                    'date': date_str,
                                    'time': data.get('showtime', 'Unknown'),
                                    'showtime_id': show_id,
                                    'price': price or 0
                                }
                            }
    except Exception:
        pass
    return None

async def build_twin_v3_3_autonomous(db, tid, sid, merchant):
    today = datetime.now(JAKARTA_TZ)
    valid_samples = []
    
    # 14 Day Hunt
    for i in range(1, 15): 
        date_str = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        sample = await fetch_one_sample_for_day(db, tid, sid, date_str)
        if sample: valid_samples.append(sample)
        if len(valid_samples) >= 7: break

    if not valid_samples:
        return 0

    samples_data = [s['raw'] for s in valid_samples]
    evidence = [s['meta'] for s in valid_samples]
    
    price_groups = {}
    if merchant.upper() == 'XXI':
        price_map = {'mon_thu': 0, 'fri': 0, 'sat_sun': 0}
        for s in valid_samples:
            cat = get_price_category(s['meta']['date'])
            p = s['meta']['price']
            if p > price_map[cat]: price_map[cat] = p
        price_groups['01'] = {'name': 'REGULAR', 'color': '#71717a', 'prices': price_map}
    else:
        all_grades = set()
        for samp in samples_data:
            for pg in samp.get('price_group', []): all_grades.add(pg.get('seat_grd_cd'))
        for grade_id in all_grades:
            if not grade_id: continue
            price_map = {'mon_thu': 0, 'fri': 0, 'sat_sun': 0}
            grade_name = "UNKNOWN"
            grade_color = "#71717a"
            for s in valid_samples:
                cat = get_price_category(s['meta']['date'])
                for pg in s['raw'].get('price_group', []):
                    if pg.get('seat_grd_cd') == grade_id:
                        p = pg.get('seat_grd_price') or pg.get('price', 0)
                        if p > price_map[cat]: price_map[cat] = p
                        grade_name = pg.get('seat_grd_nm', grade_name)
                        if "SWEET" in grade_name.upper(): grade_color = "#ec4899"
                        elif "GOLD" in grade_name.upper(): grade_color = "#f59e0b"
                        elif "VELVET" in grade_name.upper(): grade_color = "#f59e0b"
                        elif "SATIN" in grade_name.upper(): grade_color = "#a855f7"
            price_groups[grade_id] = {'name': grade_name, 'color': grade_color, 'prices': price_map}

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
                    for samp_raw in samples_data:
                        for r in samp_raw.get('seat_map', []):
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
            row_label = next((x.get('row_name') for x in chunk if x.get('row_name')), '')
            new_row = {'row_name': row_label, 'seats': []}
            for s in chunk:
                label = f"{s.get('row_name', row_label)}{s.get('seat_no', '')}"
                real = False
                if s.get('seat_yn') == '1':
                    for samp_raw in samples_data:
                        for ss in samp_raw.get('seat_map', []):
                            if ss.get('row_name') == s.get('row_name') and ss.get('seat_no') == s.get('seat_no'):
                                if ss.get('seat_status') == 1:
                                    real = True; break
                        if real: break
                new_row['seats'].append({'id': label if real else '', 'type': 'seat' if real else 'aisle', 'grade': s.get('seat_grd_cd', '01') if real else None})
                if real: total += 1
            grid.append(new_row)

    doc_ref = db.collection(THEATRES).document(tid).collection('studios').document(sid)
    try:
        await doc_ref.update({
            'audit': firestore.DELETE_FIELD, 'layout': firestore.DELETE_FIELD, 
            'raw_initial_layout': firestore.DELETE_FIELD, 'price_legend': firestore.DELETE_FIELD,
            'low_price': firestore.DELETE_FIELD, 'high_price': firestore.DELETE_FIELD,
            'consensus_audit': firestore.DELETE_FIELD, 'studio_id': firestore.DELETE_FIELD,
            'total_seats': firestore.DELETE_FIELD, 'last_updated': firestore.DELETE_FIELD,
            'physical_layout.version': firestore.DELETE_FIELD, 'price_groups.01.price': firestore.DELETE_FIELD
        })
    except: pass

    await doc_ref.set({
        'id': sid,
        'physical_layout': {'total_capacity': total, 'grid': grid},
        'price_groups': price_groups,
        'evidence': evidence,
        'version': 3.3
    }, merge=True)
    return total

async def main():
    db = await get_firestore_async_client()
    
    print("\n🚀 STARTING NATIONAL V3.3 BOOTSTRAP (RIDE OR DIE)")
    
    # 1. Fetch ALL theatres in Indonesia
    theatre_docs = await db.collection(THEATRES).get()
    total_theatres = len(theatre_docs)
    print(f"   Targeting {total_theatres} theatres...")
    
    count = 0
    for theatre in theatre_docs:
        count += 1
        tid = theatre.id
        t_data = theatre.to_dict()
        merchant = t_data.get('merchant', 'UNKNOWN')
        name = t_data.get('name', tid)
        
        print(f"\n[{count}/{total_theatres}] 🎬 {merchant} | {name} ({tid})")
        
        # 2. Discover all studios for this theatre
        studio_docs = await db.collection(THEATRES).document(tid).collection('studios').get()
        studio_ids = [doc.id for doc in studio_docs]
        
        theatre_total_capacity = 0
        actual_promoted_count = 0
        
        for sid in studio_ids:
            capacity = await build_twin_v3_3_autonomous(db, tid, sid, merchant)
            if capacity > 0:
                theatre_total_capacity += capacity
                actual_promoted_count += 1
        
        # 3. Parent Sync
        if actual_promoted_count > 0:
            await db.collection(THEATRES).document(tid).set({
                'total_capacity': theatre_total_capacity,
                'studio_count': actual_promoted_count,
                'version': 3.3,
                'last_sync': datetime.now(JAKARTA_TZ).isoformat()
            }, merge=True)
            print(f"   ✅ SYNCED: {theatre_total_capacity} seats across {actual_promoted_count} studios.")
        else:
            print(f"   ⚠️ SKIPPED: No studios were eligible for promotion.")

if __name__ == "__main__":
    asyncio.run(main())
