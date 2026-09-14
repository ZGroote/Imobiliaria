# -*- coding: utf-8 -*-
"""Cadastro oficial de Ribeirao Preto -> `quadras_completo`, `miolo` e `lotes`.

Substitui as etapas 1b/2/3/4 ONDE a prefeitura cobre, e deixa o que ja existia onde
ela nao cobre. O dado oficial tem preferencia; o sintetico vira tapa-buraco.

POR QUE ISTO NAO E "MAIS UMA FONTE DE LOTE" E SIM UMA TROCA DE ETAPA:

  A quadra oficial PARA NA DIVISA. Medido: (area dos lotes)/(area da quadra) = 1,00
  em p10, p50 e p90 -- os lotes ladrilham a quadra exatamente. A quadra do pipeline,
  por contrato, vai ate o EIXO DA VIA, e a etapa 2 subtrai a fita da rua pra chegar no
  miolo. Aplicar a etapa 2 na quadra oficial subtrairia uma fita que ja nao esta la e
  comeria a frente dos lotes. Entao aqui a quadra oficial JA E o miolo, e a etapa 2
  nao roda em cima dela.

  Pela mesma razao a etapa 4 (exame por quadra) nao se aplica: ela existe pra pegar
  planta escaneada que caiu torta no georreferenciamento. O cadastro da prefeitura
  nasce georreferenciado, e lote e quadra vem do MESMO cadastro -- sao consistentes por
  construcao. Rodar o exame so criaria a chance de reprovar dado bom (previsto: 9% das
  quadras reprovariam contra o miolo ANTIGO, jogando fora cadastro pra por grade).

O que cada numero era antes desta troca:

  quadras   6.380 reconstruidas (cadastro parcial + face do grafo)  -> 11.276 oficiais
  lotes   187.859 sinteticos (grade 12x25 no miolo)                 -> 231.474 oficiais
  orfaos   38.335 lotes oficiais sem quadra do pipeline (16,6%)     ->     98 (0,04%)

  python pipeline/fontes/cadastro_rp.py
  python pipeline/fontes/cadastro_rp.py --so-relatorio    # mede e nao escreve
"""
import collections, io, json, math, os, sys, time

import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform as sht, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
sys.stdout.reconfigure(encoding="utf-8")
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "ribeirao-preto"))
FONTES = os.path.join(RAIZ, "ribeirao-preto", "fontes")
QOF = os.path.join(FONTES, "quadras_oficiais_geoportal.geojson")
LOF = os.path.join(FONTES, "lotes_oficiais_geoportal.geojson")
SO_REL = "--so-relatorio" in sys.argv

F4326 = Transformer.from_crs("EPSG:4326", CID.epsg_utm, always_xy=True)
I4326 = Transformer.from_crs(CID.epsg_utm, "EPSG:4326", always_xy=True)
FGEO = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
IGEO = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)
u4326 = lambda g: sht(lambda x, y, z=None: F4326.transform(x, y), g)
ugeo = lambda g: sht(lambda x, y, z=None: FGEO.transform(x, y), g)
degeo = lambda g: sht(lambda x, y, z=None: IGEO.transform(x, y), g)

t0 = time.time()


def valido(g):
    if g is None or g.is_empty: return None
    if not g.is_valid: g = g.buffer(0)
    if g.is_empty: return None
    if g.geom_type == "MultiPolygon": g = max(g.geoms, key=lambda p: p.area)
    return g if g.geom_type == "Polygon" else None


def eixo_de(g):
    """Angulo do lado maior do retangulo envolvente, em graus [0,180)."""
    mr = g.minimum_rotated_rectangle
    c = list(mr.exterior.coords)[:4]
    if len(c) < 4: return 0.0
    k = max(range(3), key=lambda i: math.hypot(c[i+1][0]-c[i][0], c[i+1][1]-c[i][1]))
    return math.degrees(math.atan2(c[k+1][1]-c[k][1], c[k+1][0]-c[k][0])) % 180.0


# ---- quadras oficiais ---------------------------------------------------------
qd = json.load(io.open(QOF, encoding="utf-8"))
QO, nula = {}, 0
for f in qd["features"]:
    if not f.get("geometry"): nula += 1; continue
    g = valido(u4326(shape(f["geometry"])))
    if g is None: nula += 1; continue
    QO[int(f["properties"]["id"])] = g
print("quadras oficiais: %d validas (%d descartadas)  (%.0fs)" % (len(QO), nula, time.time() - t0))

kq = list(QO.keys())
GQ = np.array([QO[k] for k in kq], dtype=object)
TQ = STRtree(GQ)
AREA_OFICIAL = sum(g.area for g in GQ)
print("  area coberta pelo cadastro oficial: %.1f km2  (%.0fs)"
      % (AREA_OFICIAL / 1e6, time.time() - t0))


def cobertura(g):
    """Fracao de `g` coberta pelo cadastro oficial.

    Contra a uniao global isto levava 20 min (a uniao de 11 mil quadras vira um
    poligono gigante e cada intersecao percorre o mundo). Unindo so os vizinhos que a
    arvore devolve, cai pra segundos e da o MESMO numero: quadra que nao aparece na
    consulta nao intersecta, entao nao entra na conta de jeito nenhum.
    """
    if g.area <= 0: return 1.0
    viz = [GQ[i] for i in TQ.query(g)]
    if not viz: return 0.0
    try: return unary_union(viz).intersection(g).area / g.area
    except Exception: return 1.0

# ---- lotes oficiais -----------------------------------------------------------
lo = json.load(io.open(LOF, encoding="utf-8"))
porq = collections.defaultdict(list)
orf = 0
for f in lo["features"]:
    if not f.get("geometry"): orf += 1; continue
    g = valido(u4326(shape(f["geometry"])))
    if g is None: orf += 1; continue
    c = g.centroid
    dono = None
    for i in TQ.query(c):
        if GQ[i].contains(c): dono = int(i); break
    if dono is None: orf += 1; continue
    porq[kq[dono]].append((g, f["properties"]))
nlot = sum(len(v) for v in porq.values())
print("lotes oficiais: %d em %d quadras | orfaos %d  (%.0fs)"
      % (nlot, len(porq), orf, time.time() - t0))

# ---- quadras ANTIGAS que o oficial nao cobre ----------------------------------
# Criterio: a quadra antiga entra so se MENOS DE 30% dela ja esta coberta pelo
# cadastro oficial. Acima disso ela e a mesma quadra vista pela fonte pior, e manter
# as duas geraria lote sobreposto -- casa dentro de casa.
qa = json.load(io.open(CID.caminho("quadras_completo"), encoding="utf-8"))
antigas, cobertas = {}, 0
for f in qa["features"]:
    if not f.get("geometry"): continue
    g = valido(ugeo(shape(f["geometry"])))
    if g is None: continue
    if cobertura(g) >= 0.30: cobertas += 1; continue
    antigas[f["properties"]["id"]] = g
print("quadras antigas: %d cobertas pelo oficial | %d mantidas como tapa-buraco  (%.0fs)"
      % (cobertas, len(antigas), time.time() - t0))

# lotes antigos das quadras mantidas
la = json.load(io.open(CID.caminho("lotes"), encoding="utf-8"))
antigos = collections.defaultdict(list)
for f in la["features"]:
    qi = f["properties"].get("quadra")
    if qi in antigas and f.get("geometry"):
        g = valido(ugeo(shape(f["geometry"])))
        if g is not None: antigos[qi].append((g, f["properties"]))
print("lotes antigos preservados: %d  (%.0fs)"
      % (sum(len(v) for v in antigos.values()), time.time() - t0))

if SO_REL:
    print("\n(--so-relatorio: nada foi escrito)")
    sys.exit(0)

# ---- emite -------------------------------------------------------------------
# `id` unico entre as duas fontes: o oficial fica com o id da prefeitura, o antigo
# ganha 900000000+ pra nunca colidir.
OFF = 900000000
fq, fm, fl = [], [], []
for k, g in QO.items():
    gg = degeo(g)
    p = {"id": k, "fonte": "cadastro_oficial", "area_m2": round(g.area, 1)}
    fq.append({"type": "Feature", "geometry": mapping(gg), "properties": p})
    # a quadra oficial JA E o miolo -- ver o cabecalho
    fm.append({"type": "Feature", "geometry": mapping(gg), "properties": {"id": k}})
for k, g in antigas.items():
    gg = degeo(g)
    p = {"id": OFF + int(k), "fonte": "grafo_ruas", "area_m2": round(g.area, 1)}
    fq.append({"type": "Feature", "geometry": mapping(gg), "properties": p})

# miolo das quadras antigas: reaproveita o miolo JA CALCULADO pela etapa 2, senao a
# fita seria subtraida duas vezes (ou nenhuma) e o muro sairia do lugar.
mi = json.load(io.open(CID.caminho("miolo"), encoding="utf-8"))
for f in mi["features"]:
    if f["properties"]["id"] in antigas and f.get("geometry"):
        fm.append({"type": "Feature", "geometry": f["geometry"],
                   "properties": {"id": OFF + int(f["properties"]["id"])}})


# NAO gravar `nx`/`ny` aqui. Foi o que eu fiz na primeira versao -- normal apontando do
# centro do lote pro centro da quadra, grudada no eixo da QUADRA -- e o `build_v7_city`
# ja avisa, em comentario, por que isso quebra:
#
#   "o snap pega o eixo errado e o lote passa a ler 23 m de frente x 6 m de fundo -
#    a casa vira uma barra atravessada em cima das vizinhas e o dedup derruba a
#    quadra inteira"
#
# O eixo tem que sair do PROPRIO lote (lado comprido do retangulo minimo); o centro da
# quadra so decide o SINAL. O `build_v7_city` faz exatamente isso para todo lote que
# chega SEM o campo -- entao a correcao e omitir, nao reimplementar.
#
# Medido numa amostra de 30.000 lotes, pela regra `w < 3,6 ou prof < 8` que descarta a
# casa: com a normal do centro da quadra reprovavam 10,8%; com o eixo do proprio lote,
# 0,3%. Na build inteira isso era 59.495 casas puladas (99,6% de todos os descartes),
# que o log chamava de "coladas/sobrepostas" e nao eram.
lid = 0
for k, itens in porq.items():
    for g, p in itens:
        c = g.centroid
        fl.append({"type": "Feature", "geometry": mapping(degeo(g)), "properties": {
            "lid": lid, "quadra": k,
            "fx": round(c.x, 1), "fy": round(c.y, 1),
            "fonte": "cadastro_oficial", "area_m2": round(g.area, 1),
            "inscricao": p.get("inscricao"), "logradouro": p.get("nome_logradouro"),
            "numero": p.get("numero"), "cep": p.get("cep")}})
        lid += 1
for k, itens in antigos.items():
    for g, p in itens:
        q = dict(p); q["lid"] = lid; q["quadra"] = OFF + int(k)
        fl.append({"type": "Feature", "geometry": mapping(degeo(g)), "properties": q})
        lid += 1


def grava(caminho, feats):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    io.open(caminho, "w", encoding="utf-8").write(json.dumps(
        {"type": "FeatureCollection", "features": feats}, ensure_ascii=False))
    print("  -> %-52s %6d feicoes  %.1f MB"
          % (os.path.relpath(caminho, RAIZ), len(feats), os.path.getsize(caminho) / 1048576))


print("\ngravando:")
grava(CID.caminho("quadras_completo"), fq)
grava(CID.caminho("miolo"), fm)
grava(CID.caminho("lotes"), fl)
print("\nquadras %d (%d oficiais + %d antigas) | lotes %d (%d oficiais + %d antigos)"
      % (len(fq), len(QO), len(antigas), len(fl), nlot,
         sum(len(v) for v in antigos.values())))
print("(%.0fs)" % (time.time() - t0))
