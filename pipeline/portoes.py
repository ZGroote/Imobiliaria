# -*- coding: utf-8 -*-
"""Etapa 6b: o PORTAO de cada lote com casa.

Toda casa brasileira tem portao, e ele fica na divisa da frente, no muro. O mapa tinha
o muro (etapa 6) mas nao tinha onde ele se abre -- uma fileira de caixas fechadas.

**Qual aresta e a frente.** Nao da pra usar o `nx/ny` do lote: ele so existe em lote
SINTETICO (2.604 de 5.000 na amostra); lote vindo de planta nao tem. A frente sai da
malha viaria, que e canonica e existe pra todo mundo: e a aresta do poligono cujo ponto
medio esta mais perto do eixo de uma via DIRIGIVEL. Lote de fundo, sem frente pra rua
dentro do limite, simplesmente nao ganha portao -- e o certo, ele nao tem frente.

Sai `[dx, dz, ang, larg, tipo]` por portao, delta-encodado em decimetros, na mesma
forma do `muros_segs.json` e pelo mesmo motivo: mandar triangulo pronto de 60 mil
portoes seriam dezenas de MB.

  python pipeline/portoes.py
"""
import io, json, math, os, sys, zlib

import numpy as np
import shapely
from shapely.geometry import shape, LineString
from shapely.strtree import STRtree

AQUI = os.path.dirname(os.path.abspath(__file__))
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
sys.path.insert(0, os.path.abspath(os.path.join(AQUI, "..")))
from padrao.cidade import carrega
from padrao import vias

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
Q = 10.0              # decimetro, igual ao muro
MAX_DIST_RUA = 28.0   # alem disso a aresta nao e frente: e fundo ou lateral de esquina
MIN_FRENTE = 2.6      # aresta curta demais nao comporta portao
LARG_MAX = 4.6        # portao de 4,6 m ja e garagem dupla


def sorteio(i):
    """Numero fixo por lote: de que lado da testada o portao encosta e qual e o tipo.

    Era `hash(("portao", i))`. O `hash()` de string em Python e RANDOMIZADO por processo
    (PYTHONHASHSEED), entao cada execucao desta etapa mexia o portao de todas as 74 mil
    casas -- a cidade mudava de build pra build sem ninguem ter mudado nada, e a etapa
    nao podia ser conferida por comparacao de saida. `crc32` da o mesmo papel (espalha
    bem o suficiente pra escolher lado e tipo) e da o MESMO numero sempre.
    """
    return zlib.crc32(b"portao%d" % i) & 0x7FFFFFFF


def main():
    city = json.load(io.open(CID.caminho("city_saida"), encoding="utf-8"))
    d = json.load(io.open(CID.caminho("lotes"), encoding="utf-8"))
    occ = set(json.load(io.open(CID.caminho("lotes_ocupados"), encoding="utf-8")))
    print("lotes: %d | com casa: %d" % (len(d["features"]), len(occ)))

    # eixos das vias em UTM -- e a mesma fonte que o recorte de quadra usa
    eixos = []
    for _tipo, pts in vias.eixos(city, CID, so_dirigivel=True):
        u = [CID.mapa_para_utm(x, z) for x, z in pts]
        if len(u) >= 2:
            eixos.append(LineString(u))
    print("eixos de via dirigivel: %d" % len(eixos))
    arr = np.array(eixos, dtype=object)
    tree = STRtree(arr)

    # uma passada: junta TODAS as arestas candidatas de TODOS os lotes e consulta o
    # indice de uma vez. Consulta lote a lote levava minutos.
    meios = []          # ponto medio de cada aresta (UTM)
    dono = []           # (indice do lote, ax, ay, bx, by) em UTM
    from pyproj import Transformer
    FWD = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
    for i, f in enumerate(d["features"]):
        if i not in occ:
            continue
        g = f["geometry"]
        if g["type"] != "Polygon":
            continue
        c = [FWD.transform(x, y) for x, y in g["coordinates"][0]]
        for k in range(len(c) - 1):
            a, b = c[k], c[k + 1]
            L = math.dist(a, b)
            if L < MIN_FRENTE:
                continue
            meios.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            dono.append((i, a[0], a[1], b[0], b[1], L))
    print("arestas candidatas: %d" % len(meios))

    pts = shapely.points(np.array(meios))
    viz = tree.nearest(pts)
    dist = shapely.distance(pts, arr[viz])

    # por lote, a aresta mais perto da rua vence
    melhor = {}
    for j, (i, ax, ay, bx, by, L) in enumerate(dono):
        dd = float(dist[j])
        if dd > MAX_DIST_RUA:
            continue
        cur = melhor.get(i)
        if cur is None or dd < cur[0]:
            melhor[i] = (dd, ax, ay, bx, by, L, j)
    print("lotes com frente identificada: %d de %d" % (len(melhor), len(occ)))

    # PARA QUE LADO FICA A RUA. Sem isto o portao sai virado pra dentro do lote em
    # metade dos casos -- e como ele e quase plano, some dentro do muro. A convencao
    # que o renderizador usa: girado por -ang em Y, o +X local segue a aresta e o +Z
    # local aponta pra (-dz, dx). Entao basta garantir que ESSE lado seja o da rua,
    # invertendo a aresta quando nao for.
    from shapely.ops import nearest_points
    from shapely.geometry import Point as _P
    invertidos = 0
    for i, (dd, ax, ay, bx, by, L, j) in list(melhor.items()):
        mx0, mz0 = CID.para_mapa((ax + bx) / 2, (ay + by) / 2)
        a2 = CID.para_mapa(ax, ay); b2 = CID.para_mapa(bx, by)
        dx, dz = b2[0] - a2[0], b2[1] - a2[1]
        via = arr[viz[j]]
        pr = nearest_points(_P(*CID.mapa_para_utm(mx0, mz0)), via)[1]
        rx, rz = CID.para_mapa(pr.x, pr.y)
        if (-dz) * (rx - mx0) + dx * (rz - mz0) < 0:      # a rua esta do outro lado
            melhor[i] = (dd, bx, by, ax, ay, L, j)
            invertidos += 1
    print("frentes viradas pra rua: %d invertidas" % invertidos)

    # posicao, angulo, largura e tipo
    saida = []
    for i in sorted(melhor):
        _dd, ax, ay, bx, by, L, _j = melhor[i]
        # o portao nao fica no centro exato da testada: encosta num dos lados, que e
        # onde a garagem fica na casa brasileira. O lado sai do proprio indice.
        h = sorteio(i)
        larg = min(LARG_MAX, max(2.6, L * 0.42))
        folga = (L - larg) / 2.0
        t = 0.5 + (0.5 if (h & 1) else -0.5) * min(0.62, folga / max(L, 1e-6) * 1.35)
        cx, cy = ax + (bx - ax) * t, ay + (by - ay) * t
        mx, mz = CID.para_mapa(cx, cy)
        # O angulo tem que ser medido NO MAPA, nao no UTM: o eixo Z do mapa
        # aponta pro SUL, entao o sentido de rotacao se inverte.
        a2x, a2z = CID.para_mapa(ax, ay)
        b2x, b2z = CID.para_mapa(bx, by)
        ang = math.atan2(b2z - a2z, b2x - a2x)
        tipo = (h >> 3) % 4
        saida.append((mx, mz, ang, larg, tipo))

    # delta-encoding, igual ao muro
    saida.sort(key=lambda s: (int(s[0] // 200), int(s[1] // 200), s[0]))
    out = []
    px = pz = 0
    for (x, z, ang, larg, tipo) in saida:
        xi = int(round(x * Q)); zi = int(round(z * Q))
        a8 = int(round((ang % (2 * math.pi)) / (2 * math.pi) * 255)) & 255
        out += [xi - px, zi - pz, a8, int(round(larg * Q)), tipo]
        px, pz = xi, zi
    p = CID.caminho("portoes")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(out, io.open(p, "w", encoding="utf-8"), separators=(",", ":"))
    print("-> %s | %d portoes (%.2f MB)"
          % (p, len(saida), os.path.getsize(p) / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
