"""Regression at three visible vacant positions from the reported block."""
import json, sys
from pathlib import Path
from shapely.geometry import Point, Polygon
OUT = Path(__file__).resolve().parent
samples = json.loads((OUT/'vazio-antes.json').read_text())['vacantSamples']
data = json.loads((OUT/'terrenos.json').read_text())['parcels']
hits = []
for x, z in samples:
    point = Point(x, z)
    matches = []
    for p in data:
        if abs(p['x']-x)>200 or abs(p['z']-z)>200:
            continue
        if any(Polygon(list(zip(t[1::2],t[2::2]))).covers(point) for t in p['ground']):
            matches.append(p['lot'])
    hits.append(matches)
before = '--antes' in sys.argv
assert all(hits) if before else not any(hits), hits
assert len({p['style'] for p in data}) == 40
report = {'parcels':len(data),'props':sum(len(p['props']) for p in data),'vacantPointGroundHits':hits,'styles':40,'passed':True}
(OUT/('vazio-geometria-antes.json' if before else 'vazio-geometria-depois.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
