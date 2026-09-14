# -*- coding: utf-8 -*-
"""Exporta o conjunto ROTULADO pra validar classificador de satelite.

POSITIVO (construido): lote com ponto de endereco do SigaSC dentro. O cadastro da
  prefeitura so emite endereco pra imovel - e a evidencia mais forte que existe aqui.
NEGATIVO (provavelmente vazio): lote SEM endereco e SEM footprint do Overture, mas
  numa quadra que TEM endereco. A quadra estar cadastrada e o que importa: sem esse
  cuidado, "quadra sem endereco" viraria negativo quando na verdade e area ainda nao
  levantada pelo cadastro, e o classificador seria punido por acertar.

  python v7/pipeline/exporta_gabarito.py
"""
import json, math, os
from collections import defaultdict
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform as sht
from shapely.strtree import STRtree
from pyproj import Transformer

AQUI = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.abspath(os.path.join(AQUI, "..")) + "/"
ROOT = os.path.abspath(os.path.join(V7, "..")) + "/"
FWD = Transformer.from_crs('EPSG:4326', 'EPSG:29193', always_xy=True)
CLAT, CLON = -22.01725, -47.89080
MLAT = 111132.92; MLON = 111319.49 * math.cos(CLAT * math.pi / 180)


def main():
    lots = json.load(open(V7 + "dados/lotes_saocarlos_completo.geojson", encoding="utf-8"))
    lg = [sht(lambda x, y, z=None: FWD.transform(x, y), shape(f["geometry"])) for f in lots["features"]]
    tree = STRtree(lg)

    end = [Point(e, n) for e, n in json.load(open(V7 + "dados/address_points.json"))]
    com_end = set()
    for p in end:
        for i in tree.query(p):
            if lg[i].contains(p): com_end.add(i); break

    # footprint residencial do Overture (cls 0/1) - evidencia mais fraca, so pra excluir
    city = json.load(open(ROOT + "v4/sao-carlos-v4.city.json", encoding="utf-8"))
    b = city["b"]; Q = city["q"]; i = 0; n = len(b); com_fp = set()
    while i < n:
        cls, h, npt = b[i], b[i + 1], b[i + 2]; i += 3
        lx = lz = 0; sx = sz = 0
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2; sx += lx; sz += lz
        if cls in (0, 1):
            mx = sx / npt / Q; mz = sz / npt / Q
            p = Point(*FWD.transform(CLON + mx / MLON, CLAT - mz / MLAT))
            for j in tree.query(p):
                if lg[j].contains(p): com_fp.add(j); break

    porq = defaultdict(list)
    for i, f in enumerate(lots["features"]):
        porq[f["properties"].get("quadra")].append(i)
    quadra_cadastrada = {q for q, idx in porq.items() if any(i in com_end for i in idx)}

    feats = []
    pos = neg = 0
    for i, f in enumerate(lots["features"]):
        pr = f["properties"]
        if i in com_end:
            rot = "construido"; pos += 1
        elif (pr.get("quadra") in quadra_cadastrada and i not in com_fp):
            rot = "provavelmente_vazio"; neg += 1
        else:
            continue
        # frente do lote: o classificador precisa dela pro buffer proporcional
        try:
            r = list(lg[i].minimum_rotated_rectangle.exterior.coords)[:4]
            a = math.dist(r[0], r[1]); c = math.dist(r[1], r[2]); frente = round(min(a, c), 2)
        except Exception:
            frente = None
        feats.append({"type": "Feature", "geometry": f["geometry"],
                      "properties": {"idx": i, "rotulo": rot, "quadra": pr.get("quadra"),
                                     "loteamento": pr.get("loteamento"), "fonte": pr.get("fonte"),
                                     "area_m2": pr.get("area_m2"), "frente_m": frente,
                                     # recuo sugerido: 2 m NAO serve em lote de 5-6 m de frente
                                     "buffer_sugerido_m": round(min(2.0, (frente or 10) * 0.18), 2)}})
    saida = V7 + "dados/gabarito_ocupacao.geojson"
    json.dump({"type": "FeatureCollection", "features": feats}, open(saida, "w"))
    print("gabarito: %d lotes rotulados" % len(feats))
    print("  construido            %6d  (ponto de endereco do SigaSC dentro)" % pos)
    print("  provavelmente_vazio   %6d  (sem endereco e sem footprint, em quadra cadastrada)" % neg)
    print("  quadras cadastradas: %d de %d" % (len(quadra_cadastrada), len(porq)))
    print("-> %s (%.1f MB)" % (saida, os.path.getsize(saida) / 1e6))


if __name__ == "__main__":
    main()
