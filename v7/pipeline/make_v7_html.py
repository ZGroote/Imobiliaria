# -*- coding: utf-8 -*-
"""Gera v7/lotes_v7.html: pagina de DUPLO CLIQUE (abre em file://, sem servidor,
sem internet, sem CDN). Tudo embutido: lotes, quadras de fundo e o padrao de lote
por bairro. Nada de fetch - em file:// cada arquivo e uma origem propria e o
fetch morre (ver memoria mapa-3d-duplo-clique)."""
import json, os
from shapely.geometry import shape
from shapely.ops import transform as sht
from pyproj import Transformer

AQUI = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.abspath(os.path.join(AQUI, "..")) + "/"
RAIZ = os.path.abspath(os.path.join(V7, "..")) + "/"
FWD = Transformer.from_crs("EPSG:4326", "EPSG:29193", always_xy=True)
Q = 10.0        # decimetro: 10 cm de precisao, de sobra pra lote


def toutm(x, y, z=None):
    return FWD.transform(x, y)


def cod(polys, cx, cy):
    """[npt, x0,y0, dx,dy, ...] em decimetros, delta-encodado - igual ao b[] do city.json."""
    out = []
    for g in polys:
        c = list(g.exterior.coords)[:-1]
        if len(c) < 3:
            continue
        out.append(len(c))
        px = py = 0
        for i, (x, y) in enumerate(c):
            ix = int(round((x - cx) * Q))
            iy = int(round((y - cy) * Q))
            if i == 0:
                out += [ix, iy]
            else:
                out += [ix - px, iy - py]
            px, py = ix, iy
    return out


def main():
    lot = json.load(open(V7 + "dados/lotes_confiaveis_saocarlos.geojson", encoding="utf-8"))
    qua = json.load(open(RAIZ + "quadras_saocarlos.geojson", encoding="utf-8"))

    gl = [sht(toutm, shape(f["geometry"])) for f in lot["features"]]
    cx = sum(g.centroid.x for g in gl) / len(gl)
    cy = sum(g.centroid.y for g in gl) / len(gl)

    nomes, idx = [], {}
    for f in lot["features"]:
        p = f["properties"]
        n = p.get("loteamento") or "?"
        if n not in idx:
            idx[n] = len(nomes)
            nomes.append([n, p.get("frente_padrao_m"), p.get("fundo_padrao_m"), 0])
        nomes[idx[n]][3] += 1

    props = []
    for f in lot["features"]:
        p = f["properties"]
        props.append([idx[p.get("loteamento") or "?"],
                      int(round(p.get("area_m2") or 0)),
                      int(round((p.get("frente_m") or 0) * 10)),
                      int(round((p.get("fundo_m") or 0) * 10)),
                      int(round((p.get("encaixe") or 0) * 100))])

    # quadras de fundo: simplifica forte, o serrilhado do raster nao importa aqui
    gq = []
    for f in qua["features"]:
        g = sht(toutm, shape(f["geometry"])).simplify(2.0)
        for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
            if p.area > 200:
                gq.append(p)

    dados = {"c": [round(cx, 2), round(cy, 2)], "q": Q, "bairros": nomes, "p": props,
             "lotes": cod(gl, cx, cy), "quadras": cod(gq, cx, cy)}
    js = json.dumps(dados, separators=(",", ":"), ensure_ascii=False)

    modelo = open(os.path.join(AQUI, "v7_template.html"), encoding="utf-8").read()
    saida = V7 + "lotes_v7.html"
    open(saida, "w", encoding="utf-8").write(modelo.replace("/*__DADOS__*/", js))
    print("-> %s  (%.1f MB) | %d lotes, %d quadras, %d bairros"
          % (saida, os.path.getsize(saida) / 1e6, len(gl), len(gq), len(nomes)))


if __name__ == "__main__":
    main()
