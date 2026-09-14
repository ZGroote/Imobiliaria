# -*- coding: utf-8 -*-
"""Recorta o lote oficial pelo MIOLO -- o passo que faltava, e que os portoes cobraram.

O erro que isto conserta: eu tratei a quadra oficial como se ela JA fosse o miolo,
porque ela de fato para na divisa (medido: area dos lotes / area da quadra = 1,00).
Mas o miolo nao e "a quadra menos a rua real" -- e a quadra menos a rua COMO O
RENDERIZADOR A DESENHA, que e `ROAD_W/2 * mul_fita` do eixo, mais larga que a rua de
verdade. Entao o lote cadastral, corretamente posto na divisa, cai debaixo da fita
desenhada.

Os quatro portoes de geometria reprovados diziam exatamente isso:

    muro sobre a rua                11,80 %   (limite 1,00) -- 1.413 km de 11.975
    lote sobre a rua                 3,66 %   (limite 1,00)
    frente do lote encostada na rua   0,61 m  (limite 0,25)
    casa sobre a rua                 3,53 %   (limite 1,00) -- 16.530 volumes

E a MESMA operacao que o `juntar_lotes.recorta` aplica no lote de planta, com o mesmo
`simplify(0.3)` -- que existe pra tirar a serrilha que a borda da fita deixa na frente
do lote. Aqui ela e aplicada ao lote de cadastro, que nao passa pelo juntar_lotes.

Roda DEPOIS da etapa 2 (que gera o miolo a partir das quadras oficiais) e ANTES da 5.

  python pipeline/fontes/recorta_lotes_oficiais.py
"""
import collections, io, json, os, sys, time

from shapely.geometry import shape, mapping
from shapely.ops import transform as sht, unary_union
from pyproj import Transformer

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
sys.stdout.reconfigure(encoding="utf-8")
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "ribeirao-preto"))
AREA_MIN = CID.lote.get("area_min_m2", 35.0)
FGEO = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
IGEO = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)
ugeo = lambda g: sht(lambda x, y, z=None: FGEO.transform(x, y), g)
degeo = lambda g: sht(lambda x, y, z=None: IGEO.transform(x, y), g)

t0 = time.time()

mi = json.load(io.open(CID.caminho("miolo"), encoding="utf-8"))
ped = collections.defaultdict(list)
for f in mi["features"]:
    if not f.get("geometry"): continue
    g = ugeo(shape(f["geometry"]))
    if not g.is_valid: g = g.buffer(0)
    if not g.is_empty: ped[f["properties"]["id"]].append(g)
MIOLO = {k: (v[0] if len(v) == 1 else unary_union(v)) for k, v in ped.items()}
print("miolo: %d quadras  (%.0fs)" % (len(MIOLO), time.time() - t0))

lo = json.load(io.open(CID.caminho("lotes"), encoding="utf-8"))
print("lotes de entrada: %d" % len(lo["features"]))

saida, cont = [], collections.Counter()
for f in lo["features"]:
    if not f.get("geometry"): cont["sem geometria"] += 1; continue
    qi = f["properties"].get("quadra")
    M = MIOLO.get(qi)
    if M is None:
        # quadra sem miolo: a etapa 2 nao a reconheceu. Manter o lote inteiro seria
        # reintroduzir exatamente o defeito que este script existe pra tirar.
        cont["quadra sem miolo"] += 1
        continue
    p = ugeo(shape(f["geometry"]))
    if not p.is_valid: p = p.buffer(0)
    try: p = p.intersection(M)
    except Exception: cont["intersecao falhou"] += 1; continue
    if p.is_empty: cont["sumiu no recorte"] += 1; continue
    if p.geom_type == "MultiPolygon": p = max(p.geoms, key=lambda g: g.area)
    if p.geom_type != "Polygon" or p.area < AREA_MIN:
        cont["menor que %.0f m2" % AREA_MIN] += 1; continue
    p = p.simplify(0.3)
    if p.geom_type != "Polygon" or p.area < AREA_MIN or not p.is_valid:
        cont["invalido apos simplify"] += 1; continue
    q = dict(f["properties"])
    q["area_m2"] = round(p.area, 1)
    c = p.centroid
    q["fx"] = round(c.x, 1); q["fy"] = round(c.y, 1)
    saida.append({"type": "Feature", "geometry": mapping(degeo(p)), "properties": q})

# `lid` TEM que ser o indice da feicao: a etapa 5 grava INDICES, nao ids (PADRAO.md).
for i, f in enumerate(saida): f["properties"]["lid"] = i

alvo = CID.caminho("lotes")
io.open(alvo, "w", encoding="utf-8").write(json.dumps(
    {"type": "FeatureCollection", "features": saida}, ensure_ascii=False))
print("lotes recortados: %d  (%.1f%% preservados)"
      % (len(saida), 100.0 * len(saida) / len(lo["features"])))
for k, v in cont.most_common(): print("  descartado - %-26s %d" % (k, v))
print("-> %s  (%.1f MB, %.0fs)"
      % (os.path.relpath(alvo, RAIZ), os.path.getsize(alvo) / 1048576, time.time() - t0))
