"""Monta o lote e a zona de EXEMPLO e gera exemplos/estudo-exemplo.json.

Lote: 5 lotes vizinhos reais da quadra 1560 (lid 35038..35042) do lotes_saocarlos.geojson,
juntados (remembramento), porque o maior lote do arquivo tem ~307 m² e não cabe torre.
Zona: SC-Z2 real do lei/zonas.json (escolhida pra teste; a zona real do lote não foi conferida).

    python -I viabilidade/motor/preparar_exemplo.py
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from shapely.geometry import Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from motor import gerar_estudo  # noqa: E402
from utm import para_utm23s  # noqa: E402

LIDS = [35038, 35039, 35040, 35041, 35042]
GEOJSON = os.path.join(AQUI, "..", "..", "lotes_saocarlos.geojson")
EX = os.path.join(AQUI, "exemplos")

ZONAS = os.path.join(AQUI, "..", "lei", "zonas.json")
ZONA_ID = "SC-Z2"  # zona de prédio escolhida pra teste: a zona real deste lote NÃO foi conferida

def carregar_zona():
    with open(ZONAS, encoding="utf-8") as f:
        return next(z for z in json.load(f) if z["id"] == ZONA_ID)


def _salva(nome, obj):
    with open(os.path.join(EX, nome), "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")


def montar_lote():
    with open(GEOJSON, encoding="utf-8") as f:
        feats = {ft["properties"]["lid"]: ft for ft in json.load(f)["features"] if ft["properties"]["lid"] in LIDS}
    polys = [Polygon([para_utm23s(*q) for q in feats[l]["geometry"]["coordinates"][0]]) for l in LIDS]
    # junta e tira os vértices colineares que sobram das divisas internas
    uniao = unary_union([p.buffer(0.05, join_style="mitre") for p in polys]).buffer(-0.05, join_style="mitre").simplify(0.05)
    nx, ny = feats[LIDS[0]]["properties"]["nx"], feats[LIDS[0]]["properties"]["ny"]  # normal da frente (pra rua)
    pts = list(uniao.exterior.coords)
    # frente = aresta mais comprida cuja normal pra fora bate com (nx, ny)
    c = uniao.centroid
    melhor = None
    for a, b in zip(pts, pts[1:]):
        mx, my = (a[0] + b[0]) / 2 - c.x, (a[1] + b[1]) / 2 - c.y
        L = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        alinh = (mx * nx + my * ny) / max((mx * mx + my * my) ** 0.5, 1e-9)
        if alinh > 0.7 and (melhor is None or L > melhor[0]):
            melhor = (L, a, b)
    _, a, b = melhor
    r = lambda p: [round(p[0], 2), round(p[1], 2)]  # noqa: E731
    return {
        "id": "SC-quadra1560-lid35038-35042",
        "lid": LIDS[0],
        "poligono_utm": [r(p) for p in pts[:-1]],
        "frente": [r(a), r(b)],
        "area_m2": round(uniao.area, 2),
        "zona_id": ZONA_ID,
        "zona_origem": "teste",
        "zona_conferida": False,
        "relevo": None,
        "observacoes": ("Remembramento de 5 lotes reais vizinhos (lid " + ", ".join(map(str, LIDS)) +
                        ") da quadra 1560. Polígono WGS84 do geojson convertido pra UTM 23S (EPSG:31983). "
                        "Atenção: os campos fx/fy do geojson estão em SAD69 UTM 23S (EPSG:29193), ~57 m de diferença. "
                        "Zona SC-Z2 escolhida pra teste, não conferida pro endereço. Relevo não preenchido (frente Terreno)."),
    }


def main():
    os.makedirs(EX, exist_ok=True)
    lote = montar_lote()
    _salva("lote-exemplo.json", lote)
    zona = carregar_zona()
    _salva("zona-exemplo.json", zona)
    estudo = gerar_estudo(lote, zona)
    _salva("estudo-exemplo.json", estudo)
    for o in estudo["opcoes"]:
        print(o["id"], o["nome"], o["metricas"])
    print("incertezas:", *estudo["incertezas"], sep="\n  ")


if __name__ == "__main__":
    main()
