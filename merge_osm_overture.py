"""
Cruza espacialmente os contornos de edificios do Overture (completos, ~122 mil)
com as tags de edificios do OSM (semanticamente ricas: building=, amenity=,
shop=, name, addr:*, building:levels) recem-baixadas via fetch_osm_buildings.py.

Quando um edificio OSM cai dentro (ou perto) de um contorno Overture, herda
classificacao/nome/endereco/altura do OSM. Sem match, mantem o fallback
heuristico atual do Overture. A geometria usada e sempre a do Overture.

Tambem normaliza o pool de names[] (dedupe por diferenca de capitalizacao).

Gera sao-carlos-overture-v2.city.json (nao sobrescreve o dataset atual).
"""

import json
import math
import re
import sys

BASE = r"C:\Users\respawn\Desktop\imobiliaria"

# ---- Config (mesma projecao local de todos os outros scripts) ----
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# Centro e fontes saem do JSON da cidade; estavam escritos aqui.
CENTER_LAT = CID.clat
CENTER_LON = CID.clon
Q = 10  # decimetros
MLAT = 111132.92
MLON = 111319.49 * math.cos(CENTER_LAT * math.pi / 180)
MATCH_TOLERANCE_M = 18.0
CELL_SIZE = 25.0  # metros, grade do indice espacial
RESIDENTIAL_GUESS_MAX_AREA = 350.0  # m2: acima disso, sem fonte confirmada, fica "sem uso" mesmo

LV = 3.15
BY_TYPE = {
    "church": 16, "cathedral": 24, "chapel": 9, "temple": 14, "apartments": 19,
    "residential": 7, "house": 4.2, "detached": 4.2, "bungalow": 3.6, "terrace": 5.2,
    "hotel": 22, "commercial": 11, "office": 16, "retail": 6.5, "supermarket": 8,
    "kiosk": 3.2, "industrial": 9, "warehouse": 8.5, "garage": 3, "garages": 3,
    "roof": 3.4, "school": 8, "university": 12, "college": 11, "hospital": 16,
    "civic": 11, "government": 14, "train_station": 12, "transportation": 10,
    "hall": 9, "sports_hall": 11,
}
CIVIC_RE = re.compile(r"^(church|cathedral|chapel|temple|civic|government|school|university|college|hospital|train_station|public)$")
RES_RE = re.compile(r"^(house|apartments|residential|detached|terrace|bungalow|semidetached_house|dormitory)$")


def px(lon):
    return (lon - CENTER_LON) * MLON


def pz(lat):
    return -(lat - CENTER_LAT) * MLAT


def simple_hash(val):
    h = 2166136261 ^ (int(val) & 0xFFFFFFFF)
    h = (h ^ (h >> 15)) * 2246822507 & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 3266489909 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296


def shoelace(ring):
    s = 0
    n = len(ring)
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % n]
        s += a[0] * b[1] - b[0] * a[1]
    return s


def process_ring(coords):
    ring = [[px(c[0]), pz(c[1])] for c in coords]
    if len(ring) > 1 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
        ring = ring[:-1]
    return ring


def simplify_ring(ring, tolerance=0.4):
    """Douglas-Peucker: suaviza contornos ruidosos do Overture (mesma logica de rebuild_city.py)."""
    if len(ring) <= 4:
        return ring

    def perpendicular_distance(point, line_start, line_end):
        dx = line_end[0] - line_start[0]
        dz = line_end[1] - line_start[1]
        if dx == 0 and dz == 0:
            return math.hypot(point[0] - line_start[0], point[1] - line_start[1])
        t = max(0, min(1, ((point[0] - line_start[0]) * dx + (point[1] - line_start[1]) * dz) / (dx * dx + dz * dz)))
        proj_x = line_start[0] + t * dx
        proj_z = line_start[1] + t * dz
        return math.hypot(point[0] - proj_x, point[1] - proj_z)

    def dp(points, eps):
        if len(points) <= 2:
            return points
        dmax, idx = 0, 0
        for i in range(1, len(points) - 1):
            d = perpendicular_distance(points[i], points[0], points[-1])
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            left = dp(points[:idx + 1], eps)
            right = dp(points[idx:], eps)
            return left[:-1] + right
        return [points[0], points[-1]]

    result = dp(ring, tolerance)
    if len(result) < 3:
        return ring
    return result


def point_in_ring(pt, ring):
    x, z = pt
    hit = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        a, b = ring[i], ring[j]
        if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]:
            hit = not hit
        j = i
    return hit


def push_path(arr, pts):
    arr.append(len(pts))
    lx, lz = 0, 0
    for p in pts:
        x = round(p[0] * Q)
        z = round(p[1] * Q)
        arr.append(x - lx)
        arr.append(z - lz)
        lx, lz = x, z


# ---- Nome pool com normalizacao (dedupe por capitalizacao) ----
names_list = []
canon_idx = {}


def name_of(s):
    if s is None:
        return -1
    s = s.strip()
    if not s:
        return -1
    key = s.casefold()
    if key in canon_idx:
        return canon_idx[key]
    idx = len(names_list)
    canon_idx[key] = idx
    names_list.append(s)
    return idx


# ---- Fallback do Overture (mantido igual ao convert_overture.py) ----
def est_height_overture(area, building_id, cls_name="", num_floors=None, height=None):
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
    if cls in ("residential", "house", "apartments", "detached", "terrace", "bungalow"):
        return 1
    if cls in ("commercial", "retail", "office", "industrial", "warehouse", "hotel", "kiosk", "supermarket"):
        return 2
    if cls in ("church", "cathedral", "chapel", "temple", "civic", "government",
               "school", "university", "college", "hospital", "train_station", "public"):
        return 3
    return 0


# ---- Portas Python das funcoes JS classify()/estHeight() (sao-carlos.html:235-255) ----
def classify_poi(tags):
    if (tags.get("amenity") in ("place_of_worship", "school", "hospital", "townhall") or
            tags.get("historic") or tags.get("tourism") == "museum" or
            tags.get("office") == "government"):
        return 3
    if tags.get("shop") or tags.get("amenity") or tags.get("office") or tags.get("tourism") or tags.get("craft"):
        return 2
    return 0


def classify_osm(tags):
    kind = tags.get("building") if tags.get("building") != "yes" else ""
    kind = kind or ""
    if (CIVIC_RE.match(kind) or tags.get("amenity") == "place_of_worship" or
            tags.get("amenity") == "school" or tags.get("amenity") == "hospital" or
            tags.get("amenity") == "townhall" or tags.get("historic") or
            tags.get("railway") == "station" or tags.get("tourism") == "museum" or
            tags.get("office") == "government"):
        return 3
    if (tags.get("shop") or tags.get("amenity") or tags.get("office") or
            tags.get("tourism") or tags.get("craft") or
            re.match(r"^(retail|commercial|supermarket|hotel|kiosk|office|industrial|warehouse)$", kind)):
        return 2
    if RES_RE.match(kind):
        return 1
    return 0


def _num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return None


def est_height_osm(tags, area, building_id):
    h = _num(tags.get("height")) or _num(tags.get("building:height"))
    if h and 1.5 < h < 260:
        return h
    lv = _num(tags.get("building:levels")) or _num(tags.get("levels"))
    if lv and 1 <= lv < 70:
        return lv * LV + 1.1
    kind = tags.get("building") if tags.get("building") != "yes" else ""
    kind = kind or tags.get("amenity") or (tags.get("shop") and "retail") or ""
    base = BY_TYPE.get(kind)
    if base is None:
        base = 12 if area > 2400 else 8 if area > 900 else 5.6 if area > 320 else 3.9
    return base * (0.82 + simple_hash(building_id) * 0.42)


def main():
    # 1. Carrega e projeta os edificios do Overture (geometria + area, sem decidir atributos ainda)
    print("Carregando overture_buildings.geojson...")
    with open(CID.caminho("overture_bruto"), "r", encoding="utf-8") as f:
        overture_raw = json.load(f)

    overture = []  # lista de dicts: ring, area, props
    skipped = 0
    for feat in overture_raw["features"]:
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
            if area < 14 or area > 260000:
                skipped += 1
                continue
            if s > 0:
                ring.reverse()
            if len(ring) > 8:
                ring = simplify_ring(ring, tolerance=0.4)
            x0 = min(p[0] for p in ring); x1 = max(p[0] for p in ring)
            z0 = min(p[1] for p in ring); z1 = max(p[1] for p in ring)
            overture.append({"ring": ring, "area": area, "props": props,
                              "bbox": (x0, z0, x1, z1), "centroid": None})
    print(f"  Overture: {len(overture)} poligonos validos ({skipped} descartados)")

    # 2. Indice espacial em grade sobre os bboxes do Overture
    print("Construindo indice espacial...")
    grid = {}

    def cells_for_bbox(bbox):
        x0, z0, x1, z1 = bbox
        cx0, cx1 = math.floor(x0 / CELL_SIZE), math.floor(x1 / CELL_SIZE)
        cz0, cz1 = math.floor(z0 / CELL_SIZE), math.floor(z1 / CELL_SIZE)
        for cx in range(cx0, cx1 + 1):
            for cz in range(cz0, cz1 + 1):
                yield (cx, cz)

    for idx, ob in enumerate(overture):
        for cell in cells_for_bbox(ob["bbox"]):
            grid.setdefault(cell, []).append(idx)
    print(f"  {len(grid)} celulas ocupadas")

    # 3. Carrega edificios OSM e faz o match
    print("Carregando osm_buildings_raw.json...")
    with open(CID.caminho("osm_predios"), "r", encoding="utf-8") as f:
        osm_raw = json.load(f)

    match = {}  # overture_idx -> (osm_way, dist)
    matched_direct = 0
    matched_fallback = 0
    no_match = 0
    osm_skipped = 0

    for el in osm_raw.get("elements", []):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry")
        tags = el.get("tags") or {}
        if not geom or len(geom) < 3 or not tags.get("building"):
            osm_skipped += 1
            continue
        pts = [(px(g["lon"]), pz(g["lat"])) for g in geom]
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)

        c0x, c0z = math.floor(cx / CELL_SIZE), math.floor(cz / CELL_SIZE)
        candidates = set()
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                candidates.update(grid.get((c0x + dx, c0z + dz), []))

        if not candidates:
            no_match += 1
            continue

        # Tenta point-in-polygon primeiro
        direct_hit = None
        for oi in candidates:
            if point_in_ring((cx, cz), overture[oi]["ring"]):
                direct_hit = oi
                break

        if direct_hit is not None:
            best_oi, dist = direct_hit, 0.0
            matched_direct += 1
        else:
            # Fallback: centroide Overture mais proximo, dentro da tolerancia
            best_oi, best_dist = None, 1e18
            for oi in candidates:
                ob = overture[oi]
                if ob["centroid"] is None:
                    r = ob["ring"]
                    mx = sum(p[0] for p in r) / len(r)
                    mz = sum(p[1] for p in r) / len(r)
                    ob["centroid"] = (mx, mz)
                ocx, ocz = ob["centroid"]
                d = math.hypot(cx - ocx, cz - ocz)
                if d < best_dist:
                    best_dist = d
                    best_oi = oi
            if best_oi is None or best_dist > MATCH_TOLERANCE_M:
                no_match += 1
                continue
            best_oi, dist = best_oi, best_dist
            matched_fallback += 1

        prev = match.get(best_oi)
        if prev is None or dist < prev[1]:
            match[best_oi] = (el, dist)

    print(f"  OSM buildings processados: {matched_direct + matched_fallback + no_match} "
          f"({osm_skipped} sem geometria/tag building)")
    print(f"  Match direto (point-in-polygon): {matched_direct}")
    print(f"  Match por proximidade (<= {MATCH_TOLERANCE_M:.0f}m): {matched_fallback}")
    print(f"  Sem match: {no_match}")
    print(f"  Overture buildings com atributos herdados do OSM: {len(match)} de {len(overture)}")

    # 3b. Segunda fonte: POIs do OSM (nos de comercio/servico/instituicao) --
    # muito mais numerosos que "way[building]" nesta cidade. Se um POI cai
    # dentro de um contorno Overture, o predio herda nome/uso do POI quando
    # ainda nao tiver um (o building-way normalmente nao tem nome, so o POI).
    poi_match = {}  # overture_idx -> tags do POI (so guarda o 1o com nome, senao o 1o qualquer)
    poi_direct = 0
    poi_no_match = 0
    try:
        with open(CID.caminho("osm_pois"), "r", encoding="utf-8") as f:
            poi_raw = json.load(f)
    except FileNotFoundError:
        poi_raw = {"elements": []}

    for el in poi_raw.get("elements", []):
        tags = el.get("tags") or {}
        if not tags:
            continue
        if el.get("type") == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        cx, cz = px(lon), pz(lat)
        c0x, c0z = math.floor(cx / CELL_SIZE), math.floor(cz / CELL_SIZE)
        candidates = set()
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                candidates.update(grid.get((c0x + dx, c0z + dz), []))
        for oi in candidates:
            if point_in_ring((cx, cz), overture[oi]["ring"]):
                prev = poi_match.get(oi)
                if prev is None or (not prev.get("name") and tags.get("name")):
                    poi_match[oi] = tags
                poi_direct += 1
                break
        else:
            poi_no_match += 1

    print(f"\n  POIs OSM processados: {poi_direct + poi_no_match}")
    print(f"  POIs dentro de um contorno Overture: {poi_direct}")
    print(f"  Overture buildings com POI associado: {len(poi_match)} de {len(overture)}")

    # 4. Monta b[]/bm[] finais, herdando atributos quando ha match
    print("\nGerando b[]/bm[]...")
    b_arr = []
    bm_arr = []
    b_count = 0
    cls_counter = {0: 0, 1: 0, 2: 0, 3: 0}
    named_count = 0
    guessed_residential = 0

    for idx, ob in enumerate(overture):
        ring, area, props = ob["ring"], ob["area"], ob["props"]
        m = match.get(idx)
        if m is not None:
            tags = m[0].get("tags") or {}
            cls = classify_osm(tags)
            height = est_height_osm(tags, area, b_count)
            name = tags.get("name")
            addr = ", ".join(x for x in (tags.get("addr:street"), tags.get("addr:housenumber")) if x) or None
        else:
            cls = classify_overture(props)
            h_val = props.get("height")
            nf = props.get("num_floors")
            cls_name = props.get("class", "")
            height = est_height_overture(area, b_count, cls_name, nf, h_val)
            name = None
            names_obj = props.get("names")
            if names_obj and isinstance(names_obj, dict):
                name = names_obj.get("primary")
            addr = None

        # Camada extra: POI dentro do contorno preenche nome/uso que ainda faltar
        # (building-ways raramente tem nome; quem tem e o node do comercio/servico).
        poi_tags = poi_match.get(idx)
        if poi_tags is not None:
            if not name and poi_tags.get("name"):
                name = poi_tags.get("name")
            if not addr:
                poi_addr = ", ".join(x for x in (poi_tags.get("addr:street"), poi_tags.get("addr:housenumber")) if x) or None
                addr = addr or poi_addr
            if cls == 0:
                poi_cls = classify_poi(poi_tags)
                if poi_cls != 0:
                    cls = poi_cls

        # Estimativa por tamanho: sem nenhuma fonte confirmada (OSM/POI/Overture),
        # contornos pequenos (faixa tipica de lote residencial) sao marcados como
        # residencial por probabilidade, nao por confirmacao. Contornos maiores
        # ficam sem uso mapeado (nao ha base para adivinhar o que sao).
        guessed = False
        if cls == 0 and area <= RESIDENTIAL_GUESS_MAX_AREA:
            cls = 1
            guessed = True

        if name or addr:
            bm_arr.extend([b_count, name_of(name), name_of(addr)])
            if name:
                named_count += 1
        if guessed:
            guessed_residential += 1

        cls_counter[cls] += 1
        b_arr.append(cls)
        b_arr.append(round(height * Q))
        push_path(b_arr, ring)
        b_count += 1

        if b_count % 20000 == 0:
            print(f"  {b_count}/{len(overture)}...")

    print(f"\nTotal de edificios: {b_count}")
    print(f"Classe: {cls_counter} "
          f"({', '.join(f'{k}={v/b_count*100:.1f}%' for k, v in sorted(cls_counter.items()))})")
    print(f"  (dos residenciais, {guessed_residential} sao estimativa por tamanho de lote, sem confirmacao)")
    print(f"Nomeados: {named_count} ({named_count/b_count*100:.2f}%)")

    # 5. Reaproveita r[]/g[] do dataset atual, remapeando indices de nome com a normalizacao nova
    print("\nCarregando ruas/areas verdes de sao-carlos-overture.city.json...")
    with open(CID.caminho("city_bruto"), "r", encoding="utf-8") as f:
        existing = json.load(f)

    existing_names = existing.get("names", [])
    remap = {old_idx: name_of(n) for old_idx, n in enumerate(existing_names)}

    r_data = existing.get("r", [])
    new_r = []
    ri = 0
    while ri < len(r_data):
        kind = r_data[ri]; ri += 1
        old_name_idx = r_data[ri]; ri += 1
        n_pts = r_data[ri]; ri += 1
        new_name_idx = remap.get(old_name_idx, -1) if old_name_idx >= 0 else -1
        new_r.extend([kind, new_name_idx, n_pts])
        for _ in range(n_pts * 2):
            new_r.append(r_data[ri]); ri += 1

    output = {
        "v": 1,
        "c": [CENTER_LAT, CENTER_LON],
        "q": Q,
        "names": names_list,
        "b": b_arr,
        "bm": bm_arr,
        "r": new_r,
        "g": existing.get("g", []),
    }

    out_path = CID.caminho("city_v2")
    _os.makedirs(_os.path.dirname(out_path), exist_ok=True)
    print(f"\nSalvando {out_path}...")
    json_str = json.dumps(output, separators=(",", ":"), ensure_ascii=False)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(json_str)
    print(f"  Tamanho: {len(json_str)/1048576:.1f} MB")
    print(f"  Nomes no pool: {len(names_list)}")
    print("\n=== Concluido ===")


if __name__ == "__main__":
    main()
