# -*- coding: utf-8 -*-
"""Quanto de cada quarteirao esta coberto por LOTE. E o portao do "miolo vazio".

Quadra nao tem sobra: ela e dividida INTEIRA em terrenos. Chao que nao e lote de
ninguem aparece na tela como buraco no meio do quarteirao -- sem muro, sem quintal,
so terreno cru -- e foi assim que o defeito foi reportado.

    python pipeline/cobertura_da_quadra.py                 # cidade inteira
    python pipeline/cobertura_da_quadra.py --raio 400      # so o centro

O numero que interessa nao e so a media: e ONDE falta. Buraco a menos de 3 m da divisa
e canto de esquina e nao incomoda; buraco a mais de 15 m da divisa e o NUCLEO da quadra,
e esse e o que se ve. Medido em Sao Carlos com fundo de lote fixo em 25 m: 76,9% de
cobertura no centro, com 95% do buraco no nucleo.
"""
import json, math, os, statistics, sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega
from shapely.geometry import shape
from shapely.ops import unary_union, transform
from shapely.strtree import STRtree

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
a = sys.argv
RAIO = float(a[a.index("--raio") + 1]) if "--raio" in a else None
CX = float(a[a.index("--cx") + 1]) if "--cx" in a else 0.0
CZ = float(a[a.index("--cz") + 1]) if "--cz" in a else 0.0

M = lambda g: transform(lambda x, y, z=None: CID.geo_para_mapa(x, y), g)

mio = [M(shape(f["geometry"]))
       for f in json.load(open(CID.caminho("miolo"), encoding="utf-8"))["features"]]
lot = [M(shape(f["geometry"]))
       for f in json.load(open(CID.caminho("lotes"), encoding="utf-8"))["features"]]
print("%s: %d quarteiroes (miolo), %d lotes" % (CID.slug, len(mio), len(lot)))

sel = [m for m in mio if m.is_valid and m.area > 50]
if RAIO:
    sel = [m for m in sel if abs(m.centroid.x - CX) < RAIO and abs(m.centroid.y - CZ) < RAIO]
    print("recorte de %.0f m em torno de (%.0f, %.0f): %d quarteiroes" % (RAIO, CX, CZ, len(sel)))

tree = STRtree(lot)
tot_m = tot_l = 0.0
fr = []
faixa = {}
buraco = 0.0
for m in sel:
    ls = [lot[j] for j in tree.query(m)]
    u = unary_union([l.intersection(m) for l in ls if l.is_valid]) if ls else None
    a_l = u.area if u is not None else 0.0
    tot_m += m.area
    tot_l += a_l
    fr.append(a_l / m.area if m.area else 0.0)
    falta = m.difference(u) if u is not None else m
    if falta.is_empty:
        continue
    ps = [falta] if falta.geom_type == "Polygon" else list(getattr(falta, "geoms", []))
    for p in ps:
        if p.geom_type != "Polygon" or p.area < 2:
            continue
        d = p.representative_point().distance(m.exterior)
        k = ("borda (<3 m)" if d < 3 else "meio (3-15 m)" if d < 15 else "NUCLEO (>15 m)")
        e = faixa.setdefault(k, [0, 0.0])
        e[0] += 1
        e[1] += p.area
        buraco += p.area

print("COBERTURA: %.1f%%  (%.1f ha de lote em %.1f ha de quadra)"
      % (100 * tot_l / tot_m, tot_l / 1e4, tot_m / 1e4))
fr.sort()
print("  por quarteirao: pior %.0f%% | p10 %.0f%% | mediana %.0f%% | melhor %.0f%%"
      % (100 * fr[0], 100 * fr[len(fr) // 10], 100 * statistics.median(fr), 100 * fr[-1]))
print("  abaixo de 85%%: %d de %d quarteiroes" % (sum(1 for f in fr if f < 0.85), len(fr)))
print("ONDE FALTA (%.2f ha):" % (buraco / 1e4))
for k in ("borda (<3 m)", "meio (3-15 m)", "NUCLEO (>15 m)"):
    n, ar = faixa.get(k, [0, 0.0])
    print("  %-16s %5d pedacos | %6.2f ha | %4.1f%%"
          % (k, n, ar / 1e4, 100 * ar / buraco if buraco else 0))
