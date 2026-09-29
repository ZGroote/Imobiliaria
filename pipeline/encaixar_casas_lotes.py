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
        lot_front = max(dot(pt,f) for pt in lc)-3
        lateral = dot((p.centroid.x,p.centroid.y),r)
        lot_lateral = (min(dot(pt,r) for pt in lc)+max(dot(pt,r) for pt in lc))/2
        # Inflate neighboring source volumes to cover their roof overhangs too.
        nearby = [int(j) for j in tree.query(lot.buffer(2)) if j != i]
        obstacles = [buildings[j].buffer(.65,join_style=2) for j in nearby]
        prior = {j for cell in cells(lot.buffer(1)) for j in accepted_grid.get(cell,[])}
        obstacles += [accepted[j].buffer(.3,join_style=2) for j in prior]
        obstacles += [walls[j].buffer(.3,cap_style=3) for j in wall_tree.query(lot)]
        obstacles += [roads[j] for j in road_tree.query(lot)]
        available = lot.buffer(-.6,join_style=2).difference(unary_union(obstacles))
        category = 'sobrados' if round((h-1.1)/3.15) >= 2 else 'casas'
        options = []
        for ai,a in enumerate(assets):
            w,ah,d = a['size']; area = w*d
            if a['category'] != category or area < p.area*.85 or area > lot.area*.65 or not h*.65 <= ah <= h*1.4:
                continue
            for fr in dict.fromkeys([front,lot_front,front-2]):
                for lat in dict.fromkeys([lateral,lot_lateral]):
                    x = round(r[0]*lat+f[0]*(fr-d/2),2)
                    z = round(r[1]*lat+f[1]*(fr-d/2),2)
                    box = rectangle(x,z,theta,w,d)
                    if available.covers(box):
                        options.append((ai,x,z,box,area,math.hypot(x-p.centroid.x,z-p.centroid.y)))
        if not options:
            continue
        max_area = max(o[4] for o in options)
        options = [o for o in options if o[4] >= max_area*.9]
        # One position per variant; favor staying near its original frontage.
        by_asset = {}
        for o in sorted(options,key=lambda o:o[5]):
            by_asset.setdefault(o[0],o)
        options = list(by_asset.values())
        seed = int(hashlib.sha256(('%s:%s' % (cid.slug,i)).encode()).hexdigest()[:8],16)
        ai,x,z,box,area,_ = options[seed % len(options)]
        placements[i] = [ai,x,z,theta]
        accepted[i] = box
        for cell in cells(box):
            accepted_grid.setdefault(cell,[]).append(i)
        if len(examples)<30 or math.hypot(x+525,z+1598)<200:
            examples.append(dict(index=i,asset=assets[ai]['id'],x=x,z=z,
                                 lot_m2=round(lot.area,1),source_m2=round(p.area,1),
                                 model_envelope_m2=round(area,1)))
        if len(placements)%5000 == 0:
            print('  encaixadas %d casas...' % len(placements), flush=True)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(dict(hash=digest,source=str(lot_path),placements=placements,
                                     examples=examples),separators=(',',':')),encoding='utf-8')
    print('  encaixes em escala real: %d' % len(placements))
    return placements
