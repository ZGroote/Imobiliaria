# -*- coding: utf-8 -*-
"""Etapa 0: loteamentos/bairros oficiais, do layer `parcelamentos` (mapa `gerais`).

Saida: `loteamentos_<cidade>_oficial.geojson` -- o poligono do loteamento com `nome`.
Nao entra em nenhuma etapa obrigatoria do mapa 3D; serve pra NOMEAR (ficha do imovel,
relatorio por bairro, o `quadras_grafo` reportar onde ganhou/perdeu estrutura).

    python pipeline/fontes/sigasc_parcelamentos.py

Tres coisas que ja morderam:

1. **Dilatacao 4 px, nao 2.** Com 2, poligono grande e alongado vaza por gaps de ~4 px
   nas emendas de tile e cai no fundo -- foi assim que o Santa Angelina sumiu.
2. **O nome nao vem do layer.** O SigaSC nao tem identificar-por-clique; o `nome` esta
   desenhado como rotulo laranja no centroide. Aqui o nome vem do OSM por
   point-in-polygon, e quem quiser 100% le os rotulos dos recortes na mao.
   NAO usar "ponto de bairro mais proximo": os pontos do OSM misturam distrito `admin`
   (Vila Nery e um distrito grande a leste) com "Quadra A/B" generico.
3. **O layer nao cobre o centro historico** -- o Centro nunca foi loteamento, entao
   fica um buraco no miolo. Quem preenche e `bairros_centro_<cidade>.geojson`,
   agrupando quadra por poligono de bairro do OSM.
"""
import json, os, sys
from shapely.geometry import mapping, shape
from shapely.ops import transform as sht

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ); sys.path.insert(0, AQUI)
from padrao.cidade import carrega
import sigasc as sg

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
EXTENT = (183000, 7545000, 216000, 7581000)
TILES = os.path.join(RAIZ, "fontes_raster", "parcelamentos")
ACESAS = os.path.join(TILES, "acesas.json")
OSM_NOMES = os.path.join(RAIZ, "loteamentos_bairros_saocarlos.geojson")


def nomeia(feats):
    """Nome por point-in-polygon com os pontos/poligonos de bairro do OSM."""
    if not os.path.exists(OSM_NOMES):
        print("  (sem %s: saindo sem nome)" % os.path.basename(OSM_NOMES)); return
    src = json.load(open(OSM_NOMES, encoding="utf-8"))
    ancoras = [(shape(f["geometry"]).centroid, f["properties"].get("nome"),
                f["properties"].get("tipo")) for f in src["features"]]
    n = 0
    for f in feats:
        poly = shape(f["geometry"]); c = poly.centroid
        hits = [(a, nm, tp) for (a, nm, tp) in ancoras if nm and poly.contains(a)]
        if not hits:
            f["properties"]["nome"] = None; f["properties"]["fonte_nome"] = None; continue
        # bairro (`suburb`) ganha de qualquer outro tipo; empate resolve pelo mais perto
        hits.sort(key=lambda h: (0 if h[2] == "suburb" else 1, c.distance(h[0])))
        f["properties"]["nome"] = hits[0][1]; f["properties"]["fonte_nome"] = "osm"; n += 1
    print("  nomeados por OSM: %d de %d" % (n, len(feats)))


def main():
    os.makedirs(TILES, exist_ok=True)
    if "--sonda" in sys.argv or not os.path.exists(ACESAS):
        json.dump(sg.sonda("gerais", "parcelamentos", *EXTENT), open(ACESAS, "w"))
        if "--sonda" in sys.argv: return
    acesas = [tuple(x) for x in json.load(open(ACESAS))]
    man = sg.tiles("gerais", "parcelamentos", acesas, TILES)
    mask, grid = sg.mosaico(man, sg.mascara_linha_vermelha)
    reg = sg.faces(mask, grid, dilata=4, area_min_m2=12900)
    feats = []
    for pid, g in sg.poligonos(reg, grid, CID, area_min_m2=12000, simplify_m=6.0,
                               buraco_min_m2=5000):
        gu = sht(lambda x, y, z=None: CID.para_utm(x, y), g)
        feats.append({"type": "Feature",
                      "properties": {"id": pid, "area_ha": round(gu.area / 1e4, 2)},
                      "geometry": mapping(g)})
    nomeia(feats)
    sg.grava_geojson(CID.caminho("loteamentos"), feats)


if __name__ == "__main__":
    main()
