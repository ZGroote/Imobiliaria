"""
Converte overture_buildings.geojson -> formato .city.json compatível com sao-carlos.html

O HTML espera:
  store = { v:1, c:[lat, lon], q:10, names:[], b:[], bm:[], r:[], g:[] }

Onde b[] = [cls, h*Q, n_pts, dx0, dz0, dx1, dz1, ... ]  (delta-encoded, decímetros)

Este script:
  1. Lê os buildings do Overture (polígonos)
  2. Lê o city.json existente (para manter ruas e áreas verdes do OSM)
  3. Substitui os buildings pelo Overture (muito mais completo)
  4. Gera sao-carlos-overture.city.json
"""

import json
import math
import sys

# ---- Config ----
CENTER_LAT = -22.01725
CENTER_LON = -47.89080
Q = 10  # decímetros
MLAT = 111132.92
MLON = 111319.49 * math.cos(CENTER_LAT * math.pi / 180)

LV = 3.15
BY_TYPE = {
    "church":16, "cathedral":24, "chapel":9, "temple":14, "apartments":19,
    "residential":7, "house":4.2, "detached":4.2, "bungalow":3.6, "terrace":5.2,
    "hotel":22, "commercial":11, "office":16, "retail":6.5, "supermarket":8,
    "kiosk":3.2, "industrial":9, "warehouse":8.5, "garage":3, "garages":3,
    "roof":3.4, "school":8, "university":12, "college":11, "hospital":16,
    "civic":11, "government":14, "train_station":12, "transportation":10,
    "hall":9, "sports_hall":11
}

def px(lon):
    return (lon - CENTER_LON) * MLON

def pz(lat):
    return -(lat - CENTER_LAT) * MLAT

def simple_hash(val):
    """Deterministic hash matching the JS hash function"""
    h = 2166136261 ^ int(val)
    h = (h ^ (h >> 15)) * 2246822507 & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 3266489909 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296

def shoelace(ring):
    """Signed area * 2"""
    s = 0
    n = len(ring)
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % n]
        s += a[0] * b[1] - b[0] * a[1]
    return s

def est_height(area, building_id, cls_name="", num_floors=None, height=None):
    """Estimate building height same logic as the JS"""
    if height and 1.5 < height < 260:
        return height
    if num_floors and 1 <= num_floors < 70:
        return num_floors * LV + 1.1
    base = BY_TYPE.get(cls_name)
    if base is None:
        if area > 2400: base = 12
        elif area > 900: base = 8
        elif area > 320: base = 5.6
        else: base = 3.9
    return base * (0.82 + simple_hash(building_id) * 0.42)

def classify_overture(props):
    """Classify building from Overture properties"""
    cls = props.get("class", "")
    subtype = props.get("subtype", "")
    names = props.get("names", {})

    # Overture classes
    if cls in ("residential", "house", "apartments", "detached", "terrace", "bungalow"):
        return 1  # residential
    if cls in ("commercial", "retail", "office", "industrial", "warehouse", "hotel", "kiosk", "supermarket"):
        return 2  # business
    if cls in ("church", "cathedral", "chapel", "temple", "civic", "government",
               "school", "university", "college", "hospital", "train_station", "public"):
        return 3  # civic

    # Default: unclassified
    return 0

def process_ring(coords):
    """Convert GeoJSON coords [lon, lat] to projected [x, z] meters"""
    ring = []
    for c in coords:
        lon, lat = c[0], c[1]
        x = px(lon)
        z = pz(lat)
        ring.append([x, z])

    # Remove closing vertex if same as first
    if len(ring) > 1 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
        ring = ring[:-1]
    return ring

def push_path(arr, pts):
    """Delta-encode path into array (matching JS pushPath)"""
    arr.append(len(pts))
    lx, lz = 0, 0
    for p in pts:
        x = round(p[0] * Q)
        z = round(p[1] * Q)
        arr.append(x - lx)
        arr.append(z - lz)
        lx, lz = x, z


# ---- Main ----
print("=== Overture -> city.json converter ===\n")

# 1. Load existing city.json (for roads + greens)
existing_path = r"C:\Users\respawn\Desktop\imobiliaria\sao-carlos.city.json"
print(f"Loading existing city.json for roads/greens...")
with open(existing_path, "r", encoding="utf-8") as f:
    existing = json.load(f)

print(f"  Existing roads data: {len(existing.get('r', []))} ints")
print(f"  Existing greens data: {len(existing.get('g', []))} ints")

# 2. Load Overture buildings
overture_path = r"C:\Users\respawn\Desktop\imobiliaria\overture_buildings.geojson"
print(f"\nLoading Overture buildings ({overture_path})...")
with open(overture_path, "r", encoding="utf-8") as f:
    overture = json.load(f)

features = overture.get("features", [])
print(f"  Total features: {len(features)}")

# 3. Process buildings
print("\nProcessing buildings...")
b_arr = []  # main buildings array
bm_arr = []  # building metadata (name, addr)
names_list = []
name_idx = {}
b_count = 0
skipped = 0

def name_of(s):
    if s is None:
        return -1
    if s in name_idx:
        return name_idx[s]
    idx = len(names_list)
    name_idx[s] = idx
    names_list.append(s)
    return idx

for i, feat in enumerate(features):
    if i % 20000 == 0 and i > 0:
        print(f"  Processed {i}/{len(features)}...")
    
    geom = feat.get("geometry", {})
    props = feat.get("properties", {})
    gtype = geom.get("type", "")
    
    if gtype == "Polygon":
        coords_list = [geom["coordinates"][0]]  # outer ring only
    elif gtype == "MultiPolygon":
        coords_list = [poly[0] for poly in geom["coordinates"]]  # outer ring of each
    else:
        skipped += 1
        continue
    
    for coords in coords_list:
        ring = process_ring(coords)
        if len(ring) < 3:
            skipped += 1
            continue
        
        s = shoelace(ring)
        area = abs(s) / 2
        
        if area < 14 or area > 260000:
            skipped += 1
            continue
        
        # Ensure CCW winding
        if s > 0:
            ring.reverse()
        
        # Classification
        cls = classify_overture(props)
        
        # Height estimation
        h_val = props.get("height")
        nf = props.get("num_floors")
        cls_name = props.get("class", "")
        height = est_height(area, b_count, cls_name, nf, h_val)
        
        # Name
        name = None
        names_obj = props.get("names")
        if names_obj and isinstance(names_obj, dict):
            primary = names_obj.get("primary")
            if primary:
                name = primary
        
        # Store
        if name:
            bm_arr.extend([b_count, name_of(name), -1])
        
        b_arr.append(cls)
        b_arr.append(round(height * Q))
        push_path(b_arr, ring)
        b_count += 1

print(f"\n  Buildings processed: {b_count}")
print(f"  Skipped: {skipped}")
print(f"  Names found: {len(names_list)}")

# 4. Build output (keep roads and greens from existing)
output = {
    "v": 1,
    "c": [CENTER_LAT, CENTER_LON],
    "q": Q,
    "names": names_list,
    "b": b_arr,
    "bm": bm_arr,
    "r": existing.get("r", []),
    "g": existing.get("g", [])
}

# Merge existing road names into names
# The existing file has its own names array for roads
# We need to remap the road name indices
existing_names = existing.get("names", [])
if existing_names:
    print(f"\nRemapping {len(existing_names)} road names...")
    # Build mapping: old index -> new index
    remap = {}
    for old_idx, n in enumerate(existing_names):
        remap[old_idx] = name_of(n)
    
    # Remap road name indices in r[] array
    # Road format: [highway_kind, name_index, n_pts, dx, dz, ...]
    new_r = []
    ri = 0
    r_data = existing.get("r", [])
    while ri < len(r_data):
        kind = r_data[ri]; ri += 1
        old_name_idx = r_data[ri]; ri += 1
        new_name_idx = remap.get(old_name_idx, -1) if old_name_idx >= 0 else -1
        n_pts = r_data[ri]; ri += 1
        new_r.extend([kind, new_name_idx, n_pts])
        for _ in range(n_pts * 2):
            new_r.append(r_data[ri]); ri += 1
    output["r"] = new_r
    output["names"] = names_list

# 5. Save
out_path = r"C:\Users\respawn\Desktop\imobiliaria\sao-carlos-overture.city.json"
print(f"\nSaving to {out_path}...")
json_str = json.dumps(output, separators=(",", ":"))
with open(out_path, "w", encoding="utf-8") as f:
    f.write(json_str)

size_mb = len(json_str) / 1048576
print(f"  Size: {size_mb:.1f} MB")
print(f"\n=== Done! ===")
print(f"  Buildings: {b_count} (was ~4591 with OSM only)")
print(f"  Gain: {b_count / 4591:.0f}x more buildings")
print(f"  Roads: preserved from original")
print(f"  File: sao-carlos-overture.city.json")
