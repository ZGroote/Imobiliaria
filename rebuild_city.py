"""
Pipeline completo:
1. Baixa TODAS as ruas de São Carlos via Overpass (bbox completo)
2. Combina com buildings do Overture  
3. Melhora qualidade dos polígonos
4. Gera novo city.json
5. Embute no HTML com fix de Z-fighting
"""

import json
import math
import urllib.request
import urllib.parse
import time
import sys

import os as _os
_sys = sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))

# ---- Config: sai do JSON da cidade. Estava escrito aqui, com o centro e o bbox de
# Sao Carlos -- era o que impedia a etapa 0.2 de rodar pra outra cidade.
CENTER_LAT = CID.clat
CENTER_LON = CID.clon
_bb = CID._d["bbox"]                       # [lon_min, lat_min, lon_max, lat_max]
BBOX = {"s": _bb[1], "w": _bb[0], "n": _bb[3], "e": _bb[2]}
Q = CID._d["quantizacao"]
MLAT = CID.mlat
MLON = CID.mlon

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
HW_LIST = ["motorway","trunk","primary","secondary","tertiary","unclassified","residential",
    "living_street","pedestrian","service","track","footway","path","cycleway","steps",
    "motorway_link","trunk_link","primary_link","secondary_link","tertiary_link","other"]
HW_INDEX = {h: i for i, h in enumerate(HW_LIST)}

VERDE_SET = {"park","garden","pitch","playground","grass","forest","cemetery",
             "recreation_ground","village_green"}

def px(lon): return (lon - CENTER_LON) * MLON
def pz(lat): return -(lat - CENTER_LAT) * MLAT

def simple_hash(val):
    h = 2166136261 ^ (int(val) & 0xFFFFFFFF)
    h = (h ^ (h >> 15)) * 2246822507 & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 3266489909 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296

def shoelace(ring):
    s = 0
    n = len(ring)
    for i in range(n):
        a = ring[i]; b = ring[(i + 1) % n]
        s += a[0] * b[1] - b[0] * a[1]
    return s

def est_height(area, building_id, cls_name="", num_floors=None, height=None):
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
    cls = props.get("class", "")
    if cls in ("residential","house","apartments","detached","terrace","bungalow"):
        return 1
    if cls in ("commercial","retail","office","industrial","warehouse","hotel","kiosk","supermarket"):
        return 2
    if cls in ("church","cathedral","chapel","temple","civic","government",
               "school","university","college","hospital","train_station","public"):
        return 3
    return 0

def process_ring(coords):
    ring = []
    for c in coords:
        ring.append([px(c[0]), pz(c[1])])
    if len(ring) > 1 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
        ring = ring[:-1]
    return ring

def simplify_ring(ring, tolerance=0.3):
    """Douglas-Peucker simplification para suavizar polígonos ruidosos"""
    if len(ring) <= 4:
        return ring
    
    def perpendicular_distance(point, line_start, line_end):
        dx = line_end[0] - line_start[0]
        dz = line_end[1] - line_start[1]
        if dx == 0 and dz == 0:
            return math.hypot(point[0] - line_start[0], point[1] - line_start[1])
        t = max(0, min(1, ((point[0]-line_start[0])*dx + (point[1]-line_start[1])*dz) / (dx*dx + dz*dz)))
        proj_x = line_start[0] + t * dx
        proj_z = line_start[1] + t * dz
        return math.hypot(point[0] - proj_x, point[1] - proj_z)
    
    def dp(points, eps):
        if len(points) <= 2:
            return points
        dmax = 0
        idx = 0
        for i in range(1, len(points) - 1):
            d = perpendicular_distance(points[i], points[0], points[-1])
            if d > dmax:
                dmax = d
                idx = i
        if dmax > eps:
            left = dp(points[:idx+1], eps)
            right = dp(points[idx:], eps)
            return left[:-1] + right
        else:
            return [points[0], points[-1]]
    
    result = dp(ring, tolerance)
    if len(result) < 3:
        return ring  # Don't simplify too much
    return result

def push_path(arr, pts):
    arr.append(len(pts))
    lx, lz = 0, 0
    for p in pts:
        x = round(p[0] * Q)
        z = round(p[1] * Q)
        arr.append(x - lx)
        arr.append(z - lz)
        lx, lz = x, z

# ---- Name index ----
names_list = []
name_idx = {}

def name_of(s):
    if s is None:
        return -1
    if s in name_idx:
        return name_idx[s]
    idx = len(names_list)
    name_idx[s] = idx
    names_list.append(s)
    return idx


# ============================================================
# STEP 1: Download roads from Overpass
# ============================================================
print("=" * 60)
print("STEP 1: Downloading roads from Overpass API")
print("=" * 60)

overpass_query = f"""[out:json][timeout:180];
(
  way["highway"]({BBOX['s']},{BBOX['w']},{BBOX['n']},{BBOX['e']});
  way["leisure"]({BBOX['s']},{BBOX['w']},{BBOX['n']},{BBOX['e']});
  way["landuse"]({BBOX['s']},{BBOX['w']},{BBOX['n']},{BBOX['e']});
);
out geom;"""

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]

# Se o extract local ja foi recortado (pipeline/fontes/osm_extract.py), usa ele e nao
# toca no Overpass. Vinte cidades por Overpass sao ~1.200 consultas pesadas contra um
# servico comunitario -- ele devolve 429 na quarta seguida, e e abuso de recurso alheio.
overpass_data = None
_vias = CID.caminho("osm_vias")
if _os.path.exists(_vias):
    print(f"  extract local: {_vias}")
    overpass_data = json.load(open(_vias, encoding="utf-8"))
    print(f"  {len(overpass_data.get('elements', []))} elementos (sem rede)")

for mirror in (MIRRORS if overpass_data is None else []):
    print(f"  Trying {mirror}...")
    try:
        data = urllib.parse.urlencode({"data": overpass_query}).encode()
        req = urllib.request.Request(mirror, data=data, method="POST")
        req.add_header("User-Agent", "SaoCarlosCity/1.0")
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            overpass_data = json.loads(raw)
            elements = overpass_data.get("elements", [])
            print(f"  SUCCESS! Got {len(elements)} elements")
            break
    except Exception as e:
        print(f"  Failed: {e}")
        time.sleep(2)

if not overpass_data:
    print("ERROR: Could not download from any Overpass mirror!")
    print("Falling back to existing road data from city.json...")
    use_existing_roads = True
else:
    use_existing_roads = False


# ============================================================
# STEP 2: Process roads
# ============================================================
print("\n" + "=" * 60)
print("STEP 2: Processing roads and green areas")
print("=" * 60)

r_arr = []
g_arr = []
road_count = 0
green_count = 0
named_roads = 0

if not use_existing_roads:
    elements = overpass_data.get("elements", [])
    seen_ways = set()
    
    for el in elements:
        if el.get("type") != "way" or el.get("id") in seen_ways:
            continue
        seen_ways.add(el["id"])
        
        tags = el.get("tags", {})
        geom = el.get("geometry", [])
        
        if tags.get("highway"):
            if len(geom) < 2:
                continue
            hw = tags["highway"]
            k = HW_INDEX.get(hw, len(HW_LIST) - 1)
            name = tags.get("name")
            
            pts = [[px(g["lon"]), pz(g["lat"])] for g in geom]
            r_arr.append(k)
            r_arr.append(name_of(name))
            push_path(r_arr, pts)
            road_count += 1
            if name:
                named_roads += 1
        
        elif tags.get("leisure") in VERDE_SET or tags.get("landuse") in VERDE_SET:
            if len(geom) < 4:
                continue
            ring = []
            for g in geom:
                ring.append([px(g["lon"]), pz(g["lat"])])
            # Close ring
            if len(ring) > 1 and ring[0] != ring[-1]:
                pass  # already open
            elif len(ring) > 1 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
                ring = ring[:-1]
            
            if len(ring) < 3:
                continue
            s = shoelace(ring)
            if s > 0:
                ring.reverse()
            push_path(g_arr, ring)
            green_count += 1

    print(f"  Roads processed: {road_count}")
    print(f"  Roads with names: {named_roads}")
    print(f"  Green areas: {green_count}")
else:
    # Fallback: use existing city.json
    existing_path = r"C:\Users\respawn\Desktop\imobiliaria\sao-carlos.city.json"
    with open(existing_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    
    existing_names = existing.get("names", [])
    for n in existing_names:
        name_of(n)
    
    r_data = existing.get("r", [])
    ri = 0
    while ri < len(r_data):
        kind = r_data[ri]; ri += 1
        old_name_idx = r_data[ri]; ri += 1
        n_pts = r_data[ri]; ri += 1
        
        new_name_idx = -1
        if 0 <= old_name_idx < len(existing_names):
            new_name_idx = name_of(existing_names[old_name_idx])
        
        r_arr.extend([kind, new_name_idx, n_pts])
        for _ in range(n_pts * 2):
            r_arr.append(r_data[ri]); ri += 1
        road_count += 1
    
    g_arr = existing.get("g", [])
    print(f"  Roads from existing: {road_count}")
    print(f"  Greens from existing: (raw data)")


# ============================================================
# STEP 3: Process Overture buildings
# ============================================================
print("\n" + "=" * 60)
print("STEP 3: Processing Overture buildings")
print("=" * 60)

overture_path = CID.caminho("overture_bruto")
print(f"  Loading {overture_path}...")
with open(overture_path, "r", encoding="utf-8") as f:
    overture = json.load(f)

features = overture.get("features", [])
print(f"  Total features: {len(features)}")

b_arr = []
bm_arr = []
b_count = 0
skipped = 0

for i, feat in enumerate(features):
    if i % 25000 == 0 and i > 0:
        print(f"  Processed {i}/{len(features)}...")
    
    geom = feat.get("geometry", {})
    props = feat.get("properties", {})
    gtype = geom.get("type", "")
    
    if gtype == "Polygon":
        coords_list = [geom["coordinates"][0]]
    elif gtype == "MultiPolygon":
        coords_list = [poly[0] for poly in geom["coordinates"]]
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
        
        # Filtrar polígonos muito pequenos (ruído de satélite) ou gigantes
        if area < 18 or area > 260000:
            skipped += 1
            continue
        
        if s > 0:
            ring.reverse()
        
        # Simplificar polígonos com muitos vértices (suaviza bordas ruidosas)
        if len(ring) > 8:
            ring = simplify_ring(ring, tolerance=0.4)
        
        cls = classify_overture(props)
        
        h_val = props.get("height")
        nf = props.get("num_floors")
        cls_name = props.get("class", "")
        height = est_height(area, b_count, cls_name, nf, h_val)
        
        name = None
        names_obj = props.get("names")
        if names_obj and isinstance(names_obj, dict):
            primary = names_obj.get("primary")
            if primary:
                name = primary
        
        if name:
            bm_arr.extend([b_count, name_of(name), -1])
        
        b_arr.append(cls)
        b_arr.append(round(height * Q))
        push_path(b_arr, ring)
        b_count += 1

print(f"\n  Buildings processed: {b_count}")
print(f"  Skipped: {skipped}")


# ============================================================
# STEP 4: Generate city.json
# ============================================================
print("\n" + "=" * 60)
print("STEP 4: Generating city.json")
print("=" * 60)

output = {
    "v": 1,
    "c": [CENTER_LAT, CENTER_LON],
    "q": Q,
    "names": names_list,
    "b": b_arr,
    "bm": bm_arr,
    "r": r_arr,
    "g": g_arr
}

city_json_path = CID.caminho("city_bruto")
_os.makedirs(_os.path.dirname(city_json_path), exist_ok=True)
print(f"  Saving to {city_json_path}...")
city_json_str = json.dumps(output, separators=(",", ":"))
with open(city_json_path, "w", encoding="utf-8") as f:
    f.write(city_json_str)

size_mb = len(city_json_str) / 1048576
print(f"  Size: {size_mb:.1f} MB")
print(f"  Names: {len(names_list)}")
print(f"  Buildings: {b_count}")
print(f"  Roads: {road_count} ({named_roads} with names)")


# ============================================================
# STEP 5: Embed into HTML with rendering fixes
# ============================================================
# ---------------------------------------------------------------------------
# STEP 5 (patch do HTML v1) APOSENTADO em 2026-08-29. Ele reescrevia o
# `sao-carlos.html` original com uma serie de "Fix N" de z-fighting -- o primeiro elo
# da cadeia de patch que `pipeline/montar.py` substituiu. A pagina agora e montada das
# pecas em `renderizador/`. O que interessa desta etapa sao os STEPS 1-4: a malha
# viaria e as areas verdes do Overpass, mais os footprints do Overture.
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("PRONTO")
print("=" * 60)
print(f"  Buildings:     {b_count:,}")
print(f"  Roads:         {road_count:,} ({named_roads:,} with names)")
print(f"  Green areas:   {green_count:,}")
print(f"  Street names:  {len(names_list):,}")
print(f"  -> {city_json_path}")
