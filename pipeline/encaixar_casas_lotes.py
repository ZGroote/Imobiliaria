"""Encaixes ilustrativos em escala 1:1, calculados no build, nunca no browser.

Nao altera a base geografica. So volumes sinteticos principais (anel positivo,
fachada conhecida, sem nome) podem ocupar mais do lote. Muros e todas as outras
edificacoes continuam obstaculos, inclusive quando a fonte de lotes diverge.
"""
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Polygon, LineString, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

VERSION = 1


def paths(data, header, q):
    i = 0
    while i < len(data):
        meta = data[i:i + header]
        n = data[i + header]
        i += header + 1
        x = z = 0
        ring = []
        for _ in range(n):
            x += data[i]; z += data[i + 1]; i += 2
            ring.append((x / q, z / q))
        yield meta, ring


def rectangle(x, z, theta, width, depth):
    f = (math.sin(theta), math.cos(theta))
    r = (f[1], -f[0])
    return Polygon([(x + r[0]*u*width/2 + f[0]*v*depth/2,
                     z + r[1]*u*width/2 + f[1]*v*depth/2)
                    for u, v in [(-1,-1),(1,-1),(1,1),(-1,1)]])


def compile_placements(cid, city_text, pack_text, root, cache_tag=None):
    root = Path(root)
    lot_path = Path(cid.caminho('lotes'))
    if not lot_path.exists():
        # Explicit alternate source for this city, not an invented subdivision.
        candidates = cid.caminhos('lotes_visualizacao', obrigatoria=False)
        if not candidates:
            print('  sem lotes: encaixe restrito aos contornos existentes')
            return {}
        lot_path = Path(candidates[0])
    wall_path = Path(cid.caminho('muros'))
    if not wall_path.exists():
        return {}
    lot_bytes = lot_path.read_bytes(); wall_bytes = wall_path.read_bytes()
    digest = hashlib.sha256(Path(__file__).read_bytes() + str(VERSION).encode() + city_text.encode() +
                            pack_text.encode() + lot_bytes + wall_bytes +
                            json.dumps(cid._d, sort_keys=True).encode()).hexdigest()
    nome = ('encaixes-'+cid.slug+'.json') if not cache_tag else ('encaixes-%s-%s.json' % (cache_tag,cid.slug))
    output = root/'modelos_urbanos'/'v1'/'integracao'/nome
    if output.exists():
        cache = json.loads(output.read_text(encoding='utf-8'))
        if cache.get('hash') == digest:
            print('  encaixes em escala real: %d (cache validado)' % len(cache['placements']))
            return cache['placements']
    city = json.loads(city_text); assets = json.loads(pack_text)['assets']
    decoded = list(paths(city['b'], 2, city.get('q', 10)))
    buildings = [Polygon(r) for _, r in decoded]
    tree = STRtree(buildings)
    lots = []
    for ft in json.loads(lot_bytes)['features']:
        p = transform(cid.geo_para_mapa, shape(ft['geometry']))
        if p.geom_type == 'Polygon' and p.is_valid and 80 <= p.area <= 1800:
            lots.append(p)
    lot_tree = STRtree(lots)
    walls = []; x = z = 0; raw = json.loads(wall_bytes)
    for i in range(0, len(raw), 4):
        x += raw[i]; z += raw[i+1]
        if raw[i+2] or raw[i+3]:
            walls.append(LineString([(x/10,z/10),((x+raw[i+2])/10,(z+raw[i+3])/10)]))
    wall_tree = STRtree(walls)
    roads = [LineString(r).buffer(cid.meia_largura(cid.tipo_da_via(meta[0])) + .3,
                                  cap_style=3, join_style=2)
             for meta, r in paths(city['r'], 2, city.get('q', 10)) if len(r)>1]
    road_tree = STRtree(roads)
    named = set(city.get('bm', [])[::3])
    placements = {}; accepted = {}; accepted_grid = {}; examples = []
    def cells(p):
        x0,z0,x1,z1 = p.bounds
        return [(x,z) for x in range(math.floor(x0/100),math.floor(x1/100)+1)
                for z in range(math.floor(z0/100),math.floor(z1/100)+1)]
    # Stable order, independent of block streaming and variant pool lifetime.
    order = sorted(range(len(buildings)), key=lambda i: buildings[i].bounds)
    for count, i in enumerate(order):
        p = buildings[i]; meta, ring = decoded[i]
        fa = city.get('fa', [])[i] if i < len(city.get('fa', [])) else 400
        signed = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1]))
        h = meta[1]/city.get('q',10)
        if not p.is_valid or meta[0] != 1 or i in named or signed <= 0 or not 0 <= fa <= 360 or not 34 <= p.area <= 180 or h > 8:
            continue
        matches = [int(j) for j in lot_tree.query(p.centroid) if lots[j].covers(p.centroid)]
        if len(matches) != 1:
            continue
        li = matches[0]; lot = lots[li]
        if lot.intersection(p).area < p.area*.97:
            continue
        # Keep the original block axis; fa only chooses which side faces the road.
        coords = list(p.minimum_rotated_rectangle.exterior.coords)
        axes = [(b[0]-a[0],b[1]-a[1]) for a,b in zip(coords,coords[1:])]
        desired = (math.cos(math.radians(fa)),math.sin(math.radians(fa)))
        axes = [(x/math.hypot(x,z),z/math.hypot(x,z)) for x,z in axes]
        f = max(axes, key=lambda a:a[0]*desired[0]+a[1]*desired[1])
        theta = round(math.atan2(f[0],f[1]),6)
        f = (math.sin(theta),math.cos(theta)); r = (f[1],-f[0])
        dot = lambda pt, axis: pt[0]*axis[0]+pt[1]*axis[1]
        front = max(dot(pt,f) for pt in ring)
        lc = list(lot.exterior.coords)
        lot_f_min,lot_f_max=min(dot(pt,f) for pt in lc),max(dot(pt,f) for pt in lc)
        lot_r_min,lot_r_max=min(dot(pt,r) for pt in lc),max(dot(pt,r) for pt in lc)
        lot_front = lot_f_max-3
        lot_width = lot_r_max-lot_r_min
        lot_depth = lot_f_max-lot_f_min
        lateral = dot((p.centroid.x,p.centroid.y),r)
        lot_lateral = (lot_r_min+lot_r_max)/2
        # Inflate neighboring source volumes to cover their roof overhangs too.
        nearby = [int(j) for j in tree.query(lot.buffer(2)) if j != i]
        obstacles = [buildings[j].buffer(.65,join_style=2) for j in nearby]
        prior = {j for cell in cells(lot.buffer(1)) for j in accepted_grid.get(cell,[])}
        obstacles += [accepted[j].buffer(.3,join_style=2) for j in prior]
        obstacles += [walls[j].buffer(.3,cap_style=3) for j in wall_tree.query(lot)]
        obstacles += [roads[j] for j in road_tree.query(lot)]
        available = lot.buffer(-.6,join_style=2).difference(unary_union(obstacles))
        category = 'sobrados' if round((h-1.1)/3.15) >= 2 else 'casas'
        # Occupancy is a lot class, not one global percentage. Compact urban lots can
        # legitimately approach 80% built footprint; larger/open lots keep visible
        # setbacks and backyard. The class is deterministic for reproducibility.
        seed = int(hashlib.sha256(('%s:%s' % (cid.slug,i)).encode()).hexdigest()[:8],16)
        jitter=((seed>>8)&255)/255.0
        if lot.area <= 180 or lot_width <= 9.5:
            occ_target = .74 + .06*jitter      # 74..80%
            occ_cap = .82
        elif lot.area <= 300 or lot_width <= 12.5:
            occ_target = .62 + .08*jitter      # 62..70%
            occ_cap = .74
        elif lot.area <= 450:
            occ_target = .52 + .08*jitter      # 52..60%
            occ_cap = .66
        else:
            occ_target = .40 + .10*jitter      # 40..50%
            occ_cap = .58
        # Deep narrow lots tend to read better with a little more house mass.
        if lot_depth > lot_width*2.2:
            occ_target=min(occ_target+.04,occ_cap)
        target_area = min(330.0, max(p.area, lot.area*occ_target))
        min_area = min(target_area*.55, lot.area*.28)
        max_area = min(360.0, lot.area*occ_cap)
        options = []
        for ai,a in enumerate(assets):
            w,ah,d = a['size']; area = w*d
            if a['category'] != category or area < min_area or area > max_area or not h*.65 <= ah <= h*1.4:
                continue
            # Four high-value placements instead of the previous Cartesian product.
            # This keeps frontage/centering choices while cutting expensive polygon
            # covers() calls in the server-side preprocessing stage.
            positions=list(dict.fromkeys([
                (lot_front,lot_lateral),(lot_front,lateral),
                (front,lot_lateral),(front,lateral)]))
            for fr,lat in positions:
                x = round(r[0]*lat+f[0]*(fr-d/2),2)
                z = round(r[1]*lat+f[1]*(fr-d/2),2)
                box = rectangle(x,z,theta,w,d)
                if available.covers(box):
                    fit = abs(area-target_area)/max(1.0,target_area)
                    options.append((ai,x,z,box,area,math.hypot(x-p.centroid.x,z-p.centroid.y),fit))
        if not options:
            continue
        best_fit=min(o[6] for o in options)
        options=[o for o in options if o[6] <= best_fit+.12]
        # One position per variant; keep a small deterministic variety pool among
        # models that achieve nearly the same lot occupancy.
        by_asset={}
        for o in sorted(options,key=lambda o:(o[6],o[5],-o[4])):
            by_asset.setdefault(o[0],o)
        options=sorted(by_asset.values(),key=lambda o:(o[6],-o[4],o[5]))[:6]
        ai,x,z,box,area,_,_ = options[seed % len(options)]
        placements[i] = [ai,x,z,theta]
        accepted[i] = box
        for cell in cells(box):
            accepted_grid.setdefault(cell,[]).append(i)
        if len(examples)<30 or math.hypot(x+525,z+1598)<200:
            examples.append(dict(index=i,asset=assets[ai]['id'],x=x,z=z,
                                 lot_m2=round(lot.area,1),source_m2=round(p.area,1),
                                 lot_width_m=round(lot_width,1),lot_depth_m=round(lot_depth,1),
                                 target_occupancy_pct=round(occ_target*100,1),
                                 actual_occupancy_pct=round(area/lot.area*100,1),
                                 model_envelope_m2=round(area,1)))
        if len(placements)%5000 == 0:
            print('  encaixadas %d casas...' % len(placements), flush=True)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(dict(hash=digest,source=str(lot_path),placements=placements,
                                     examples=examples),separators=(',',':')),encoding='utf-8')
    print('  encaixes em escala real: %d' % len(placements))
    return placements
