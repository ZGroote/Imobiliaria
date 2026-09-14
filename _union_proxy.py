# -*- coding: utf-8 -*-
"""Dissolve o footprint cru da variante proxy: plano de telhado vizinho vira UM corpo.

O Overture e telhado detectado por satelite (Google Open Buildings + Microsoft ML).
O detector quebra um telhado em planos, e os dois provedores podem emitir o MESMO
telhado -- e dai vem o "1 casa = 3 poligonos". Este script mede quanto dos 284.921
volumes e estrutura separada de verdade e quanto e o mesmo telhado contado n vezes.

Nao toca em nenhum arquivo existente. So escreve o `-union.city.json` ao lado.

REGRAS (e o porque de cada uma):

  uniao exata primeiro   Poligono que se toca/sobrepoe une com `unary_union` puro:
                         canto continua reto e a geometria e EXATA. So quando sobra
                         buraco (junta aberta) entra o dilata-erode com junta em
                         esquadro (join_style=2) -- que arredonda, e por isso e o
                         ultimo recurso, nao o primeiro.

  so dentro do grupo     `bl[]` exige que os predios de um quarteirao sejam
                         CONTIGUOS em b[]. Unir atravessando quarteirao quebraria a
                         contiguidade, entao componente que cruza grupo e partido --
                         e contado, pra saber o tamanho do que ficou por fazer.

  corpo intocado sai     Componente de 1 membro reemite a fatia ORIGINAL de b[], sem
  byte a byte            requantizar. A maior parte do arquivo passa sem risco.

  anel horario           A area assinada em (x,z) e NEGATIVA nos 284.921 originais.
                         O v7 ja matou o telhado da cidade inteira invertendo anel;
                         a saida e forcada com orient(sign=-1) e reconferida DEPOIS
                         de quantizar pra inteiro.

  altura/classe do       O corpo mesclado herda cls/h/nome do membro de MAIOR
  membro dominante       intersecao com a parte -- a silhueta resultante e
                         essencialmente o corpo principal.

  buraco descartado      O formato tem um anel por predio. Patio interno vira macico;
                         a area perdida e reportada.

  python _union_proxy.py
"""
import collections, io, json, math, os, sys, time

import numpy as np
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))

TOL = 4        # dm = 0,4 m -- junta entre planos de telhado do mesmo edificio
SIMPL = 1.0    # dm = 0,1 m -- tira vertice redundante que o dilata-erode criou
MITRE = 5.0

ENTRA = os.path.join(AQUI, "ribeirao-preto", "ribeirao-preto-v4-recortado.city.json")
SAI = os.path.join(AQUI, "ribeirao-preto", "ribeirao-preto-v4-recortado-union.city.json")
REL = os.path.join(AQUI, "_union_proxy.json")


def decode(b):
    """b[] -> [(cls, h, ring, ini, fim)] preservando a fatia original."""
    out, i, n = [], 0, len(b)
    while i < n:
        s = i
        cls, h, npt = b[i], b[i + 1], b[i + 2]; i += 3
        lx = lz = 0; ring = []
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2
            ring.append((lx, lz))
        out.append((cls, h, ring, s, i))
    return out


def encode(cls, h, ring):
    out = [int(cls), int(h), len(ring)]
    lx = lz = 0
    for (x, z) in ring:
        out.append(int(x) - lx); out.append(int(z) - lz)
        lx, lz = int(x), int(z)
    return out


def area2(ring):
    a = 0.0
    for k in range(len(ring)):
        x1, z1 = ring[k]; x2, z2 = ring[(k + 1) % len(ring)]
        a += x1 * z2 - x2 * z1
    return a


class UF:
    def __init__(s, n):
        s.p = list(range(n))

    def find(s, x):
        while s.p[x] != x:
            s.p[x] = s.p[s.p[x]]; x = s.p[x]
        return x

    def une(s, a, b):
        ra, rb = s.find(a), s.find(b)
        if ra != rb: s.p[rb] = ra


def limpa_anel(poly):
    """shapely -> anel de inteiros, horario, sem ponto repetido nem colinear."""
    poly = poly.simplify(SIMPL, preserve_topology=True)
    if poly.is_empty or poly.geom_type != "Polygon": return None
    poly = orient(Polygon(poly.exterior), sign=-1.0)      # area assinada NEGATIVA
    pts = [(int(round(x)), int(round(z))) for (x, z) in poly.exterior.coords[:-1]]
    ded = []
    for p in pts:
        if not ded or p != ded[-1]: ded.append(p)
    if len(ded) > 1 and ded[0] == ded[-1]: ded.pop()
    out = []
    n = len(ded)
    for k in range(n):
        x0, z0 = ded[k - 1]; x1, z1 = ded[k]; x2, z2 = ded[(k + 1) % n]
        if (x1 - x0) * (z2 - z1) - (z1 - z0) * (x2 - x1) != 0: out.append((x1, z1))
    if len(out) < 3: out = ded
    if len(out) < 3: return None
    if area2(out) == 0: return None
    if area2(out) > 0: out.reverse()      # reconfere DEPOIS de quantizar
    return out


t0 = time.time()
city = json.load(io.open(ENTRA, encoding="utf-8"))
b, bl, Q = city["b"], city["bl"], city["q"]
recs = decode(b)
NB = len(recs)
print("entra: %d volumes | %d grupos de streaming | q=%d" % (NB, len(bl) // 5, Q))

grupo = [-1] * NB
for gi in range(len(bl) // 5):
    ini, qtd = bl[5 * gi + 3], bl[5 * gi + 4]
    for k in range(ini, ini + qtd): grupo[k] = gi
assert min(grupo) >= 0, "predio sem grupo"

polys = []; invalidos = 0
for (cls, h, ring, s, e) in recs:
    p = Polygon(ring)
    if not p.is_valid:
        invalidos += 1
        p = p.buffer(0)
        if p.geom_type == "MultiPolygon": p = max(p.geoms, key=lambda g: g.area)
        if p.is_empty or p.geom_type != "Polygon": p = Polygon(ring).convex_hull
    polys.append(p)
print("poligonos invalidos consertados: %d  (%.1fs)" % (invalidos, time.time() - t0))

# ---- componentes: quem esta a menos de TOL de quem --------------------------
arr = np.empty(NB, dtype=object)
for i, p in enumerate(polys): arr[i] = p
tree = STRtree(arr)
pares = tree.query(arr, predicate="dwithin", distance=TOL)
uf = UF(NB)
cruz = 0
for a, bq in zip(pares[0], pares[1]):
    a, bq = int(a), int(bq)
    if a >= bq: continue
    if grupo[a] != grupo[bq]:
        cruz += 1                      # nao une atravessando quarteirao
        continue
    uf.une(a, bq)
print("pares vizinhos (<= %.1f m): %d | descartados por cruzar quarteirao: %d  (%.1fs)"
      % (TOL / Q, len(pares[0]), cruz, time.time() - t0))

comp = collections.defaultdict(list)
for i in range(NB): comp[uf.find(i)].append(i)
comps = list(comp.values())
tam = collections.Counter(len(c) for c in comps)
print("componentes: %d  (1 membro: %d | 2: %d | 3: %d | 4+: %d)"
      % (len(comps), tam[1], tam[2], tam[3], sum(v for k, v in tam.items() if k >= 4)))

# ---- funde -------------------------------------------------------------------
obm = city.get("bm", [])
bm_old = {obm[i]: (obm[i + 1], obm[i + 2]) for i in range(0, len(obm), 3)}

saida_por_grupo = collections.defaultdict(list)
n_exato = n_buffer = n_falhou = 0
n_partes_extra = 0
buracos = 0; area_buraco = 0.0
red_hist = collections.Counter()
soma_red = []
conflito_nome = 0
alturas_div = []

for c in comps:
    porgrupo = collections.defaultdict(list)
    for i in c: porgrupo[grupo[i]].append(i)
    for gi, membros in porgrupo.items():
        if len(membros) == 1:
            i = membros[0]
            s, e = recs[i][3], recs[i][4]
            saida_por_grupo[gi].append((i, b[s:e], bm_old.get(i)))
            continue
        ms = [polys[i] for i in membros]
        soma = sum(p.area for p in ms)
        u = unary_union(ms)
        if u.geom_type == "MultiPolygon":
            u2 = unary_union([p.buffer(TOL, join_style=2, mitre_limit=MITRE) for p in ms])
            u2 = u2.buffer(-TOL, join_style=2, mitre_limit=MITRE)
            if not u2.is_empty:
                u = u2; n_buffer += 1
            else:
                n_falhou += 1
        else:
            n_exato += 1
        partes = list(u.geoms) if u.geom_type == "MultiPolygon" else [u]
        red = 1.0 - (u.area / soma if soma else 1.0)
        soma_red.append(red)
        red_hist[min(9, int(max(red, 0.0) * 10))] += 1
        n_partes_extra += len(partes) - 1
        hs = set(recs[i][1] for i in membros)
        if len(hs) > 1: alturas_div.append(max(hs) - min(hs))
        nomes = [bm_old[i] for i in membros if i in bm_old]
        if len(set(nomes)) > 1: conflito_nome += 1
        for parte in partes:
            if parte.is_empty or parte.geom_type != "Polygon": continue
            if parte.interiors:
                buracos += len(parte.interiors)
                area_buraco += sum(Polygon(r).area for r in parte.interiors)
            anel = limpa_anel(parte)
            if anel is None: continue
            melhor, ba = membros[0], -1.0
            for i in membros:
                try: ia = polys[i].intersection(parte).area
                except Exception: ia = 0.0
                if ia > ba: ba = ia; melhor = i
            saida_por_grupo[gi].append(
                (min(membros), encode(recs[melhor][0], recs[melhor][1], anel), bm_old.get(melhor)))

# ---- remonta b[], bl[], bm[] -------------------------------------------------
nb, nbl, nbm = [], [], []
n_pred = 0
for gi in range(len(bl) // 5):
    itens = sorted(saida_por_grupo.get(gi, []), key=lambda t: t[0])
    if not itens: continue
    start_building = n_pred
    pts_all = []
    for (_ord, fatia, bmv) in itens:
        if bmv is not None: nbm.append((n_pred, bmv[0], bmv[1]))
        nb.extend(int(v) for v in fatia)
        lx = lz = 0; npt = fatia[2]; k = 3; ring = []
        for _ in range(npt):
            lx += fatia[k]; lz += fatia[k + 1]; k += 2; ring.append((lx, lz))
        pts_all.append(ring)
        n_pred += 1
    npt_all = sum(len(r) for r in pts_all)
    cxi = int(round(sum(p[0] for r in pts_all for p in r) / npt_all))
    czi = int(round(sum(p[1] for r in pts_all for p in r) / npt_all))
    far = 0.0
    for r in pts_all:
        for p in r:
            d = math.hypot(p[0] - cxi, p[1] - czi)
            if d > far: far = d
    nbl.extend([cxi, czi, int(math.ceil(far)), start_building, len(itens)])

nbm.sort()
nbm_flat = [int(v) for t in nbm for v in t]

out = collections.OrderedDict()
out["v"] = city["v"]; out["c"] = city["c"]; out["q"] = city["q"]
out["names"] = city["names"]; out["b"] = nb; out["bm"] = nbm_flat; out["bl"] = nbl
out["r"] = city["r"]; out["g"] = city["g"]
s = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
io.open(SAI, "w", encoding="utf-8").write(s)

# ---- relatorio ----------------------------------------------------------------
med = sorted(soma_red)
p50 = med[len(med) // 2] if med else 0.0
dup = sum(1 for r in med if r > 0.5)
col = sum(1 for r in med if r < 0.1)
rep = collections.OrderedDict([
    ("volumes_entra", NB), ("volumes_sai", n_pred),
    ("reducao_pct", round(100 * (1 - n_pred / NB), 1)),
    ("componentes", len(comps)),
    ("comp_1", tam[1]), ("comp_2", tam[2]), ("comp_3", tam[3]),
    ("comp_4mais", sum(v for k, v in tam.items() if k >= 4)),
    ("uniao_exata", n_exato), ("uniao_por_buffer", n_buffer), ("uniao_falhou", n_falhou),
    ("partes_extras", n_partes_extra),
    ("pares_cruzando_quarteirao", cruz),
    ("redundancia_p50", round(p50, 3)),
    ("fusoes_duplicata_red_maior_50pct", dup),
    ("fusoes_colagem_red_menor_10pct", col),
    ("buracos_descartados", buracos),
    ("area_buracos_m2", round(area_buraco / (Q * Q), 1)),
    ("conflito_de_nome", conflito_nome),
    ("fusoes_com_altura_divergente", len(alturas_div)),
    ("mb_entra", round(os.path.getsize(ENTRA) / 1048576, 2)),
    ("mb_sai", round(os.path.getsize(SAI) / 1048576, 2)),
    ("segundos", round(time.time() - t0, 1)),
])
io.open(REL, "w", encoding="utf-8").write(json.dumps(rep, ensure_ascii=False, indent=1))
print()
for k, v in rep.items(): print("  %-34s %s" % (k, v))
print("\nhistograma de redundancia (0 = corpos distintos colados, 9 = mesmo telhado):")
for k in range(10):
    print("  %.1f-%.1f  %6d %s" % (k / 10, (k + 1) / 10, red_hist[k],
                                   "#" * min(60, red_hist[k] // 200)))
print("\n-> %s" % os.path.relpath(SAI, AQUI))
