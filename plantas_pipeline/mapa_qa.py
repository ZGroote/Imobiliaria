# -*- coding: utf-8 -*-
"""PNG de conferencia da cidade inteira: lotes extraidos sobre as quadras oficiais."""
import json, sys
from PIL import Image, ImageDraw
from shapely.geometry import shape
from shapely.ops import transform as sht
from pyproj import Transformer
F = Transformer.from_crs("EPSG:4326", "EPSG:29193", always_xy=True)
def u(x, y, z=None): return F.transform(x, y)
P = "C:/Users/respawn/Desktop/imobiliaria/"
q = json.load(open(P + "quadras_saocarlos.geojson", encoding="utf-8"))
qs = [sht(u, shape(f["geometry"])) for f in q["features"]]
d = json.load(open(P + (sys.argv[1] if len(sys.argv) > 1 else "lotes_oficiais_saocarlos.geojson"), encoding="utf-8"))
xs = [g.bounds for g in qs]
minx = min(b[0] for b in xs); miny = min(b[1] for b in xs)
maxx = max(b[2] for b in xs); maxy = max(b[3] for b in xs)
W = 2400; H = int(W * (maxy - miny) / (maxx - minx))
im = Image.new("RGB", (W, H), (255, 255, 255)); dr = ImageDraw.Draw(im, "RGBA")
sx = lambda x: (x - minx) / (maxx - minx) * W
sy = lambda y: (maxy - y) / (maxy - miny) * H
for g in qs:
    for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
        dr.polygon([(sx(a), sy(b)) for a, b in p.exterior.coords], fill=(220, 228, 238, 255))
for f in d["features"]:
    pr = f["properties"]; i = pr.get("encaixe") or 0
    c = (26, 127, 55) if i >= .7 else (191, 135, 0) if i >= .5 else (207, 34, 46)
    g = sht(u, shape(f["geometry"]))
    for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
        try: dr.polygon([(sx(a), sy(b)) for a, b in p.exterior.coords], fill=c + (170,))
        except Exception: pass
im.save(P + "plantas_pipeline/saida/qa_cidade.png")
print("ok", im.size, "| lotes", len(d["features"]))
