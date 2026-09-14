# -*- coding: utf-8 -*-
"""Chao que acompanha o relevo: as quadras trianguladas.

Promovido do scratchpad do v6 (`gen_ground.py`) sem mudar a geometria -- so a fonte
da quadra, que agora e `quadras_completo` (cadastro + face do grafo de ruas). Com a
fonte antiga o bairro vindo do grafo ficava com casa e SEM chao debaixo: no plano nao
se nota, porque o material do chao e da cor do vazio de proposito, mas com o Relevo
ligado o predio flutua sobre o fundo, que foi o defeito que o chao existe pra curar.

  python v7/pipeline/gen_chao.py     # -> v7/dados/ground_tris.json
"""
import json, os, sys
from shapely.geometry import shape, Polygon
from shapely.ops import triangulate

AQUI = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.abspath(os.path.join(AQUI, "..")) + "/"
ROOT = os.path.abspath(os.path.join(V7, "..")) + "/"
sys.path.insert(0, ROOT)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
SIMPLIFY = 7.0          # m - o chao nao precisa da serrilha da vetorizacao


def main():
    quad = json.load(open(CID.caminho("quadras_completo"), encoding="utf-8"))
    tris = []; nq = 0
    for f in quad["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        mp = Polygon([CID.geo_para_mapa(x, y) for x, y in g.exterior.coords])
        mp = mp.buffer(0).simplify(SIMPLIFY)
        if mp.is_empty: continue
        for poly in ([mp] if mp.geom_type == "Polygon" else list(mp.geoms)):
            for t in triangulate(poly):
                if poly.contains(t.centroid):
                    for (x, z) in list(t.exterior.coords)[:3]:
                        tris.append(round(x)); tris.append(round(z))
        nq += 1
    tris = [max(-32000, min(32000, v)) for v in tris]      # o shader le int16
    saida = CID.caminho("chao_tris")
    json.dump(tris, open(saida, "w"), separators=(",", ":"))
    print("quadras %d | triangulos %d -> %s (%.0f KB)"
          % (nq, len(tris) // 6, saida, os.path.getsize(saida) / 1024))


if __name__ == "__main__":
    main()
