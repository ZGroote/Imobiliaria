# -*- coding: utf-8 -*-
"""Etapa 1 (complemento): quadra tirada do GRAFO DE RUAS onde o cadastro nao tem.

O `quadras_saocarlos.geojson` vem do layer `quadras_pol` do SigaSC e NAO cobre a
cidade toda. Sondado no servidor em 2026-08-29, no extent do Jardim Araucaria
(E195100..196000 N7566100..7567650): `quadras_pol` desenha 0,34% de pixel (respingo
da quadra vizinha), `enderecamento` desenha ZERO e `lotes_pol` so a area publica da
borda -- contra 1,73% e 1,26% no controle do Jardim Embare. O tile que cobre
Araucaria ja tinha sido raspado (esta no q_inked.json): nao e borda de raspagem, e
ausencia de dado no cadastro. Sem quadra nao ha miolo, nao ha lote e nao ha casa --
o bairro inteiro sumiu do v7/v8 (797 estruturas no v4, 0 no v8).

A face do grafo de ruas (`blocks.json`, gerado por `build_blocks.py`) serve de
substituto porque ela E o poligono ate o eixo da via, que e exatamente o contrato da
etapa 1 no PADRAO.md. Medido nas 3.270 quadras onde as duas fontes existem:

    area mediana         face 9.980 m2   x   quadra oficial 10.091 m2
    IoU face x quadra    mediana 0,85  (p25 0,72)
    quadra contida na face  94% (mediana)
    quadras por face     mediana 1, media 1,1

Os 15% de diferenca sao a meia-pista -- a face vai ate o eixo, a quadra oficial para
no meio-fio -- e e justamente isso que o `quadras_miolo.py` desconta na etapa 2.

So entra face com PROVA de urbanizacao (footprint do city_base dentro dela). Face
vazia fica de fora: por o mapa a lotear pasto e a mesma doenca das 635 casas para 13
enderecos que o `ocupacao.py` existe pra curar.

  python v7/pipeline/quadras_grafo.py            # -> quadras_saocarlos_completo.geojson
  python v7/pipeline/quadras_grafo.py --calibra  # so mede, nao grava
"""
import json, os, sys
from shapely.geometry import shape, mapping, Polygon, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

AQUI = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.abspath(os.path.join(AQUI, "..")) + "/"
ROOT = os.path.abspath(os.path.join(V7, "..")) + "/"
sys.path.insert(0, ROOT)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))

COBERTA_MAX = 0.20      # face com mais de 20% em cima de quadra oficial ja esta coberta
AREA_MIN = 600.0        # m2 - abaixo disso e sobra de cruzamento, nao quarteirao
AREA_MAX = 100000.0     # m2 - 10 ha; acima disso e gleba/rural, nao quarteirao
PREDIOS_MIN = 5         # prova de urbanizacao
DENS_MIN = 3.0          # predios por hectare. A quadra oficial COM predio tem p10=7,9
ID_BASE = 100000        # id de face do grafo nao colide com id de cadastro (max 4831)


def faces_do_grafo():
    """As faces do grafo de ruas, em UTM. Vem em coordenada de mapa (decimetros)."""
    d = json.load(open(CID.caminho("faces_ruas"), encoding="utf-8"))
    q = d["q"]; out = []
    for b in d["blocks"]:
        anel = [CID.mapa_para_utm(x / q, z / q) for x, z in b["poly"]]
        if len(anel) < 3: continue
        g = Polygon(anel)
        if not g.is_valid: g = g.buffer(0)
        if g.is_valid and not g.is_empty and g.geom_type == "Polygon" and g.area > 0:
            out.append((b["id"], g))
    return out


def centroides_do_city():
    """Centroide de cada volume do city_base, em UTM. E a prova de urbanizacao."""
    d = json.load(open(CID.caminho("city_base"), encoding="utf-8"))
    b = d["b"]; q = d["q"]; i = 0; n = len(b); pts = []
    while i < n:
        i += 2                                    # cls, altura
        npt = b[i]; i += 1
        lx = lz = 0; sx = sz = 0
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2; sx += lx; sz += lz
        pts.append(Point(CID.mapa_para_utm(sx / npt / q, sz / npt / q)))
    return pts


def main():
    # Cidade SEM cadastro aberto e o caso comum, nao a excecao: o `quadras_pol` do
    # SigaSC so existe porque Sao Carlos publica um. Sem o arquivo, a cidade inteira e
    # orfa e TODA quadra vem do grafo de ruas -- e o `QU` vazio faz o resto do script
    # funcionar sem nenhum ramo especial.
    cad = CID.caminho("quadras")
    oficiais = (json.load(open(cad, encoding="utf-8")) if os.path.exists(cad)
                else {"type": "FeatureCollection", "features": []})
    quad = []
    for f in oficiais["features"]:
        g = shape(f["geometry"])
        g = Polygon([CID.para_utm(*c) for c in g.exterior.coords]).buffer(0)
        if not g.is_empty and g.area > 0: quad.append(g)
    QU = unary_union(quad) if quad else Polygon()
    print("quadras do cadastro: %d (%.0f ha)%s"
          % (len(quad), QU.area / 1e4, "" if quad else "  <- sem cadastro: tudo vem do grafo"))

    faces = faces_do_grafo()
    print("faces do grafo de ruas: %d" % len(faces))

    # orfa = face que o cadastro nao cobre. O pedaco que ele cobre e subtraido, pra
    # nao existir lote em duplicata na fronteira entre as duas fontes.
    orfas = []
    for fid, g in faces:
        if g.intersection(QU).area >= COBERTA_MAX * g.area: continue
        s = g.difference(QU).buffer(0)
        for p in (list(s.geoms) if s.geom_type == "MultiPolygon" else [s]):
            if p.geom_type == "Polygon" and AREA_MIN <= p.area <= AREA_MAX:
                orfas.append((fid, p))
    print("faces orfas dentro da faixa de area: %d" % len(orfas))

    pts = centroides_do_city()
    gs = [g for _, g in orfas]; tree = STRtree(gs); cnt = [0] * len(gs)
    for p in pts:
        for i in tree.query(p):
            if gs[i].contains(p): cnt[i] += 1; break

    novas = []
    for k, (fid, g) in enumerate(orfas):
        if cnt[k] < PREDIOS_MIN: continue
        if cnt[k] / (g.area / 1e4) < DENS_MIN: continue
        novas.append((fid, g, cnt[k]))
    print("faces aprovadas (>=%d predios e >=%.1f/ha): %d  | %.0f ha | %d estruturas do city_base"
          % (PREDIOS_MIN, DENS_MIN, len(novas), sum(g.area for _, g, _ in novas) / 1e4,
             sum(c for _, _, c in novas)))

    if "--calibra" in sys.argv: return

    feats = list(oficiais["features"])
    for f in feats: f["properties"]["fonte"] = "cadastro"
    vistos = set()
    for fid, g, c in novas:
        i = ID_BASE + fid
        while i in vistos: i += 1000000            # face partida em varios pedacos
        vistos.add(i)
        feats.append({"type": "Feature",
                      "properties": {"id": i, "area_ha": round(g.area / 1e4, 3),
                                     "fonte": "grafo_ruas"},
                      "geometry": mapping(Polygon([CID.para_geo(*c2)
                                                   for c2 in g.exterior.coords]))})
    saida = CID.caminho("quadras_completo")
    json.dump({"type": "FeatureCollection", "features": feats}, open(saida, "w"))
    print("-> %s : %d quadras (%d cadastro + %d grafo), %.1f MB"
          % (saida, len(feats), len(oficiais["features"]), len(novas),
             os.path.getsize(saida) / 1e6))


if __name__ == "__main__":
    main()
