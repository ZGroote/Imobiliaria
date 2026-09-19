# -*- coding: utf-8 -*-
"""Etapa 1: quadras oficiais, do layer `quadras_pol` do mapa `legislacao`.

Saida: `quadras_<cidade>.geojson` -- poligono de quadra ATE O EIXO DA VIA, `id` unico.
E o contrato da etapa 1 do PADRAO.md.

    python pipeline/fontes/sigasc_quadras.py           # sonda + tiles + vetoriza
    python pipeline/fontes/sigasc_quadras.py --sonda   # so mostra onde tem tinta

O que este layer NAO da: ele cobriu 3.373 quadras em Sao Carlos e deixou 1.359 faces
de cidade sem cadastro nenhum. Isso NAO e falha de raspagem -- o dado nao existe la.
A etapa 1b (`pipeline/quadras_grafo.py`) completa com a face do grafo de ruas.
"""
import json, os, sys
from shapely.geometry import mapping
from shapely.ops import transform as sht

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ); sys.path.insert(0, AQUI)
from padrao.cidade import carrega
import sigasc as sg

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
# extent de busca em UTM nativo. Generoso de proposito: a sonda e barata (300 px por
# celula de 3 km) e errar pra menos custa um bairro inteiro faltando.
EXTENT = (183000, 7545000, 216000, 7581000)
TILES = os.path.join(RAIZ, "fontes_raster", "quadras")
ACESAS = os.path.join(TILES, "acesas.json")


def main():
    os.makedirs(TILES, exist_ok=True)
    if "--sonda" in sys.argv or not os.path.exists(ACESAS):
        json.dump(sg.sonda("legislacao", "quadras_pol", *EXTENT), open(ACESAS, "w"))
        if "--sonda" in sys.argv: return
    acesas = [tuple(x) for x in json.load(open(ACESAS))]
    man = sg.tiles("legislacao", "quadras_pol", acesas, TILES)
    mask, grid = sg.mosaico(man, sg.mascara_linha_cinza)
    reg = sg.faces(mask, grid, dilata=3, area_min_m2=2575)
    feats = []
    for pid, g in sg.poligonos(reg, grid, CID, area_min_m2=1500, simplify_m=2.0):
        gu = sht(lambda x, y, z=None: CID.para_utm(x, y), g)   # area so vale em metros
        feats.append({"type": "Feature",
                      "properties": {"id": pid, "area_ha": round(gu.area / 1e4, 3)},
                      "geometry": mapping(g)})
    sg.grava_geojson(CID.caminho("quadras"), feats)


if __name__ == "__main__":
    main()
