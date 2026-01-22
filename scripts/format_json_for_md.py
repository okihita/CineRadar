
import json

def truncate_seat_map(data):
    if not isinstance(data, dict): return data
    
    # Deep copy to avoid modifying original if needed (not needed here)
    data = json.loads(json.dumps(data))
    
    if "data" in data and "seat_map" in data["data"]:
        seat_map = data["data"]["seat_map"]
        if isinstance(seat_map, list) and len(seat_map) > 2:
            # Keep first 2 rows/items
            kept = seat_map[:2]
            
            # If nested (XXI/CGV), truncate seat_rows inside
            for item in kept:
                if "seat_rows" in item and len(item["seat_rows"]) > 3:
                    item["seat_rows"] = item["seat_rows"][:3] + [{"...": f"({len(item['seat_rows'])-3} more seats)"}]
            
            data["data"]["seat_map"] = kept + [{"...": f"({len(seat_map)-2} more rows)"}]
            
    return data

def process_file(filename, chain_name):
    try:
        with open(filename, 'r') as f:
            raw = json.load(f)
        
        truncated = truncate_seat_map(raw)
        json_str = json.dumps(truncated, indent=2)
        
        print(f"\n### {chain_name}")
        print("```json")
        print(json_str)
        print("```")
    except Exception as e:
        print(f"Error processing {filename}: {e}")

process_file("raw_xxi.json", "XXI (Real Sample)")
process_file("raw_cgv.json", "CGV (Real Sample)")
process_file("raw_cinepolis_valid.json", "Cinépolis (Real Sample)")

