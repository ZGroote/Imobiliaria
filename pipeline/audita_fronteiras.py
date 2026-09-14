# -*- coding: utf-8 -*-
"""Toda fronteira entre dois comodos vira PAREDE. Esta e a lista das que nao tem vao.

O renderizador rasteriza os comodos e emite parede em toda divisa entre dois donos
diferentes. Entao um corredor declarado como dois comodos vizinhos, sem porta entre
eles, sai TAPADO -- e foi exatamente o que aconteceu no wish e no cedros.

    python pipeline/audita_fronteiras.py                 # todo o acervo
    python pipeline/audita_fronteiras.py wish-castanheiras-58

SEM VAO nao e erro por si: a maior parte das divisas E parede mesmo (quarto x sala,
banho x quarto). O que a lista faz e obrigar a OLHAR uma por uma contra o desenho --
foi assim que sairam as quatro que fechavam corredor no wish e no cedros, e a porta do
quarto 1 do colinas, que estava sobre uma divisa de 0,31 m e transbordava pra vizinha.

Regra pratica: comodo que so existe como NOME (hall, circulacao, area de servico numa
faixa continua) quase sempre precisa de vao declarado, com `y1` no PE-DIREITO. Sem o
`y1` o padrao e 2,10 m e a abertura sai com verga -- um portal que a planta nao tem.
"""
import io, json, os, sys, math
sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, "plantas_fornecidas")
TOL = 0.02          # m: colinearidade
MIN_FRONTEIRA = 0.30  # m: abaixo disso e canto tocando canto, nao parede


def arestas(poly):
    return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]


def sobrepoe(e1, e2):
    """Se os dois segmentos sao colineares e se sobrepoem, devolve (p0, p1, eixo)."""
    (a0, a1), (b0, b1) = e1, e2
    dax, daz = a1[0] - a0[0], a1[1] - a0[1]
    L = math.hypot(dax, daz)
    if L < 1e-9:
        return None
    ux, uz = dax / L, daz / L
    nx, nz = -uz, ux
    for q in (b0, b1):                      # b tem que estar na reta de a
        if abs((q[0] - a0[0]) * nx + (q[1] - a0[1]) * nz) > TOL:
            return None
    if abs((b1[0] - b0[0]) * nx + (b1[1] - b0[1]) * nz) > TOL:
        return None
    t = lambda q: (q[0] - a0[0]) * ux + (q[1] - a0[1]) * uz
    lo = max(0.0, min(t(b0), t(b1)))
    hi = min(L, max(t(b0), t(b1)))
    if hi - lo < MIN_FRONTEIRA:
        return None
    P = lambda s: (a0[0] + ux * s, a0[1] + uz * s)
    return P(lo), P(hi), (ux, uz)


def na_fronteira(p, p0, p1, u, larg):
    """O ponto do vao cai dentro deste trecho de fronteira?"""
    ux, uz = u
    nx, nz = -uz, ux
    if abs((p[0] - p0[0]) * nx + (p[1] - p0[1]) * nz) > 0.06:
        return False
    s = (p[0] - p0[0]) * ux + (p[1] - p0[1]) * uz
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    return -larg / 2 - 0.05 <= s <= L + larg / 2 + 0.05


def audita(uid):
    p = os.path.join(BASE, uid, "unidade.json")
    u = json.load(io.open(p, encoding="utf-8"))
    pl = u.get("planta") or {}
    com = pl.get("comodos") or []
    vaos = (pl.get("portas") or []) + (pl.get("janelas") or [])
    print("== %s  (%d comodos, %d vaos)" % (uid, len(com), len(vaos)))
    for i in range(len(com)):
        for j in range(i + 1, len(com)):
            for e1 in arestas(com[i]["poly"]):
                for e2 in arestas(com[j]["poly"]):
                    r = sobrepoe(e1, e2)
                    if not r:
                        continue
                    p0, p1, uu = r
                    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                    achou = [v for v in vaos
                             if na_fronteira(v["p"], p0, p1, uu, v.get("largura", 0.8))]
                    marca = "ok " if achou else "SEM VAO"
                    print("   %-7s %-16s | %-16s  %5.2f m  de (%.2f,%.2f) a (%.2f,%.2f)  %s"
                          % (marca, com[i]["nome"], com[j]["nome"], L,
                             p0[0], p0[1], p1[0], p1[1],
                             ", ".join("%.2f" % v.get("largura", 0) for v in achou)))


alvos = sys.argv[1:] or [d for d in sorted(os.listdir(BASE))
                         if os.path.exists(os.path.join(BASE, d, "unidade.json"))
                         and not d.startswith("_")]
for a in alvos:
    audita(a)
