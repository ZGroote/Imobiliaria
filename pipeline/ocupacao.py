# -*- coding: utf-8 -*-
"""Marca quais lotes tem PROVA de que existe construcao neles.

Ate aqui o mapa punha casa em TODO lote - 77% delas sem nenhuma evidencia. No raio
de 450 m do Moradas Sao Carlos I eram 635 casas para 13 enderecos conhecidos.

Duas provas, as mesmas que o occupancy_v2 usava antes de o preenchimento total ser
ligado:
  1. ponto de endereco do SigaSC dentro do lote (54.111 pontos), com tolerancia de
     8 m pro ponto que cai na calcada;
  2. centroide de footprint residencial (cls 0/1) do Overture/OSM dentro do lote.

  python pipeline/ocupacao.py     # -> v7/dados/lotes_ocupados.json
"""
import json, math, os
import numpy as np
from shapely.geometry import shape, Point
from shapely.ops import transform as sht
from shapely.strtree import STRtree
from pyproj import Transformer

AQUI = os.path.dirname(os.path.abspath(__file__))
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
ROOT = os.path.abspath(os.path.join(AQUI, "..")) + "/"
import sys as _sys, os as _os
_sys.path.insert(0, ROOT)
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
FWD = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
CLAT, CLON = CID.clat, CID.clon
MLAT, MLON = CID.mlat, CID.mlon
TOL = 8.0          # ponto de endereco que caiu na calcada ainda conta pro lote


def main():
    lots = json.load(open(CID.caminho("lotes"), encoding="utf-8"))
    lg = [sht(lambda x, y, z=None: FWD.transform(x, y), shape(f["geometry"])) for f in lots["features"]]
    tree = STRtree(lg)
    occ = set()

    # 1) pontos de endereco: TODAS as provas, nao so o cadastro proprio.
    # Uma prova nao anula a outra -- o SigaSC (54.111) cobre lote que o Censo nao
    # visitou e o CNEFE (143.160) cobre bairro que o cadastro municipal nao alcanca,
    # e nenhum contem o outro. Cidade sem nenhum dos dois (a maioria) cai so no
    # footprint; sem isto a etapa quebrava em FileNotFoundError.
    arqs = CID.caminhos("enderecos", obrigatoria=False) +            CID.caminhos("enderecos_extra", obrigatoria=False)
    vistos = set(); pts = []
    for f in arqs:
        n0 = len(pts)
        for e, n in json.load(open(f)):
            k = (int(e), int(n))          # dedup na grade de 1 m: o mesmo endereco
            if k in vistos: continue      # aparece nas duas fontes com 20-30 cm de erro
            vistos.add(k); pts.append((e, n))
        print("  %s: +%d pontos novos" % (_os.path.basename(f), len(pts) - n0))
    if not pts: print("sem pontos de endereco: ocupacao so por footprint")
    for e, n in pts:
        p = Point(e, n)
        achou = False
        for i in tree.query(p):
            if lg[i].contains(p): occ.add(i); achou = True; break
        if not achou:
            cand = list(tree.query(p.buffer(TOL)))
            if cand:
                i = min(cand, key=lambda i: lg[i].distance(p))
                if lg[i].distance(p) < TOL: occ.add(i)
    por_end = len(occ)
    print("pontos de endereco (%d fontes): %d -> lotes com endereco: %d"
          % (len(arqs), len(pts), por_end))

    # 2) footprint residencial do Overture/OSM (cls 0/1 do city v4)
    city = json.load(open(CID.caminho("city_base"), encoding="utf-8"))
    b = city["b"]; Q = city["q"]
    i = 0; n = len(b); cents = []
    while i < n:
        cls, h, npt = b[i], b[i + 1], b[i + 2]; i += 3
        lx = lz = 0; sx = sz = 0
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2; sx += lx; sz += lz
        if cls in (0, 1):
            mx = sx / npt / Q; mz = sz / npt / Q
            cents.append(FWD.transform(CLON + mx / MLON, CLAT - mz / MLAT))
    for (x, y) in cents:
        p = Point(x, y)
        for i2 in tree.query(p):
            if lg[i2].contains(p): occ.add(i2); break
    print("footprints residenciais: %d -> lotes ocupados no total: %d de %d (%.0f%%)"
          % (len(cents), len(occ), len(lg), 100 * len(occ) / max(len(lg), 1)))
    print("  so por endereco: %d | so por footprint: +%d" % (por_end, len(occ) - por_end))

    saida = CID.caminho("lotes_ocupados")
    json.dump(sorted(int(x) for x in occ), open(saida, "w"))
    print("-> %s" % saida)


if __name__ == "__main__":
    main()
