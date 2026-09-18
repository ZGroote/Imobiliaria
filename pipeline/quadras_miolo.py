# -*- coding: utf-8 -*-
"""Encolhe a quadra oficial ate o MIOLO LOTEAVEL.

A entrada e `quadras_completo` (cadastro do SigaSC + face do grafo de ruas onde o
cadastro nao cobre; ver quadras_grafo.py), e ela nao e a quadra loteada: vai ate o
EIXO DA RUA.
Medido em 922 quadras com 8+ lotes de planta: quadra 74,6 x 157,4 m contra miolo
loteado 58,7 x 127,0 m - folga de ~8 m por lado. Por isso o lote sintetico, que foi
gerado caminhando o perimetro dessa quadra, nasce em cima do asfalto (100% deles
encostam na borda; o lote oficial fica 4,9 m recuado).

Aqui a quadra e recortada pelos CORREDORES VIARIOS de verdade (malha do city.json,
largura por tipo de via) em vez de um recuo uniforme - avenida e rua residencial nao
tem a mesma meia-largura.

O corte usa a MESMA largura que o renderizador DESENHA: `buildRibbons(R, 0.18, 1.55)`
pinta a fita de calcada com `ROAD_W[tipo]/2 * 1,55`, e e a borda externa dessa fita
que o olho le como "a rua". Cortar com outra conta (era `ROAD_W/2 + 2,6 + 1,5`)
desencontra os dois: na rua residencial sobrava 2,04 m entre a frente do lote e a
fita (o muro nao encostava na rua) e na avenida a fita passava por cima do lote (o
muro nascia em cima do asfalto). Com o corte na propria fita, a face frontal do muro
cai exatamente na extremidade externa da rua.

  python pipeline/quadras_miolo.py            # gera v7/dados/quadras_miolo.geojson
  python pipeline/quadras_miolo.py --calibra  # so mede, nao grava
"""
import json, math, os, sys
import numpy as np
from shapely.geometry import shape, mapping
from shapely.ops import transform as sht, unary_union
from shapely.strtree import STRtree

AQUI = os.path.dirname(os.path.abspath(__file__))
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
ROOT = os.path.abspath(os.path.join(AQUI, "..")) + "/"
sys.path.insert(0, ROOT)
from padrao.cidade import carrega          # a cidade e um JSON, nao constante no codigo
from padrao import vias                    # e a fita da rua tem UMA implementacao

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
RECUO_MIN = 0.0    # nada alem da fita: o lote tem que encostar na borda externa dela


def corredores(city, mul=None):
    """Malha viaria do city.json -> poligonos de rua em UTM, na largura DESENHADA.

    A largura vem de `padrao/cidades/<slug>.json` (`vias.largura` x `vias.mul_fita`),
    que e a MESMA tabela que o renderizador usa - o portao `tabela de vias` do
    `padrao/rodar_qa.py` reprova o build se as duas divergirem. A borda desse poligono
    e a linha em que o lote, o muro e a casa tem que parar."""
    return vias.fita_utm(city, CID, mul=mul, so_dirigivel=True)


def main():
    city = json.load(open(CID.caminho("city_base"), encoding="utf-8"))
    q = json.load(open(CID.caminho("quadras_completo"), encoding="utf-8"))
    # O lote de planta entra so na VALIDACAO abaixo ("lotes preenchem X% do miolo").
    # Cidade sem planta oficial nao tem esse arquivo, e faltar relatorio nao pode
    # impedir a etapa de produzir o miolo.
    _lp = CID.caminho("lotes_planta")
    lot = (json.load(open(_lp, encoding="utf-8")) if os.path.exists(_lp)
           else {"type": "FeatureCollection", "features": []})

    ruas = corredores(city)
    print("corredores viarios: %d" % len(ruas))
    tree = STRtree(ruas)

    feats = []; miolo = {}
    for f in q["features"]:
        if f["geometry"]["type"] != "Polygon": continue
        g = sht(lambda x, y, z=None: CID.para_utm(x, y), shape(f["geometry"])).buffer(0)
        if g.is_empty or g.area <= 0: continue
        viz = [ruas[j] for j in tree.query(g)]
        s = g
        if viz:
            try: s = g.difference(unary_union(viz))
            except Exception: s = g
        s = (s.buffer(-RECUO_MIN) if RECUO_MIN > 0 else s).buffer(0)
        if s.is_empty:
            s = g.buffer(-6.0).buffer(0)          # sem via em volta: recuo fixo
        if s.is_empty: continue
        # NAO ficar so com o maior pedaco: a via corta a quadra em varios, e descartar
        # os outros jogava fora 833 ha (18,7% do total) - a quadra 70 sozinha tinha 192
        # pedacos e perdia 557 ha. Cada pedaco vira uma feicao com o MESMO id de quadra.
        pedacos = list(s.geoms) if s.geom_type == "MultiPolygon" else [s]
        pedacos = [p for p in pedacos if p.area >= 60]
        if not pedacos: continue
        miolo[f["properties"]["id"]] = unary_union(pedacos)
        for p in pedacos:
            feats.append({"type": "Feature",
                          "properties": {"id": f["properties"]["id"],
                                         "area_m2": round(p.area, 1),
                                         "area_quadra_m2": round(g.area, 1)},
                          "geometry": mapping(sht(lambda x, y, z=None: CID.para_geo(x, y), p))})

    # --- validacao contra o lote oficial ---
    porq = {}
    for f in lot["features"]:
        porq.setdefault(f["properties"]["quadra"], []).append(
            sht(lambda x, y, z=None: CID.para_utm(x, y), shape(f["geometry"])))
    ench = []; fora = []; red = []
    for qi, gs in porq.items():
        S = miolo.get(qi)
        if S is None or len(gs) < 8: continue
        U = unary_union(gs)
        if U.area / S.area < 0.55: continue          # so quadra bem extraida
        ench.append(U.intersection(S).area / S.area)
        fora.append((U.area - U.intersection(S).area) / U.area)
    for qi, S in miolo.items():
        g = [f for f in q["features"] if f["properties"].get("id") == qi]
        if g: pass
    print("validado em %d quadras bem loteadas:" % len(ench))
    if ench:
        print("  lotes preenchem %.0f%% do miolo | %.0f%% da area do lote cai fora"
              % (100 * np.median(ench), 100 * np.median(fora)))
    a1 = np.array([f["properties"]["area_m2"] for f in feats])
    a0 = np.array([f["properties"]["area_quadra_m2"] for f in feats])
    print("miolo/quadra em area: mediana %.0f%%  | %d quadras" % (100 * np.median(a1 / a0), len(feats)))

    if "--calibra" in sys.argv: return
    saida = CID.caminho("miolo")
    json.dump({"type": "FeatureCollection", "features": feats}, open(saida, "w"))
    print("-> %s (%.1f MB)" % (saida, os.path.getsize(saida) / 1e6))


if __name__ == "__main__":
    main()
