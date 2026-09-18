# -*- coding: utf-8 -*-
"""Monta a base do mapa 3D v7: casas alinhadas ao lote, mas agora com o LOTE OFICIAL
tirado da planta urbanistica onde ele existe (21.163 lotes de 67 bairros) e o lote
sintetico 12x25 so onde nao ha planta.

Mesma logica do build_lots_city2 que gerou a base do v6. A diferenca e a fonte dos
lotes: `v7/dados/lotes_saocarlos_completo.geojson` no lugar de `lotes_saocarlos.geojson`.
Como o lote oficial nao traz a normal do fundo (nx,ny), ela e derivada aqui: aponta do
centro do lote para o centro da quadra (ou seja, pro miolo do quarteirao), e depois e
grudada no eixo da quadra pelo snap_normal - entao a frente da casa sempre olha pra rua.

  python pipeline/city_final.py
"""
import json, math, random, collections, os
from shapely.geometry import shape, Point, Polygon, LineString, MultiPolygon
from shapely.ops import transform as shpt, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer

random.seed(7)
AQUI = os.path.dirname(os.path.abspath(__file__))
# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
ROOT = os.path.abspath(os.path.join(AQUI, "..")) + "/"

import sys as _sys, os as _os
_sys.path.insert(0, ROOT)
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# Todas as fontes saem do JSON da cidade. Estavam escritas aqui, com nome de Sao
# Carlos -- era o ultimo lugar do caminho critico que impedia rodar outra cidade.
CITY = CID.caminho("city_base")
LOTES = CID.caminho("lotes")
QUADRAS = CID.caminho("quadras_completo")   # cadastro + face do grafo de
# ruas (quadras_grafo.py). TEM que ser o MESMO conjunto que gerou o quadras_miolo:
# com o cadastro puro aqui, a quadra vinda do grafo nao tinha theta nem centro, a
# casa nao era snapada ao eixo do quarteirao e o bl[] caia no grupo de fallback.
ALTURAS = CID.caminho("alturas_osm")
OUT = CID.caminho("city_saida")

city = json.load(open(CITY, encoding='utf-8')); Q = city['q']; b = city['b']; names = city['names']
CLAT, CLON = CID.clat, CID.clon; MLAT, MLON = CID.mlat, CID.mlon
fwd = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
inv = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)


def map_to_utm(mx, mz):
    lon = CLON + (mx / Q) / MLON; lat = CLAT - (mz / Q) / MLAT
    return fwd.transform(lon, lat)


def utm_to_map(x, y):
    lon, lat = inv.transform(x, y)
    return (round((lon - CLON) * MLON * Q), round(-(lat - CLAT) * MLAT * Q))


def ll_to_map(lon, lat):
    return ((lon - CLON) * MLON * Q, -(lat - CLAT) * MLAT * Q)


def decode(b):
    out = []; i = 0; n = len(b)
    while i < n:
        cls, h, npt = b[i], b[i + 1], b[i + 2]; i += 3; lx = lz = 0; ring = []
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2; ring.append((lx, lz))
        out.append([cls, h, ring])
    return out


recs = decode(b)
bm = city.get('bm', []); namemap = {bm[i]: (bm[i + 1], bm[i + 2]) for i in range(0, len(bm), 3)}


def real_name(idx):
    if idx not in namemap: return False
    ni, _ = namemap[idx]; nm = names[ni] if 0 <= ni < len(names) else ''
    return bool(nm and nm.strip())


# alturas reais do OSM -> mantem o predio e seta a altura verdadeira
# Altura real do OSM e opcional: cidade sem `building:levels` mapeado segue sem ela.
oh = json.load(open(ALTURAS, encoding='utf-8')) if _os.path.exists(ALTURAS) else []
oh_pts = [Point(*fwd.transform(x['lon'], x['lat'])) for x in oh]
oh_h = [x['h'] for x in oh]
oh_tree = STRtree(oh_pts)


def match_height(ring):
    cxd = sum(p[0] for p in ring) / len(ring); czd = sum(p[1] for p in ring) / len(ring)
    ux, uy = map_to_utm(cxd, czd); p = Point(ux, uy)
    best = None; bd = 18.0
    for j in oh_tree.query(p.buffer(18)):
        d = oh_pts[j].distance(p)
        if d < bd and oh_h[j] >= 9.0: bd = d; best = j
    return oh_h[best] if best is not None else None


# keep = comercio/civico OR nome real OR predio com altura real do OSM
kept = []; hset = 0; kept_face = []
for idx, (cls, h, ring) in enumerate(recs):
    hm = match_height(ring)
    if hm is not None:
        kept.append((cls if cls in (2, 3) else 1, round(hm * Q), ring, idx)); kept_face.append(None); hset += 1
    elif cls in (2, 3) or real_name(idx):
        kept.append((cls, h, ring, idx)); kept_face.append(None)
print('mantidos', len(kept), '| alturas OSM aplicadas', hset)

# ---- SITIO: o poligono que engole RUA nao e uma edificacao -----------------
# A regra inteira (e o porque de cada numero) mora em `padrao/sitios.py`. Ela saiu daqui
# em 03/09/2026 porque ganhou um SEGUNDO chamador -- o `pipeline/recorta_sitios.py`, que
# aplica o mesmo recorte a uma base ja pronta (o footprint cru que a variante proxy usa).
# Duas copias da mesma regra e a divida que a tabela de vias ja cobrou uma vez aqui.
from padrao import vias as _vias
from padrao import sitios as _sitios


def _nome_de(oi):
    if oi is None or oi not in namemap: return ''
    ni, _ = namemap[oi]
    return names[ni] if 0 <= ni < len(names) else ''


kept, kept_face, _ns, _nm = _sitios.separa(
    kept, kept_face, _vias.eixos(city, CID), CID, Q, nome_de=_nome_de)
print('sitios recortados', _ns, '-> massas', _nm, '| predios agora', len(kept))

# ---- lotes: oficiais (planta) onde existe, sinteticos no resto -------------
lots = json.load(open(LOTES, encoding='utf-8'))
lg = [shpt(lambda x, y, z=None: fwd.transform(x, y), shape(f['geometry'])) for f in lots['features']]
props = [dict(f['properties']) for f in lots['features']]
n_of = sum(1 for p in props if p.get('fonte') != 'sintetico')
print('lotes', len(lg), '| de planta oficial', n_of, '| sinteticos', len(lg) - n_of)
tree = STRtree(lg)

# --- angulo dominante (grade) por quadra, em UTM ---
# quad_utm  = a quadra OFICIAL, que vai ate o eixo da rua (serve pro sinal da normal)
# miolo_utm = a quadra MENOS a rua desenhada (quadras_miolo.geojson). E ela que recorta
#             a casa: recortar pela quadra oficial deixava passar a faixa entre o eixo
#             e a borda externa da rua - ou seja, casa em cima do asfalto.
_quad = json.load(open(QUADRAS, encoding='utf-8'))
theta_of = {}; quad_utm = {}; quad_cent = {}
for f in _quad['features']:
    g = shpt(lambda x, y, z=None: fwd.transform(x, y), shape(f['geometry']))
    if g.geom_type != 'Polygon': continue
    qid = f['properties']['id']
    quad_utm[qid] = g.buffer(0)
    quad_cent[qid] = (g.centroid.x, g.centroid.y)
    try:
        xy = list(g.minimum_rotated_rectangle.exterior.coords)
        theta_of[qid] = math.atan2(xy[1][1] - xy[0][1], xy[1][0] - xy[0][0]) % (math.pi / 2)
    except Exception:
        theta_of[qid] = 0.0

_mio = json.load(open(CID.caminho("miolo"), encoding='utf-8'))
_ped = collections.defaultdict(list)
for f in _mio['features']:
    g = shpt(lambda x, y, z=None: fwd.transform(x, y), shape(f['geometry']))
    if g.geom_type == 'Polygon' and g.is_valid: _ped[f['properties']['id']].append(g)
miolo_utm = {}
for k, v in _ped.items():
    try: miolo_utm[k] = v[0] if len(v) == 1 else unary_union(v)
    except Exception: pass
print('miolo (quadra sem a rua desenhada)', len(miolo_utm), 'quadras')

# --- normal do fundo (nx,ny) para o lote OFICIAL, que nao traz esse campo ---
# O EIXO vem do proprio lote: terreno e sempre mais fundo que largo, entao o lado
# COMPRIDO do retangulo minimo do lote e a direcao frente->fundo. O centro da quadra
# so decide o SINAL (pra qual ponta fica o fundo).
#
# NAO usar "aponta pro centro da quadra" como eixo: em quadra comprida, o lote da
# ponta ve o centro do quarteirao quase na direcao do comprimento, o snap pega o eixo
# errado e o lote passa a ler 23 m de frente x 6 m de fundo - a casa vira uma barra
# atravessada em cima das vizinhas e o dedup derruba a quadra inteira.
sem_normal = 0
for i, pr in enumerate(props):
    if pr.get('nx') is not None and pr.get('ny') is not None: continue
    g = lg[i]; c = g.centroid
    try:
        r = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
        e1 = (r[1][0] - r[0][0], r[1][1] - r[0][1])
        e2 = (r[2][0] - r[1][0], r[2][1] - r[1][1])
        comp = e1 if (e1[0] ** 2 + e1[1] ** 2) >= (e2[0] ** 2 + e2[1] ** 2) else e2
        d = math.hypot(*comp)
        vx, vy = (comp[0] / d, comp[1] / d) if d > 1e-6 else (0.0, 1.0)
    except Exception:
        vx, vy = 0.0, 1.0
    qc = quad_cent.get(pr.get('quadra'))
    if qc is not None and (vx * (qc[0] - c.x) + vy * (qc[1] - c.y)) < 0:
        vx, vy = -vx, -vy          # fundo aponta pro miolo da quadra, frente pra rua
    pr['nx'], pr['ny'] = vx, vy
    sem_normal += 1
print('normais derivadas (lote sem nx/ny)', sem_normal)


SNAP_MAX = math.radians(22.0)


def snap_normal(nx, ny, theta):
    """Gruda a frente da casa no eixo da quadra - MAS so se ja estiver perto dele.

    O `theta` vem do minimum_rotated_rectangle da quadra INTEIRA, ou seja, um angulo
    unico. Em quadra ortogonal isso e otimo: corrige a serrilha da vetorizacao raster
    e alinha a fileira. Em quadra de rua CURVA (condominio tipo Faber/Damha) nao
    significa nada - e o snap girava a casa ate 40 graus fora da testada do lote,
    que era a "casa em sentido estranho" perto do shopping. 32% dos lotes giravam
    mais de 10 graus, 5,5% mais de 40.

    Fora da tolerancia, manda a normal do PROPRIO lote - que e perpendicular a
    testada por construcao."""
    a = math.atan2(ny, nx); best = None; bd = 9
    for k in range(4):
        d = theta + k * (math.pi / 2)
        diff = abs(((a - d + math.pi) % (2 * math.pi)) - math.pi)
        if diff < bd: bd = diff; best = d
    if bd > SNAP_MAX: return (nx, ny)
    return (math.cos(best), math.sin(best))


def lot_of(x, y):
    p = Point(x, y)
    for i in tree.query(p):
        if lg[i].contains(p): return i
    return None


# predios mantidos em UTM, num indice espacial. NAO usar so o centroide: o Iguatemi
# tem 29.385 m2 e cobre dezenas de lotes - excluir apenas o lote do centro deixava
# casa nascer DENTRO do shopping (493 casas em 96 predios grandes na versao anterior).
kept_poly = []
for cls, h, ring, idx in kept:
    try:
        pu = shpt(lambda x, y, z=None: map_to_utm(x, y), Polygon(ring))   # ring vem em DECIMETROS
        if pu.is_valid and pu.area > 0: kept_poly.append(pu)
    except Exception:
        pass
kept_tree = STRtree(kept_poly) if kept_poly else None
print('predios mantidos com poligono valido', len(kept_poly))

# SO ONDE HA PROVA: lote com ponto de endereco do SigaSC ou footprint residencial do
# Overture dentro dele (ver ocupacao.py). O preenchimento total punha casa em 77% de
# lotes sem nenhuma evidencia - no raio do Moradas Sao Carlos I eram 635 casas pra 13
# enderecos conhecidos. Lote vazio agora fica vazio, que e o que ele e.
OCUPADOS = set(json.load(open(CID.caminho("lotes_ocupados"), encoding="utf-8")))
print('lotes com prova de construcao', len(OCUPADOS), 'de', len(lg))

excl = set()
if kept_tree is not None:
    for i, L in enumerate(lg):
        for j in kept_tree.query(L):
            try:
                if L.intersection(kept_poly[j]).area > 0.30 * L.area:
                    excl.add(i); break
            except Exception:
                pass
print('lotes cobertos por predio mantido (excluidos)', len(excl))
occ = [i for i in OCUPADOS if i not in excl and 0 <= i < len(lg)]
print('lotes que recebem casa', len(occ),
      '(%d com prova, menos %d cobertos por predio real)' % (len(OCUPADOS), len(OCUPADOS) - len(occ)))


# ---- MODELOS DE CASA -------------------------------------------------------
# As plantas dizem que existem 486 combinacoes frente x fundo, mas so 5 FRENTES
# distintas (10, 11, 6, 12, 5 m) cobrem 80% dos lotes. A frente define o partido
# da casa; o fundo varia continuo. Dai 4 classes por frente, com 4 modelos cada,
# sorteados por lote.
#
# REGRA DE OURO: todo volume tem que ser RETANGULAR e ter o lado curto > 3,2 m,
# senao o renderer nega telhado de duas aguas (`ob.rect > 0.76 && ob.hv > 1.6`
# em predios.js) e a casa vira caixa de laje. Por isso o "L" sao DOIS retangulos
# encostados, nao um poligono em L - poligono em L tem rect ~0,7 e cai pra laje.
#
# E CUIDADO com area < 34 m2 e altura < 4,4 m: isso e ST.ANEXO na tipologia, que
# tem telha:0. Volume principal nunca pode cair nessa faixa.
CLASSES = [
    # (nome,      frente_max, lateral, recuo_max)
    ("ESTREITO",     7.5, 0.55, 2.5),
    ("PADRAO",      11.5, 1.20, 4.0),
    ("LARGO",       16.0, 1.80, 4.5),
    ("GRANDE",      1e9,  3.00, 6.0),
]
P_EDICULA = 0.12          # so 12% dos lotes tem edicula no fundo (era ~66%)
FUNDO_MIN_EDICULA = 22.0  # e so onde o quintal comporta


PROP_MIN = 1.15   # a casa ENTRA no lote: fundo sempre maior que a frente
# O FUNDO DO LOTE NAO E O FUNDO DA CASA. A tabela CLASSES da `recuo` e `prof` como
# FRACAO da profundidade utilizavel, e ela foi calibrada no lote de 25 m. Desde que o
# lote passou a ir da rua ate o meio da quadra (lotes_sinteticos.fundo_ate_o_meio), a
# mesma fracao num lote de 43 m gerava casa de 19 m de profundidade -- galpao, nao
# casa, e colidindo com a do outro lado da quadra. A casa ocupa a FRENTE do terreno; o
# resto e quintal. Entao a fracao mede sobre este referencial, e o lote continua sendo
# o limite fisico. Ver PIPELINE.md, secao 21, item 4.
PROF_REF = float(CID.lote.get("fundo_m", 25.0))


def entra_no_lote(W, D):
    """Casa de rua tem a frente na rua e o corpo entrando no terreno. Se a largura
    na testada passar da profundidade, a casa fica DEITADA ao longo da rua - foi o
    que o usuario apontou ("a rua na horizontal e a casa tambem"). 25% estavam assim.
    Quando o lote nao comporta a profundidade, quem cede e a largura."""
    if D < W * PROP_MIN:
        W = D / PROP_MIN
    return max(3.0, W), D


def classe_do_lote(w):
    for k, (nome, wmax, lat, fsmax) in enumerate(CLASSES):
        if w < wmax: return k
    return len(CLASSES) - 1


# ---- PARTIDOS DE CASA (v11) -------------------------------------------------
# Eram quatro (bloco, garagem, sobrado, L) e "bloco" pesava 2/3: a maioria das casas
# saia como UMA caixa, e todas entre 3,4 e 4,3 m de altura. Vista de cima, uma rua
# inteira de prisma igual -- o que o usuario chamou de "parecer Roblox".
#
# Agora sao 20, tirados das fotos de fachada de Sao Carlos e Ribeirao. O que os separa
# nao e enfeite: e a PROPORCAO e o NUMERO DE MASSAS, que e o que se le a 130 m.
#
#   * `prof` maior que `larg`  -> a cumeeira corre fundo-adentro e a EMPENA fica pra rua
#     (o triangulo do frontao, o partido mais comum nas fotos das casas 1925/2026);
#   * `prof` menor que `larg`  -> a AGUA cai pra rua, com beiral (casa 906, 115);
#   * `alt` >= 4,4 com area grande -> o renderizador da platibanda reta e esconde o
#     telhado (casa 846, 896: muro alto liso, nenhuma telha aparente);
#   * garagem frontal BAIXA -> laje na frente e telhado atras (casa 906, 105/115).
#
# REGRA DE OURO, herdada: todo volume RETANGULAR e lado curto > 3,2 m, senao o
# renderizador nega telhado de duas aguas e a casa vira caixa de laje. Volume
# principal nunca com area < 34 m2 E altura < 4,4 m ao mesmo tempo (viraria ST.ANEXO,
# que tem telha:0).
#
#   recuo    fracao do recuo maximo da classe. 0 = casa alinhada na testada.
#   larg     fracao da largura util do lote.
#   prof     fracao da profundidade utilizavel.
#   alt      metros.
#   gar      garagem/varanda BAIXA na frente: (larg, prof_m, alt, lado)
#            lado: -1 esquerda, +1 direita, 0 centro, None sorteia.
#   anexo    segundo volume colado ao lado (o "L"): (larg, prof, delta_altura)
#   colado   ocupa a largura INTEIRA do lote, sem afastamento lateral (geminada)
PARTIDOS = [
 # --- terrea de empena pra rua: o partido mais comum nas fotos ---------------
 ("empena_estreita",  9, dict(recuo=0.7, larg=(0.72,0.88), prof=(0.42,0.58), alt=(3.5,4.2))),
 ("empena_funda",     7, dict(recuo=0.5, larg=(0.62,0.76), prof=(0.55,0.72), alt=(3.6,4.3))),
 ("empena_geminada",  5, dict(recuo=0.4, larg=(0.96,1.0), prof=(0.45,0.60), alt=(3.4,4.0), colado=True)),
 # --- terrea de agua pra rua, com beiral ------------------------------------
 ("agua_larga",       7, dict(recuo=0.8, larg=(0.88,1.0), prof=(0.30,0.42), alt=(3.4,4.1))),
 ("agua_recuada",     5, dict(recuo=1.0, larg=(0.80,0.94), prof=(0.32,0.44), alt=(3.5,4.2))),
 # --- laje com platibanda reta (nenhuma telha aparente) ---------------------
 ("platibanda",       6, dict(recuo=0.6, larg=(0.84,1.0), prof=(0.38,0.52), alt=(4.5,5.1))),
 ("platibanda_alta",  4, dict(recuo=0.3, larg=(0.90,1.0), prof=(0.34,0.46), alt=(5.0,5.6))),
 # --- com garagem/varanda baixa na frente -----------------------------------
 ("gar_lateral",      8, dict(recuo=0.5, larg=(0.86,1.0), prof=(0.34,0.48), alt=(3.6,4.3),
                              gar=((0.42,0.56), (4.2,6.0), (2.6,3.0), None))),
 ("gar_central",      4, dict(recuo=0.6, larg=(0.88,1.0), prof=(0.32,0.44), alt=(3.7,4.4),
                              gar=((0.50,0.62), (4.0,5.4), (2.7,3.1), 0))),
 ("gar_larga",        4, dict(recuo=0.4, larg=(0.90,1.0), prof=(0.30,0.42), alt=(4.4,5.0),
                              gar=((0.62,0.80), (4.4,6.2), (2.8,3.2), 0))),
 ("varanda",          4, dict(recuo=0.9, larg=(0.80,0.94), prof=(0.34,0.48), alt=(3.6,4.3),
                              gar=((0.34,0.46), (2.6,3.4), (2.8,3.2), None))),
 # --- em L: dois retangulos encostados --------------------------------------
 ("L_curto",          5, dict(recuo=0.6, larg=(0.46,0.56), prof=(0.46,0.60), alt=(3.6,4.3),
                              anexo=((0.42,0.52), (0.30,0.42), (-0.7,-0.3)))),
 ("L_fundo",          4, dict(recuo=0.5, larg=(0.50,0.60), prof=(0.55,0.70), alt=(3.7,4.4),
                              anexo=((0.38,0.48), (0.26,0.36), (-0.9,-0.4)))),
 ("L_alto",           3, dict(recuo=0.4, larg=(0.48,0.58), prof=(0.44,0.58), alt=(4.6,5.2),
                              anexo=((0.40,0.50), (0.28,0.38), (-1.4,-0.8)))),
 # --- sobrado ---------------------------------------------------------------
 ("sobrado",          6, dict(recuo=0.7, larg=(0.76,0.92), prof=(0.36,0.50), alt=(6.0,7.0))),
 ("sobrado_gar",      5, dict(recuo=0.4, larg=(0.84,1.0), prof=(0.34,0.46), alt=(6.2,7.4),
                              gar=((0.44,0.58), (4.4,5.8), (2.8,3.2), None))),
 ("sobrado_estreito", 3, dict(recuo=0.5, larg=(0.62,0.74), prof=(0.48,0.62), alt=(6.4,7.6))),
 ("sobrado_geminado", 3, dict(recuo=0.3, larg=(0.96,1.0), prof=(0.40,0.54), alt=(6.0,7.0), colado=True)),
 # --- caixa simples: continua existindo, mas deixou de ser a regra ----------
 ("bloco",            8, dict(recuo=0.6, larg=(0.78,0.96), prof=(0.38,0.54), alt=(3.4,4.3))),
 ("bloco_fundo",      4, dict(recuo=0.5, larg=(0.66,0.80), prof=(0.52,0.68), alt=(3.5,4.4))),
]
_PESOS = [p[1] for p in PARTIDOS]
_ACUM = []
_s = 0
for _w in _PESOS:
    _s += _w
    _ACUM.append(_s)
_TOTAL = _s


def sorteia_partido(rnd, k):
    """Sorteia respeitando o peso. Lote ESTREITO (classe 0) nao comporta garagem ao
    lado nem L: cai nos partidos de massa unica."""
    while True:
        a = rnd.random() * _TOTAL
        for i, lim in enumerate(_ACUM):
            if a <= lim:
                nome, _w, cfg = PARTIDOS[i]
                if k == 0 and ("gar" in cfg or "anexo" in cfg):
                    break                       # sorteia de novo
                return nome, cfg


def casa_do_lote(pr, lotpoly, rnd):
    """Devolve ([(ring_utm, altura_m), ...], facing). A casa pode ter mais de um volume."""
    th = theta_of.get(pr.get('quadra'), 0.0)
    nx, ny = snap_normal(pr['nx'], pr['ny'], th); tx, ty = -ny, nx
    coords = list(lotpoly.exterior.coords)
    ts = [x * tx + y * ty for x, y in coords]; ns = [x * nx + y * ny for x, y in coords]
    t0, t1 = min(ts), max(ts); n0, n1 = min(ns), max(ns)
    w = t1 - t0; dpt = n1 - n0
    if w < 3.6 or dpt < 8.0: return [], 0

    k = classe_do_lote(w)
    nome, wmax, LAT, FSMAX = CLASSES[k]
    LAT = min(LAT, w * 0.14)
    tc = (t0 + t1) / 2.0

    def ret(ta, tb, na, nb):
        pts = [(ta, na), (tb, na), (tb, nb), (ta, nb)]
        return [(t * tx + n * nx, t * ty + n * ny) for t, n in pts]

    def U(par):
        return rnd.uniform(par[0], par[1])

    vols = []
    for tentativa in (0, 1, 2):
        partido, cfg = (("bloco", dict(recuo=0.6, larg=(0.78, 0.96), prof=(0.38, 0.54),
                                       alt=(3.4, 4.3)))
                        if tentativa == 2 else sorteia_partido(rnd, k))
        colado = cfg.get("colado", False)
        lat = 0.15 if colado else LAT
        Wt = max(3.4, w - 2 * lat)
        FS = min(FSMAX, min(dpt, PROF_REF) * 0.12) * cfg["recuo"]
        livre = dpt - FS - 2.0
        if livre < 6.0:
            continue
        # a fracao mede sobre o lote de referencia; `livre` continua sendo o teto fisico
        livre_ref = min(livre, max(6.0, PROF_REF - FS - 2.0))

        gar = cfg.get("gar")
        Dg = 0.0
        if gar:
            Dg = min(U(gar[1]), livre_ref * 0.30)

        W = Wt * U(cfg["larg"])
        D = max(5.5, min(livre - Dg - 0.5, livre_ref * U(cfg["prof"])))
        alt = U(cfg["alt"])
        # A casa entra no lote: o corpo e mais fundo que largo. Excecao para os
        # partidos de AGUA PRA RUA, que sao largos de proposito -- e a proporcao que
        # faz o renderizador virar a cumeeira. Sem a excecao, "agua_larga" era
        # reescrito em empena e os dois partidos viravam o mesmo.
        if not partido.startswith("agua") and D < W * PROP_MIN:
            W = D / PROP_MIN
        W = max(3.4, W)
        if W * D < 34 and alt < 4.4:
            continue                                    # viraria ST.ANEXO
        if min(W, D) < 3.3:
            continue

        vols = []
        anexo = cfg.get("anexo")
        if anexo:
            W2 = Wt * U(anexo[0]); D2 = max(5.0, min(livre, livre_ref * U(anexo[1])))
            if W2 < 3.6 or W2 * D2 < 45 or W * D < 45:
                continue
            lado = -1 if rnd.random() < 0.5 else 1
            ta = tc - Wt / 2 if lado < 0 else tc + Wt / 2 - W
            vols.append((ret(ta, ta + W, n0 + FS, n0 + FS + D), alt))
            tb = ta + W if lado < 0 else ta - W2
            vols.append((ret(tb, tb + W2, n0 + FS, n0 + FS + D2), alt + U(anexo[2])))
        else:
            off = 0.0 if colado else (Wt - W) * rnd.uniform(-0.5, 0.5)
            vols.append((ret(tc - W / 2 + off, tc + W / 2 + off,
                             n0 + FS + Dg + (0.4 if gar else 0.0),
                             n0 + FS + Dg + (0.4 if gar else 0.0) + D), alt))
        if gar:
            Wg = Wt * U(gar[0])
            if Wg >= 3.4:
                lado = gar[3]
                if lado is None: lado = -1 if rnd.random() < 0.5 else 1
                tg = tc if lado == 0 else tc + lado * (Wt / 2 - Wg / 2)
                vols.append((ret(tg - Wg / 2, tg + Wg / 2, n0 + FS, n0 + FS + Dg),
                             U(gar[2])))
        if vols:
            break

    if not vols:
        return [], 0

    # edicula no fundo: excecao, nao regra
    Wt = max(3.4, w - 2 * LAT)
    if dpt >= FUNDO_MIN_EDICULA and rnd.random() < P_EDICULA and Wt > 5.0:
        We = min(Wt * 0.55, 5.5); De = rnd.uniform(3.0, 4.5)
        if n1 - 1.2 - De > n0 + 8.0:
            vols.append((ret(tc - We / 2, tc + We / 2, n1 - 1.2 - De, n1 - 1.2),
                         rnd.uniform(2.6, 3.1)))

    dentro = lotpoly.buffer(-0.15, join_style=2)
    out = []
    for anel, alt in vols:
        try: fp = Polygon(anel).intersection(dentro)
        except Exception: continue
        if fp.is_empty: continue
        if fp.geom_type == 'MultiPolygon': fp = max(fp.geoms, key=lambda g: g.area)
        if fp.geom_type != 'Polygon' or fp.area < 6: continue
        fp = fp.simplify(0.2)
        if fp.geom_type != 'Polygon' or fp.area < 6: continue
        out.append((list(fp.exterior.coords)[:-1], alt))
    if not out: return [], 0
    cen = Polygon(out[0][0]).centroid
    cm = utm_to_map(cen.x, cen.y); fm = utm_to_map(cen.x - nx * 5, cen.y - ny * 5)
    facing = round(math.degrees(math.atan2(fm[1] - cm[1], fm[0] - cm[0]))) % 360
    return out, facing


kept_utm = []
for cls, h, ring, idx in kept:
    try:
        pu = shpt(lambda x, y, z=None: map_to_utm(x, y), Polygon(ring))
        if pu.is_valid and pu.area > 0: kept_utm.append(pu)
    except Exception:
        pass

from collections import defaultdict as _dd
grid = _dd(list); CELL = 15.0


def gkey(x, y): return (int(x // CELL), int(y // CELL))


for pu in kept_utm:
    c = pu.centroid; grid[gkey(c.x, c.y)].append((pu, (c.x, c.y), False))


def near2(x, y):
    for gx in range(int(x // CELL) - 1, int(x // CELL) + 2):
        for gy in range(int(y // CELL) - 1, int(y // CELL) + 2):
            for q in grid[(gx, gy)]: yield q


MINDC = 2.0
skipped = 0; clipped = 0; volumes = 0
# `skipped` sozinho nao diz NADA sobre o que consertar: sao quatro causas diferentes
# com consertos diferentes. Com a base sintetica ele fica baixo e ninguem perguntou;
# com o cadastro oficial saltou pra 59.737 (30% dos lotes ocupados) e a primeira
# pergunta -- "qual dos quatro?" -- nao tinha resposta no log.
por_que = collections.Counter()
# sorteio ESTAVEL por lote: semeado pela coordenada do centroide (decimetro), entao
# o mesmo lote tira sempre o mesmo modelo, independente da ordem de processamento.
for li in occ:
    cL = lg[li].centroid
    rnd = random.Random((int(cL.x * 10) << 21) ^ int(cL.y * 10))
    vols, facing = casa_do_lote(props[li], lg[li], rnd)
    if not vols: skipped += 1; por_que['1 lote nao comporta casa (w<3,6 ou prof<8)'] += 1; continue

    _qi = props[li].get('quadra')
    qp = miolo_utm.get(_qi) or quad_utm.get(_qi)   # o miolo, que ja exclui a rua
    prontos = []
    for anel, alt in vols:
        poly = Polygon(anel)
        if not poly.is_valid: poly = poly.buffer(0)
        if poly.is_empty or poly.geom_type != 'Polygon': continue
        if qp is not None:
            try: fora = poly.area - poly.intersection(qp).area   # o que passa pra rua
            except Exception: fora = 0
            if fora > 1.5:
                try: poly = poly.intersection(qp)
                except Exception: continue
                if poly.is_empty: continue
                if poly.geom_type == 'MultiPolygon': poly = max(poly.geoms, key=lambda g: g.area)
                if getattr(poly, 'geom_type', '') != 'Polygon' or poly.area < 8: continue
                poly = poly.simplify(0.4); clipped += 1
        prontos.append((poly, alt))
    if not prontos: skipped += 1; por_que['2 recortado fora do miolo'] += 1; continue

    # o dedup decide pelo volume PRINCIPAL; se ele passa, os anexos vao junto
    poly, _alt = prontos[0]
    c = poly.centroid; cx, cy = c.x, c.y; hit = False
    # o grid de 15 m so guarda o predio na celula do CENTROIDE dele: um galpao de
    # 200 m fica invisivel pra casa a 30 m do centro. Predio mantido vai pelo STRtree.
    if kept_tree is not None:
        for j in kept_tree.query(poly):
            try:
                if poly.intersection(kept_poly[j]).area > 0.25 * poly.area: hit = True; break
            except Exception:
                pass
    if hit: skipped += 1; por_que['3 sobre footprint mantido'] += 1; continue
    motivo4 = ''
    for (q, (qx, qy), is_h) in near2(cx, cy):
        try:
            if is_h and math.hypot(cx - qx, cy - qy) < MINDC:
                hit = True; motivo4 = 'centroide a menos de %.1f m de outra casa' % MINDC; break
            if poly.intersection(q).area > 0.50 * min(poly.area, q.area):
                hit = True; motivo4 = 'sobrepoe outra casa gerada'; break
        except Exception:
            pass
    if hit: skipped += 1; por_que['4 ' + motivo4] += 1; continue

    for k2, (pv, alt) in enumerate(prontos):
        cc = pv.centroid
        grid[gkey(cc.x, cc.y)].append((pv, (cc.x, cc.y), True))
        mring = [utm_to_map(x, y) for x, y in list(pv.exterior.coords)[:-1]]
        kept.append((1, round(alt * Q), mring, None))
        kept_face.append(facing if k2 == 0 else 400)   # seta so no volume da frente
        volumes += 1

print('volumes gerados (casa + ala/edicula):', volumes)
print('casas recortadas pela quadra', clipped)
print('casas puladas (coladas/sobrepostas)', skipped)
for _k, _v in por_que.most_common():
    print('    %-46s %7d  (%.1f%%)' % (_k, _v, 100.0 * _v / max(skipped, 1)))
print('total predios', len(kept))

# ---- agrupa por quadra e re-encoda ----------------------------------------
quad = json.load(open(QUADRAS, encoding='utf-8'))
qpolys = []; qids = []
for f in quad['features']:
    g = shape(f['geometry'])
    if g.geom_type == 'Polygon':
        qpolys.append(Polygon([ll_to_map(x, y) for x, y in g.exterior.coords])); qids.append(f['properties']['id'])
qt = STRtree(qpolys)


def cent(ring): return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


groups = collections.defaultdict(list); SYN = 8500
for k, (cls, h, ring, oi) in enumerate(kept):
    cx, cz = cent(ring); p = Point(cx, cz); gid = None
    for i in qt.query(p):
        if qpolys[i].contains(p): gid = ('q', qids[i]); break
    if gid is None: gid = ('s', int(cx // SYN), int(cz // SYN))
    groups[gid].append(k)


def push(arr, ring):
    arr.append(len(ring)); lx = lz = 0
    for x, z in ring: arr.append(x - lx); arr.append(z - lz); lx, lz = x, z


nb = []; bl = []; nbm = []; bidx = 0; nfa = []
for gid, members in groups.items():
    start = bidx; verts = []
    for k in members:
        cls, h, ring, oi = kept[k]
        nb.append(cls); nb.append(h); push(nb, ring)
        nfa.append(kept_face[k] if kept_face[k] is not None else 400)
        if oi is not None and oi in namemap:
            ni, ai = namemap[oi]; nbm.extend([bidx, ni, ai])
        for x, z in ring: verts.append((x, z))
        bidx += 1
    cxi = int(round(sum(v[0] for v in verts) / len(verts))); czi = int(round(sum(v[1] for v in verts) / len(verts)))
    far = max(math.hypot(v[0] - cxi, v[1] - czi) for v in verts)
    bl.extend([cxi, czi, int(math.ceil(far)), start, len(members)])
tri = sorted((nbm[i], nbm[i + 1], nbm[i + 2]) for i in range(0, len(nbm), 3))
nbm = [v for t in tri for v in t]
out = dict(city); out['b'] = nb; out['bl'] = bl; out['bm'] = nbm; out['fa'] = nfa
json.dump(out, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print('FINAL predios %d | bl %d | bm %d | fa %d | %.1f MB -> %s'
      % (bidx, len(bl) // 5, len(nbm) // 3, len(nfa), os.path.getsize(OUT) / 1e6, OUT))
