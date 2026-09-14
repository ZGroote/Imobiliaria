# -*- coding: utf-8 -*-
"""
Extrai os quarteiroes de sao-carlos-overture-v3.city.json.

Quarteirao = face do grafo planar formado pelas ruas que de fato delimitam
quadra (motorway..living_street + unclassified + residential + links). Vias de
servico, trilha e calcada ficam de fora: elas cortam por DENTRO do quarteirao
(entrada de garagem, corredor de estacionamento) e fatiariam a quadra em cacos.

O r[] do city.json nao vem nodado -- 8972 dos extremos tem grau 1, ou seja as
polilinhas nao foram cortadas nos cruzamentos. Por isso o passo de nodagem
existe: sem ele o grafo nao fecha ciclo nenhum e sai zero face.

Coordenadas ficam em decimetros inteiros (o mesmo Q do city.json) do inicio ao
fim -- comparacao exata, sem epsilon de float decidindo se dois nos sao o mesmo.

Saida: blocks.json  {q, blocks:[{id, poly:[[x,z]..], area_m2, b:[indices]}]}
"""
import json, math, collections, sys

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# Fontes do JSON da cidade. Estavam escritas aqui, com nome de Sao Carlos.
BASE = r"C:\Users\respawn\Desktop\imobiliaria"
# O v3 NAO tem dado proprio: `v3/sao-carlos-overture-v3.city.json` e copia byte a byte
# do `sao-carlos-overture-v2.city.json` (mesmo md5) -- o que o v3 mudou foi o HTML.
# Ler o v2 direto tira uma copia de 6,7 MB do caminho critico e uma "versao" do
# grafo de dependencia. Verificado: o blocks.json sai identico.
SRC  = CID.caminho("city_v2")
OUT  = CID.caminho("faces_ruas")

# indices de HW_LIST (rebuild_city.py:35) que delimitam quadra
BOUND = {0,1,2,3,4,5,6,7,8, 15,16,17,18,19,20}
SNAP  = 5           # dm -- solda nos a 0,5 m
CELL  = 300         # dm -- celula do hash espacial da nodagem (30 m)
MIN_A = 800         # m2 -- abaixo disso e sobra de traçado, nao quadra
MAX_A = 400_000     # m2 -- acima disso e a face externa ou um vazio urbano

snap = lambda v: int(round(v / SNAP)) * SNAP


def load():
    with open(SRC, encoding="utf-8") as f:
        d = json.load(f)
    r, i, segs = d["r"], 0, []
    while i < len(r):
        kind, _ni, n = r[i], r[i+1], r[i+2]; i += 3
        lx = lz = 0; pts = []
        for _ in range(n):
            lx += r[i]; lz += r[i+1]; i += 2
            pts.append((lx, lz))
        if kind in BOUND:
            for a, b in zip(pts, pts[1:]):
                if a != b:
                    segs.append((a, b))
    return d, segs


def node_segments(segs):
    """Corta cada segmento nos pontos onde cruza outro. Hash espacial por
    celula: so pares que dividem celula sao testados."""
    grid = collections.defaultdict(list)
    for idx, (a, b) in enumerate(segs):
        x0, x1 = sorted((a[0], b[0])); z0, z1 = sorted((a[1], b[1]))
        for cx in range(x0 // CELL, x1 // CELL + 1):
            for cz in range(z0 // CELL, z1 // CELL + 1):
                grid[(cx, cz)].append(idx)

    cuts = collections.defaultdict(set)
    tested = set()
    for bucket in grid.values():
        for ii in range(len(bucket)):
            for jj in range(ii + 1, len(bucket)):
                i, j = bucket[ii], bucket[jj]
                key = (i, j) if i < j else (j, i)
                if key in tested:
                    continue
                tested.add(key)
                (p0, p1), (q0, q1) = segs[i], segs[j]
                rx, rz = p1[0]-p0[0], p1[1]-p0[1]
                sx, sz = q1[0]-q0[0], q1[1]-q0[1]
                den = rx*sz - rz*sx
                if den == 0:
                    continue                      # paralelos: colinearidade fica pra solda
                qpx, qpz = q0[0]-p0[0], q0[1]-p0[1]
                t = (qpx*sz - qpz*sx) / den
                u = (qpx*rz - qpz*rx) / den
                if not (0.0 < t < 1.0 and 0.0 < u < 1.0):
                    continue                      # toca so na ponta: ja vira no na solda
                pt = (snap(p0[0] + t*rx), snap(p0[1] + t*rz))
                cuts[i].add(pt); cuts[j].add(pt)

    out = []
    for idx, (a, b) in enumerate(segs):
        if idx not in cuts:
            out.append((a, b)); continue
        ax, az = a
        L = math.hypot(b[0]-ax, b[1]-az) or 1.0
        pts = sorted(cuts[idx], key=lambda p: ((p[0]-ax)**2 + (p[1]-az)**2))
        chain = [a] + pts + [b]
        for u, v in zip(chain, chain[1:]):
            if u != v:
                out.append((u, v))
    return out


def build_graph(segs):
    adj = collections.defaultdict(set)
    for a, b in segs:
        A = (snap(a[0]), snap(a[1])); B = (snap(b[0]), snap(b[1]))
        if A != B:
            adj[A].add(B); adj[B].add(A)
    # poda de galhos: extremidade de grau 1 nao fecha face, so gera ida-e-volta
    while True:
        dead = [n for n, nb in adj.items() if len(nb) <= 1]
        if not dead:
            break
        for n in dead:
            for m in adj.pop(n, ()):
                adj[m].discard(n)
    return adj


def faces(adj):
    """Traversal padrao de face: chegando em v por u, sai pela aresta anterior
    a (v->u) na ordem angular. Isso percorre as faces INTERNAS no sentido
    anti-horario (shoelace > 0); a face externa sai com area negativa."""
    order, pos = {}, {}
    for v, nb in adj.items():
        lst = sorted(nb, key=lambda w: math.atan2(w[1]-v[1], w[0]-v[0]))
        order[v] = lst
        pos[v] = {w: k for k, w in enumerate(lst)}

    seen, out = set(), []
    for u0 in adj:
        for v0 in adj[u0]:
            if (u0, v0) in seen:
                continue
            face, u, v = [], u0, v0
            while True:
                seen.add((u, v)); face.append(u)
                lst = order[v]
                nxt = lst[(pos[v][u] - 1) % len(lst)]
                u, v = v, nxt
                if (u, v) == (u0, v0):
                    break
                if len(face) > 5000:
                    face = []; break
            if len(face) >= 3:
                a = sum(face[k][0]*face[(k+1) % len(face)][1] -
                        face[(k+1) % len(face)][0]*face[k][1]
                        for k in range(len(face))) / 2.0
                out.append((a, face))
    return out


def decode_buildings(d):
    b, i, idx, out = d["b"], 0, 0, []
    while i < len(b):
        cls, h, n = b[i], b[i+1], b[i+2]; i += 3
        lx = lz = 0; pts = []
        for _ in range(n):
            lx += b[i]; lz += b[i+1]; i += 2
            pts.append((lx, lz))
        cx = sum(p[0] for p in pts) / n
        cz = sum(p[1] for p in pts) / n
        out.append((idx, cx, cz)); idx += 1
    return out


def inside(px, pz, poly):
    """Ray casting. O centroide do predio cai em no maximo uma face interna,
    entao nao ha desempate a fazer."""
    c = False
    n = len(poly)
    for k in range(n):
        x0, z0 = poly[k]; x1, z1 = poly[(k+1) % n]
        if (z0 > pz) != (z1 > pz):
            if px < (x1-x0) * (pz-z0) / (z1-z0) + x0:
                c = not c
    return c


def assign_buildings(d, blocks):
    """Hash espacial pela bbox de cada quarteirao: um predio so e testado
    contra as quadras cuja caixa o contem."""
    grid = collections.defaultdict(list)
    boxes = []
    for bi, blk in enumerate(blocks):
        xs = [p[0] for p in blk["poly"]]; zs = [p[1] for p in blk["poly"]]
        box = (min(xs), max(xs), min(zs), max(zs))
        boxes.append(box)
        for cx in range(box[0] // CELL, box[1] // CELL + 1):
            for cz in range(box[2] // CELL, box[3] // CELL + 1):
                grid[(cx, cz)].append(bi)

    for blk in blocks:
        blk["b"] = []
    orphan = 0
    for idx, cx, cz in decode_buildings(d):
        hit = None
        for bi in grid.get((int(cx) // CELL, int(cz) // CELL), ()):
            x0, x1, z0, z1 = boxes[bi]
            if x0 <= cx <= x1 and z0 <= cz <= z1 and inside(cx, cz, blocks[bi]["poly"]):
                hit = bi; break
        if hit is None:
            orphan += 1
        else:
            blocks[hit]["b"].append(idx)
    return orphan


def main():
    d, segs = load()
    print(f"segmentos delimitadores: {len(segs)}")
    segs = node_segments(segs)
    print(f"apos nodagem:           {len(segs)}")
    adj = build_graph(segs)
    print(f"nos no grafo podado:    {len(adj)}")
    fs = faces(adj)
    print(f"faces cruas:            {len(fs)}")

    Q = d["q"]
    blocks = []
    for a_dm2, face in fs:
        area = a_dm2 / (Q * Q)          # dm2 -> m2
        if area <= 0:
            continue                     # face externa / orientacao horaria
        if not (MIN_A <= area <= MAX_A):
            continue
        blocks.append({"poly": [[p[0], p[1]] for p in face], "area_m2": round(area, 1)})
    blocks.sort(key=lambda b: -b["area_m2"])
    print(f"quarteiroes ({MIN_A}-{MAX_A} m2): {len(blocks)}")

    orphan = assign_buildings(d, blocks)
    tot = sum(len(b["b"]) for b in blocks)
    print(f"predios dentro de quarteirao: {tot}  (fora: {orphan})")
    cnt = sorted(len(b["b"]) for b in blocks)
    print(f"casas por quarteirao: p10 {cnt[len(cnt)//10]}  mediana {cnt[len(cnt)//2]}  "
          f"p90 {cnt[9*len(cnt)//10]}  max {cnt[-1]}")
    print(f"quarteiroes vazios: {sum(1 for c in cnt if c == 0)}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"q": Q, "blocks": [{"id": i, **b} for i, b in enumerate(blocks)]},
                  f, separators=(",", ":"))
    ar = sorted(b["area_m2"] for b in blocks)
    if ar:
        print(f"area m2: p10 {ar[len(ar)//10]:.0f}  mediana {ar[len(ar)//2]:.0f}  "
              f"p90 {ar[9*len(ar)//10]:.0f}")
    print(f"gravado: {OUT}")


if __name__ == "__main__":
    main()
