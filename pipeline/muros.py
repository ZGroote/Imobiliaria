# -*- coding: utf-8 -*-
"""Muro de divisa nos lotes COM CASA.

Sem muro, o quintal de fundo de uma casa encosta no da vizinha e vira um vazio
continuo - nao da pra ver onde acaba um terreno e comeca o outro. Com muro, da pra
encolher a casa (que ocupava 90% do lote) sem perder a leitura do quarteirao.

Lote VAZIO nao ganha muro: se nao ha casa, nao ha muro. A divisa entre um lote
ocupado e um vazio continua desenhada - ela vem do lado de quem construiu.

Nao manda triangulo pronto: 5.600 km de divisa em sopa de triangulos dariam ~14 MB.
Manda SEGMENTO (x0,z0,x1,z1 em decimetros, delta-encodado) e o navegador levanta a
parede - 1 draw call, ~4x menor.

  python pipeline/muros.py
"""
import json, math, os
from shapely.geometry import shape
from shapely.ops import transform as sht
from pyproj import Transformer

AQUI = os.path.dirname(os.path.abspath(__file__))
import sys as _sys, os as _os
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
_sys.path.insert(0, _os.path.abspath(_os.path.join(AQUI, "..")))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
INV = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)
FWD = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
CLAT, CLON = CID.clat, CID.clon
MLAT, MLON = CID.mlat, CID.mlon
Q = 10.0            # decimetro
SIMP = 0.25         # tira vertice redundante do lote antes de extrair aresta
MIN_SEG = 1.2       # aresta menor que isso nao vira muro (canto de recorte)
COS_TOL = 0.9995    # ~1,8 graus: colinear o bastante pra fundir


def utm_to_map(x, y):
    lon, lat = INV.transform(x, y)
    return ((lon - CLON) * MLON, -(lat - CLAT) * MLAT)


def main():
    d = json.load(open(CID.caminho("lotes"), encoding="utf-8"))
    # SO LOTE COM CASA: terreno vazio nao tem muro. A divisa compartilhada com um lote
    # ocupado continua desenhada - ela vem do lado de quem construiu.
    occ = set(json.load(open(CID.caminho("lotes_ocupados"), encoding="utf-8")))
    print("lotes: %d | com casa (recebem muro): %d" % (len(d["features"]), len(occ)))
    # 1) arestas unicas (divisa compartilhada entre vizinhos conta uma vez so)
    vis = set(); seg = []
    for _i, f in enumerate(d["features"]):
        if _i not in occ: continue
        g = sht(lambda x, y, z=None: FWD.transform(x, y), shape(f["geometry"]))
        if g.geom_type != "Polygon": continue
        g = g.simplify(SIMP)
        c = list(g.exterior.coords)
        for i in range(len(c) - 1):
            a, b = c[i], c[i + 1]
            if math.dist(a, b) < MIN_SEG: continue
            ka = (round(a[0] * 2) / 2, round(a[1] * 2) / 2)     # grade de 50 cm
            kb = (round(b[0] * 2) / 2, round(b[1] * 2) / 2)
            k = (ka, kb) if ka <= kb else (kb, ka)
            if k in vis: continue
            vis.add(k)
            seg.append((utm_to_map(*a), utm_to_map(*b)))
    print("arestas unicas: %d" % len(seg))

    # 2) funde aresta colinear e contigua (o fundo de uma fileira inteira de lotes
    #    e UMA reta atravessando a quadra, nao 40 pedacinhos)
    porponto = {}
    def key(p): return (round(p[0] * 2), round(p[1] * 2))
    for i, (a, b) in enumerate(seg):
        porponto.setdefault(key(a), []).append(i)
        porponto.setdefault(key(b), []).append(i)
    usado = [False] * len(seg)
    saida = []
    for i, (a, b) in enumerate(seg):
        if usado[i]: continue
        usado[i] = True
        ini, fim = list(a), list(b)
        for ponta in (0, 1):
            while True:
                p = ini if ponta == 0 else fim
                outro = fim if ponta == 0 else ini
                vx, vy = p[0] - outro[0], p[1] - outro[1]
                L = math.hypot(vx, vy)
                if L < 1e-6: break
                vx, vy = vx / L, vy / L
                achou = None
                for j in porponto.get(key(p), ()):
                    if usado[j]: continue
                    a2, b2 = seg[j]
                    q = b2 if key(a2) == key(p) else a2
                    if key(a2) != key(p) and key(b2) != key(p): continue
                    wx, wy = q[0] - p[0], q[1] - p[1]
                    M = math.hypot(wx, wy)
                    if M < 1e-6: continue
                    if (vx * wx + vy * wy) / M >= COS_TOL:
                        achou = (j, q); break
                if achou is None: break
                usado[achou[0]] = True
                if ponta == 0: ini = list(achou[1])
                else: fim = list(achou[1])
        saida.append((ini, fim))
    print("depois de fundir colineares: %d segmentos (-%.0f%%)"
          % (len(saida), 100 * (1 - len(saida) / max(len(seg), 1))))

    # 3) delta-encoding em decimetros: [dx0,dz0, vx,vz] por segmento
    saida.sort(key=lambda s: (int(s[0][0] // 200), int(s[0][1] // 200), s[0][0]))   # localidade
    out = []; px = pz = 0
    comp = 0.0
    for (a, b) in saida:
        x0 = int(round(a[0] * Q)); z0 = int(round(a[1] * Q))
        x1 = int(round(b[0] * Q)); z1 = int(round(b[1] * Q))
        out += [x0 - px, z0 - pz, x1 - x0, z1 - z0]
        px, pz = x0, z0
        comp += math.dist(a, b)
    p = CID.caminho("muros")
    json.dump(out, open(p, "w"), separators=(",", ":"))
    print("-> %s | %d segmentos, %.0f km de muro (%.1f MB)"
          % (p, len(saida), comp / 1000, os.path.getsize(p) / 1e6))


if __name__ == "__main__":
    main()
