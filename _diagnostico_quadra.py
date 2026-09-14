# -*- coding: utf-8 -*-
"""Diagnostico quarteirao a quarteirao da base UNION, cruzando as duas patologias.

Nasceu de uma observacao no print ("impossivel ter esse tanto de espaco vazio") e da
constatacao de que a uniao por adjacencia engoliu casa. Sao dois defeitos diferentes,
e sem separar um do outro nao da pra saber qual quarteirao esta ruim de que:

  VAZIO     lote sem NENHUM footprint em cima. Em Ribeirao a unica prova de ocupacao
            e o footprint (`fontes.enderecos` esta declarado e o arquivo NAO existe),
            entao lote sem telhado detectado nao ganha casa em versao nenhuma -- nem
            no proxy, nem na convencional. Sao 71.494 de 187.859 (38%).

  ENGOLIDO  footprint que o `_union_proxy.py` fundiu num corpo maior. A quadra perde
            a divisa: 102 casas viraram uma laje de 215 m no pior caso.

Nao carrega geometria de lote: o cadastro traz `fx,fy` (UTM) por lote, e a atribuicao
de corpo -> quadra sai do lote MAIS PROXIMO (KD-tree). Os lotes ladrilham a quadra,
entao o vizinho mais proximo acerta o quarteirao; e 300x mais barato que ponto-em-
poligono sobre 81 MB de aneis.

  python _diagnostico_quadra.py            # relatorio + piores quadras
  python _diagnostico_quadra.py --top 40
"""
import collections, io, json, math, os, re, sys, time

import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from padrao.cidade import carrega

CID = carrega("ribeirao-preto-proxy-union")
LOTES = CID.caminho("lotes")
OCUP = CID.caminho("lotes_ocupados")
ANTES = os.path.join(AQUI, "ribeirao-preto", "ribeirao-preto-v4-recortado.city.json")
DEPOIS = CID.caminho("city_saida")
SAIDA = os.path.join(AQUI, "relatorios", "diagnostico_quadra_ribeirao-preto.json")

TOP = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 25
t0 = time.time()


def corpos(caminho):
    """city.json -> (centroide_x, centroide_z, area_m2) por volume, em unidades de mapa."""
    d = json.load(io.open(caminho, encoding="utf-8"))
    b, Q = d["b"], d["q"]
    xs, zs, ars = [], [], []
    i, n = 0, len(b)
    while i < n:
        npt = b[i + 2]; i += 3
        lx = lz = 0; r = []
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2; r.append((lx, lz))
        sx = sum(p[0] for p in r) / npt; sz = sum(p[1] for p in r) / npt
        a = 0.0
        for k in range(npt):
            x1, z1 = r[k]; x2, z2 = r[(k + 1) % npt]
            a += x1 * z2 - x2 * z1
        xs.append(sx); zs.append(sz); ars.append(abs(a) / 2.0 / (Q * Q))
    return np.array(xs), np.array(zs), np.array(ars), d


# ---- lotes: so as propriedades ------------------------------------------------
# cada `properties` e um dict PLANO (sem chave aninhada), entao o recorte por chaves
# balanceadas e seguro -- e evita instanciar 187 mil aneis de poligono.
txt = io.open(LOTES, encoding="utf-8").read()
props = re.findall(r'"properties":\s*(\{[^{}]*\})', txt)
del txt
lid = np.empty(len(props), dtype=np.int64)
quadra = np.empty(len(props), dtype=np.int64)
fx = np.empty(len(props)); fy = np.empty(len(props))
area_lote = np.empty(len(props))
for k, s in enumerate(props):
    p = json.loads(s)
    lid[k] = p["lid"]; quadra[k] = p["quadra"]
    fx[k] = p["fx"]; fy[k] = p["fy"]; area_lote[k] = p.get("area_m2", 0.0)
del props
NL = len(lid)
assert (lid == np.arange(NL)).all(), "lid nao e o indice da feicao -- o ocupados quebraria"
print("lotes: %d | quadras: %d  (%.1fs)" % (NL, len(set(quadra.tolist())), time.time() - t0))

ocupado = np.zeros(NL, dtype=bool)
ocupado[np.array(json.load(io.open(OCUP, encoding="utf-8")), dtype=np.int64)] = True
print("lotes com prova de construcao: %d (%.0f%%)" % (ocupado.sum(), 100 * ocupado.mean()))

# ---- lotes UTM -> coordenadas de mapa (dm) -----------------------------------
inv = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)
lon, lat = inv.transform(fx, fy)
cx_l = (lon - CID.clon) * CID.mlon * 10.0
cz_l = -(lat - CID.clat) * CID.mlat * 10.0
arv = cKDTree(np.column_stack([cx_l, cz_l]))
print("KD-tree dos lotes pronta  (%.1fs)" % (time.time() - t0))

# ---- corpos antes e depois ----------------------------------------------------
ax, az, aa, _ = corpos(ANTES)
dx, dz, da, cd = corpos(DEPOIS)
print("corpos: antes %d | depois %d  (%.1fs)" % (len(ax), len(dx), time.time() - t0))

# Teto de distancia: sem ele, footprint de area SEM cadastro de lote (franja, zona
# industrial, rural) cai na quadra mais proxima e a infla -- foi o que fez a quadra
# 100622 aparecer com 87 lotes e 1.314 corpos. Fora do teto vira "fora do cadastro",
# que e informacao, nao lixo: e a medida de quanto o cadastro de lote nao cobre.
TETO = 1200.0     # dm = 120 m
da_, ia = arv.query(np.column_stack([ax, az]), k=1)
dd_, idp = arv.query(np.column_stack([dx, dz]), k=1)
fora_antes = int((da_ > TETO).sum()); fora_depois = int((dd_ > TETO).sum())
print("corpos alem de %.0f m de qualquer lote: antes %d (%.1f%%) | depois %d (%.1f%%)"
      % (TETO / 10, fora_antes, 100.0 * fora_antes / len(ax),
         fora_depois, 100.0 * fora_depois / len(dx)))
q_antes = np.where(da_ <= TETO, quadra[ia], -1)
q_depois = np.where(dd_ <= TETO, quadra[idp], -1)

# ---- agrega por quadra ---------------------------------------------------------
qs = sorted(set(quadra.tolist()))
idx = {q: k for k, q in enumerate(qs)}
NQ = len(qs)
n_lotes = np.zeros(NQ, dtype=np.int64)
n_ocup = np.zeros(NQ, dtype=np.int64)
n_antes = np.zeros(NQ, dtype=np.int64)
n_depois = np.zeros(NQ, dtype=np.int64)
maior = np.zeros(NQ)
soma_x = np.zeros(NQ); soma_z = np.zeros(NQ)
for k in range(NL):
    j = idx[quadra[k]]
    n_lotes[j] += 1
    if ocupado[k]: n_ocup[j] += 1
    soma_x[j] += cx_l[k]; soma_z[j] += cz_l[k]
for k in range(len(ax)):
    if q_antes[k] < 0: continue
    n_antes[idx[q_antes[k]]] += 1
for k in range(len(dx)):
    if q_depois[k] < 0: continue
    j = idx[q_depois[k]]
    n_depois[j] += 1
    if da[k] > maior[j]: maior[j] = da[k]

engolidos = n_antes - n_depois
vazios = n_lotes - n_ocup

# ---- relatorio ------------------------------------------------------------------
print("\n%-9s %6s %6s %6s %6s %6s %8s   %s" %
      ("quadra", "lotes", "vazios", "%vaz", "antes", "depois", "maior m2", "onde"))
ordem = np.argsort(-(engolidos * 1000 + vazios))
linhas = []
for j in ordem[:TOP]:
    q = qs[j]
    cxm = soma_x[j] / max(n_lotes[j], 1); czm = soma_z[j] / max(n_lotes[j], 1)
    la = CID.clat - czm / (10.0 * CID.mlat)
    lo = CID.clon + cxm / (10.0 * CID.mlon)
    print("%-9d %6d %6d %5.0f%% %6d %6d %8.0f   --lat %.6f --lon %.6f" %
          (q, n_lotes[j], vazios[j], 100 * vazios[j] / max(n_lotes[j], 1),
           n_antes[j], n_depois[j], maior[j], la, lo))
    linhas.append(collections.OrderedDict([
        ("quadra", int(q)), ("lotes", int(n_lotes[j])), ("vazios", int(vazios[j])),
        ("corpos_antes", int(n_antes[j])), ("corpos_depois", int(n_depois[j])),
        ("engolidos", int(engolidos[j])), ("maior_corpo_m2", round(float(maior[j]), 1)),
        ("lat", round(la, 6)), ("lon", round(lo, 6))]))

tot = collections.OrderedDict([
    ("lotes", int(NL)), ("quadras", int(NQ)),
    ("lotes_vazios", int(vazios.sum())),
    ("pct_lotes_vazios", round(100.0 * vazios.sum() / NL, 1)),
    ("corpos_antes", int(n_antes.sum())), ("corpos_depois", int(n_depois.sum())),
    ("corpos_fora_do_cadastro", fora_antes),
    ("engolidos", int(engolidos.sum())),
    ("quadras_com_engolido", int((engolidos > 0).sum())),
    ("quadras_100pct_vazias", int(((vazios == n_lotes) & (n_lotes > 0)).sum())),
    ("quadras_metade_vazia", int((vazios > n_lotes / 2).sum())),
    ("maior_corpo_m2", round(float(maior.max()), 1)),
])
print("\nresumo:")
for k, v in tot.items(): print("  %-24s %s" % (k, v))

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
io.open(SAIDA, "w", encoding="utf-8").write(json.dumps(
    {"resumo": tot, "piores": linhas}, ensure_ascii=False, indent=1))
print("\n-> %s  (%.1fs)" % (os.path.relpath(SAIDA, AQUI), time.time() - t0))
