# -*- coding: utf-8 -*-
"""A rua como entidade unica: a malha de asfalto que preenche os corredores.

Promovido do scratchpad do v6 (`gen_streets.py`). A GEOMETRIA foi mantida igual --
mesma folga de calcada, mesmo vao entre quadras, mesmo simplify -- porque mudar a
largura do asfalto no mesmo passo em que a quadra muda tornaria impossivel atribuir
qualquer regressao visual. So mudaram as FONTES: a quadra agora e `quadras_completo`
(cadastro + face do grafo de ruas) e a rede viaria sai do `city_base`.

Isso importa: `streets = (vao + corredores) - quadras`. Com a lista antiga de quadras,
os quarteiroes vindos do grafo nao entravam no `difference` e o asfalto passava POR
CIMA das casas novas -- o mesmo defeito que ja custou uma rodada no v6 ("nao da pra
ver a rua de tanta casa em cima dela"), so que invertido.

DIVIDA CONHECIDA (PADRAO.md): a meia-largura aqui (`ROAD_W/2 + FOLGA`) e a terceira
conta de largura de rua do projeto, diferente da fita de `padrao.vias`. Nao foi
unificada nesta passagem de proposito, pelo motivo acima. O asfalto e recortado pelas
quadras, entao ela nao afeta o encosto do muro nem os portoes de QA.

  python pipeline/ruas.py     # -> v7/dados/street_tris.json
"""
import json, os, sys, time
from shapely.geometry import shape, Polygon, LineString
from shapely.ops import triangulate, unary_union

AQUI = os.path.dirname(os.path.abspath(__file__))
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
ROOT = os.path.abspath(os.path.join(AQUI, "..")) + "/"
sys.path.insert(0, ROOT)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
SH = 9.0        # meia-largura do preenchimento de vao entre quadras
FOLGA = 5.0     # calcada/canteiro somado a meia-largura da via
SIMP = 3.0


def main():
    t0 = time.time()
    quad = json.load(open(CID.caminho("quadras_completo"), encoding="utf-8"))
    qo = []; qsm = []
    for f in quad["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        mp = Polygon([CID.geo_para_mapa(x, y) for x, y in g.exterior.coords]).buffer(0)
        if mp.is_empty or mp.geom_type != "Polygon": continue
        qo.append(mp); qsm.append(mp.simplify(SIMP))
    blocks_o = unary_union(qo)       # quadras REAIS: e por elas que a rua e recortada
    blocks_s = unary_union(qsm)      # suavizadas: so pra crescer o vao
    print("quadras %d | union %.1fs" % (len(qo), time.time() - t0))

    city = json.load(open(CID.caminho("city_base"), encoding="utf-8"))
    r = city["r"]; q = city["q"]; i = 0; corr = []
    while i < len(r):
        k = r[i]; i += 2; n = r[i]; i += 1
        lx = lz = 0; pts = []
        for _ in range(n):
            lx += r[i]; lz += r[i + 1]; i += 2; pts.append((lx / q, lz / q))
        tipo = CID.tipo_da_via(k)
        if tipo not in CID.dirigivel or len(pts) < 2: continue
        hw = CID.ROAD_W.get(tipo, CID.ROAD_W.get("other", 6)) / 2.0 + FOLGA
        try: corr.append(LineString(pts).buffer(hw, cap_style=2, join_style=2))
        except Exception: pass
    roads = unary_union(corr)
    print("vias bufferizadas %d | %.1fs" % (len(corr), time.time() - t0))

    gap = blocks_s.buffer(SH).difference(blocks_o)
    streets = unary_union([gap, roads]).difference(blocks_o)
    streets = streets.simplify(SIMP).difference(blocks_o)

    # ---- SOBRE O ASFALTO EM LASCAS COM QUADRA DE CADASTRO ----------------------
    # Com a quadra do grafo de ruas (lisa, poucos vertices) as duas linhas acima se
    # comportam: o `simplify(SIMP)` quase nao mexe e o `difference` seguinte nao deixa
    # nada pra tras. Com a quadra do CADASTRO OFICIAL, detalhada, o simplify desloca a
    # borda ate 3 m e a subtracao seguinte recorta essa faixa inteira numa orla de
    # slivers. Medido em Ribeirao (231 mil lotes de IPTU): 799.751 triangulos, 25,6 MB,
    # pra 0,44 km2 de asfalto -- 0,6 m2 POR TRIANGULO. O chao, no mesmo mapa, tem
    # 62,2 m2. O sintoma nao e rua larga demais, e area por triangulo ridicula.
    #
    # TENTATIVA REPROVADA (03/09/2026): abertura morfologica `buffer(-0.5).buffer(0.5)`
    # antes de triangular. A ideia era apagar o que fosse mais fino que 1 m, seguro
    # porque a faixa mais estreita aqui e ROAD_W/2 + FOLGA >= 8 m. PIOROU tudo:
    #
    #     799.751 -> 2.868.752 triangulos | 25,6 -> 92,0 MB | 500 -> 2.227 s
    #
    # O buffer do GEOS aproxima cada canto por ARCO DE SEGMENTOS. Numa fronteira que ja
    # tem centenas de milhares de vertices ele ACRESCENTA vertice em vez de tirar lasca,
    # e o difference seguinte estilhaca mais fino ainda (0,6 -> 0,2 m2 por triangulo).
    # Suavizacao nao resolve fronteira quase coincidente -- so a adia e engorda.
    #
    # Por onde ir, se alguem retomar: a lasca nasce do DESENCONTRO entre `blocks_s`
    # (simplificada) e `blocks_o` (real). Ou se usa a mesma fronteira nos dois lados, ou
    # se descarta o `.simplify(SIMP).difference(blocks_o)` final (o difference anterior
    # ja garante o recorte), ou se filtra triangulo por area depois de triangular -- que
    # e O(n) e nao mexe em geometria. Nao tentar buffer de novo.
    tris = []
    for poly in ([streets] if streets.geom_type == "Polygon" else list(streets.geoms)):
        if poly.geom_type != "Polygon": continue
        for t in triangulate(poly):
            if poly.contains(t.centroid):
                for (x, z) in list(t.exterior.coords)[:3]:
                    tris.append(round(x)); tris.append(round(z))
    tris = [max(-32000, min(32000, v)) for v in tris]
    saida = CID.caminho("rua_tris")
    json.dump(tris, open(saida, "w"), separators=(",", ":"))
    print("triangulos %d -> %s (%.1f MB) | %.1fs"
          % (len(tris) // 6, saida, os.path.getsize(saida) / 1e6, time.time() - t0))


if __name__ == "__main__":
    main()
