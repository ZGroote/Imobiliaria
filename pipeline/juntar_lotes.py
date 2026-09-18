# -*- coding: utf-8 -*-
"""Monta `lotes_saocarlos_completo.geojson`: o lote de planta onde ele PRESTA, a
grade da quadra onde nao presta, e tudo recortado na borda externa da rua.

Ate aqui a juncao era simples: quadra com planta usava o lote da planta, quadra sem
planta usava a grade sintetica. O problema apareceu no mapa 3D:

1. **Quarteirao sem referencia com a rua.** Em ~200 quadras a planta caiu TORTA no
   georreferenciamento: medindo o angulo dominante dos lotes contra o eixo do proprio
   quarteirao, 77 quadras estao a mais de 15 graus (as piores, a 42 graus) e 181 tem
   mais de 20% da area em cima da rua. No mapa isso vira fileira de casa cruzando o
   quarteirao na diagonal, sem frente pra rua nenhuma.

2. **Muro em cima do asfalto.** 53% dos lotes de planta ocupados invadem a fita que o
   renderizador desenha. Como o muro e a divisa do lote, ele nasce sobre a rua.

Aqui a quadra de planta passa por um exame:

    delta  = angulo dominante dos lotes x eixo do quarteirao (periodo 90 graus:
             paralelo OU perpendicular contam como alinhado)
    fora   = fracao da area do lote que cai fora do miolo (rua ou quadra vizinha)

    reprova se delta > 15 graus  ou  fora > 20%

Quadra reprovada e REFEITA: a grade e gerada caminhando o perimetro do miolo (o mesmo
subdivide do lotes_sinteticos), mas com a **frente x fundo padrao daquela planta** -
o Santa Angelina continua 6x23 e o Embare 10x25. Perde-se o desenho da planta, que ali
estava errado; mantem-se o tamanho do terreno, que e o que a planta tem de bom.

Quadra aprovada mantem o lote da planta, recortado pelo miolo - o que tira dele
exatamente a lingueta que estava por baixo do asfalto, deixando a frente na borda
externa da rua.

  python pipeline/juntar_lotes.py     # -> v7/dados/lotes_saocarlos_completo.geojson
"""
import json, math, os, sys, collections
import numpy as np
from shapely.geometry import shape, mapping, Polygon
from shapely.ops import transform as sht, unary_union
from shapely.strtree import STRtree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from lotes_sinteticos import subdivide, largura_menor, NUCLEO_LARG_MIN, _pol

# a raiz fica UM nivel acima: o script saiu de `v7/pipeline/` pra `pipeline/`
ROOT = os.path.abspath(os.path.join(AQUI, "..")) + "/"
# o relatorio de quadras refeitas continua indo pra `v7/relatorios/`: ele e do acervo
# daquela geracao, e mover a saida junto com o script seria mudar dado de lugar
V7 = os.path.join(ROOT, "v7") + "/"
sys.path.insert(0, ROOT)
from padrao.cidade import carrega          # projecao, caminhos e limiares vem daqui
from padrao import vias

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
DELTA_MAX = CID.exame.get("desalinho_max_graus", 15.0)  # graus de desalinho tolerados
FORA_MAX = CID.exame.get("fora_do_miolo_max", 0.20)     # area do lote fora do miolo
AREA_MIN = CID.lote.get("area_min_m2", 35.0)            # sobra menor que isso nao e lote


def toutm(g): return sht(lambda x, y, z=None: CID.para_utm(x, y), g)
def tolonlat(g): return sht(lambda x, y, z=None: CID.para_geo(x, y), g)


def fita_das_ruas():
    """A mesma fita, no mesmo sistema de mapa, usada pelo portao final."""
    city = json.load(open(CID.caminho("city_base"), encoding="utf-8"))
    fitas = vias.fita(city, CID, so_dirigivel=True, juntar=False)
    return fitas, STRtree(fitas)


def eixo(poly):
    """Direcao do lado COMPRIDO do retangulo minimo, em graus (0..180)."""
    try:
        mrr = poly.minimum_rotated_rectangle
        if mrr.geom_type != "Polygon": return None
        cs = list(mrr.exterior.coords)[:4]
        e = sorted(((math.dist(cs[k], cs[(k + 1) % 4]), cs[k], cs[(k + 1) % 4])
                    for k in range(4)), reverse=True)
        _L, a, b = e[0]
        return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
    except Exception:
        return None


def desalinho(angs, eixo_quadra):
    """Angulo entre a direcao dominante dos lotes e o eixo do quarteirao.

    Periodo de 90 graus, nao 180: o lote da testada e perpendicular ao lado comprido
    da quadra e o da esquina e paralelo - os dois estao CERTOS. Com periodo 180 a
    media circular dos dois se cancela (concentracao ~0,01) e a medida vira ruido."""
    if not angs or eixo_quadra is None: return None
    v = np.array(angs) * 4 * math.pi / 180.0
    dom = math.degrees(math.atan2(np.sin(v).mean(), np.cos(v).mean())) / 4 % 90
    d = abs(dom - (eixo_quadra % 90)) % 90
    return min(d, 90 - d)


def recorta(poly, miolo):
    """Corta o lote no miolo (= quadra menos a rua desenhada). Devolve None se sobrou
    pouco. O simplify tira a serrilha que a borda da fita deixa na frente do lote."""
    try:
        p = poly.intersection(miolo)
    except Exception:
        return None
    if p.is_empty: return None
    if p.geom_type == "MultiPolygon": p = max(p.geoms, key=lambda g: g.area)
    if p.geom_type != "Polygon" or p.area < AREA_MIN: return None
    p = p.simplify(0.3)
    if p.geom_type != "Polygon" or p.area < AREA_MIN or not p.is_valid: return None
    return p


def _opcional(chave):
    """Fonte que pode nao existir numa cidade nova.

    Sem cadastro de quadra e sem planta oficial, `juntar_lotes` cai inteiro no
    sintetico -- que e exatamente o que o checklist de cidade nova do PADRAO.md manda
    fazer. Antes isso quebrava em FileNotFoundError e a etapa 4 era intransponivel."""
    p = CID.caminho(chave)
    if os.path.exists(p): return json.load(open(p, encoding="utf-8"))
    print("(sem %s: seguindo sem ele)" % os.path.basename(p))
    return {"type": "FeatureCollection", "features": []}


def main():
    q = _opcional("quadras")
    eixo_q = {}
    for f in q["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        eixo_q[f["properties"]["id"]] = eixo(toutm(g))

    mi = json.load(open(CID.caminho("miolo"), encoding="utf-8"))
    pedacos = collections.defaultdict(list)
    for f in mi["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        pedacos[f["properties"]["id"]].append(toutm(g))
    MIOLO = {k: (v[0] if len(v) == 1 else unary_union(v)) for k, v in pedacos.items()}
    print("miolo: %d quadras" % len(MIOLO))

    pl = _opcional("lotes_planta")
    porq = collections.defaultdict(list)
    for f in pl["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        porq[f["properties"]["quadra"]].append((toutm(g), dict(f["properties"])))
    print("lotes de planta: %d em %d quadras" % (sum(len(v) for v in porq.values()), len(porq)))

    si = json.load(open(CID.caminho("lotes_sinteticos"), encoding="utf-8"))
    porq_s = collections.defaultdict(list)
    for f in si["features"]:
        g = shape(f["geometry"])
        if g.geom_type != "Polygon": continue
        porq_s[f["properties"]["quadra"]].append((toutm(g), dict(f["properties"])))
    print("lotes sinteticos: %d em %d quadras" % (sum(len(v) for v in porq_s.values()), len(porq_s)))

    feats = []
    rel = []
    cont = collections.Counter()
    perdido = []
    for qi, itens in sorted(porq.items()):
        M = MIOLO.get(qi)
        angs = [a for a in (eixo(g) for g, _p in itens) if a is not None]
        area = sum(g.area for g, _p in itens)
        if M is None:
            fora = 0.0
        else:
            dentro = 0.0
            for g, _p in itens:
                try: dentro += g.intersection(M).area
                except Exception: pass
            fora = 1 - dentro / area if area > 0 else 1.0
        d = desalinho(angs, eixo_q.get(qi))
        reprova = (d is not None and d > DELTA_MAX) or fora > FORA_MAX
        lote = str(itens[0][1].get("loteamento") or "")
        planta = itens[0][1].get("planta")
        if reprova and M is not None and M.area >= 200:
            _fr0 = CID.lote.get("frente_m", 12.0); _fu0 = CID.lote.get("fundo_m", 25.0)
            fr = np.median([p.get("frente_padrao_m") or p.get("frente_m") or _fr0 for _g, p in itens])
            fu = np.median([p.get("fundo_padrao_m") or p.get("fundo_m") or _fu0 for _g, p in itens])
            fr = float(min(max(fr, 4.0), 30.0)); fu = float(min(max(fu, 10.0), 45.0))
            novos = []
            for parte in (M.geoms if M.geom_type == "MultiPolygon" else [M]):
                for lp, (nx, ny) in subdivide(parte, front=fr, depth=fu):
                    novos.append((lp, nx, ny))
            if not novos:
                cont["reprovada sem grade (mantida)"] += 1
                reprova = False
            else:
                for lp, nx, ny in novos:
                    feats.append({"type": "Feature", "geometry": mapping(tolonlat(lp)),
                                  "properties": {"quadra": qi, "loteamento": lote or None,
                                                 "planta": planta, "fonte": "planta_refeita",
                                                 "area_m2": round(lp.area, 2),
                                                 "frente_padrao_m": round(fr, 2),
                                                 "fundo_padrao_m": round(fu, 2),
                                                 "nx": round(nx, 4), "ny": round(ny, 4)}})
                cont["quadra refeita"] += 1
                rel.append((qi, lote, planta, len(itens), len(novos), d, fora, fr, fu))
                continue
        # aprovada: mantem o desenho da planta, so recortado na borda da rua
        n_ok = 0
        oficiais = []
        for g, p in itens:
            r = recorta(g, M) if M is not None else g
            if r is None:
                perdido.append(qi); continue
            p = dict(p); p["fonte"] = "planta"; p["area_m2"] = round(r.area, 2)
            feats.append({"type": "Feature", "geometry": mapping(tolonlat(r)), "properties": p})
            oficiais.append(r)
            n_ok += 1
        cont["quadra de planta mantida"] += 1
        cont["lote de planta mantido"] += n_ok
        # A PLANTA REGISTRA UMA PARTE DA QUADRA E CALA SOBRE O RESTO. A quadra de
        # planta oficial ficava 48% coberta contra 88% da grade -- e sobra de planta
        # nao e fresta entre lotes, e meia quadra (mediana de 3.796 m2 com 58,9 m de
        # largura menor; pedaco fino <6 m sao 0,2%). O complemento nasce de
        # `miolo - uniao(lotes oficiais)`, entao POR CONSTRUCAO nao invade o desenho
        # registrado, e usa a frente x fundo DAQUELA planta. Ver PIPELINE.md, 22.2.
        if M is not None and oficiais:
            _fr0 = CID.lote.get("frente_m", 12.0); _fu0 = CID.lote.get("fundo_m", 25.0)
            fr = float(np.median([p.get("frente_padrao_m") or p.get("frente_m") or _fr0
                                  for _g, p in itens]))
            fu = float(np.median([p.get("fundo_padrao_m") or p.get("fundo_m") or _fu0
                                  for _g, p in itens]))
            fr = min(max(fr, 4.0), 30.0); fu = min(max(fu, 10.0), 45.0)
            try: falta = M.difference(unary_union(oficiais))
            except Exception: falta = None
            n_c = 0
            for parte in (_pol(falta) if falta is not None else []):
                if parte.area < 200 or largura_menor(parte) < NUCLEO_LARG_MIN: continue
                for lp, (nx, ny) in subdivide(parte, front=fr, depth=fu,
                                               acesso=M.boundary):
                    feats.append({"type": "Feature", "geometry": mapping(tolonlat(lp)),
                                  "properties": {"quadra": qi, "loteamento": lote or None,
                                                 "planta": planta, "fonte": "planta_complemento",
                                                 "area_m2": round(lp.area, 2),
                                                 "frente_padrao_m": round(fr, 2),
                                                 "fundo_padrao_m": round(fu, 2),
                                                 "nx": round(nx, 4), "ny": round(ny, 4)}})
                    n_c += 1
            if n_c:
                cont["quadra completada"] += 1
                cont["lote de complemento"] += n_c

    # Quadra sem planta: a grade sintetica nasceu no miolo. O filtro viario abaixo
    # ainda confere cada parcela porque nem toda borda do miolo representa uma rua.
    for qi, itens in sorted(porq_s.items()):
        if qi in porq: continue
        for g, p in itens:
            p = dict(p); p["fonte"] = "sintetico"; p["area_m2"] = round(g.area, 2)
            feats.append({"type": "Feature", "geometry": mapping(tolonlat(g)), "properties": p})
        cont["quadra sintetica"] += 1

    # A borda do miolo nem sempre e via: pode ser recorte do cadastro, limite de uma
    # geometria invalida ou borda interna de complemento. Toda parcela GERADA precisa
    # tocar a fita viaria real. O desenho oficial fica intacto porque condominio pode
    # ter circulacao interna ausente da malha de ruas.
    fitas, arv_rua = fita_das_ruas()
    geradas = {"sintetico", "planta_refeita", "planta_complemento"}
    filtradas = []
    sem_acesso = collections.Counter()
    for f in feats:
        fonte = f["properties"].get("fonte")
        if fonte in geradas:
            g = sht(CID.geo_para_mapa, shape(f["geometry"]))
            js = arv_rua.query(g.buffer(1.0))
            # Exige contato praticamente exato na origem. A ida UTM -> lon/lat ->
            # mapa pode acumular alguns decimetros; aceitar 0,5 m aqui deixou quatro
            # casos aparecerem a 0,5-1,2 m no portao final.
            if not any(fitas[int(j)].distance(g) <= 0.05 for j in js):
                sem_acesso[fonte] += 1
                continue
        filtradas.append(f)
    feats = filtradas
    print("lotes gerados sem acesso descartados: %s" % dict(sem_acesso))

    print("--- exame das quadras de planta ---")
    for k, v in sorted(cont.items()):
        print("   %-28s %d" % (k, v))
    print("   lotes de planta perdidos no recorte: %d (em %d quadras)"
          % (len(perdido), len(set(perdido))))
    por_fonte = collections.Counter(f["properties"]["fonte"] for f in feats)
    print("total: %d lotes | %s" % (len(feats), dict(por_fonte)))

    saida = CID.caminho("lotes")
    json.dump({"type": "FeatureCollection", "features": feats}, open(saida, "w"))
    print("-> %s (%.1f MB)" % (saida, os.path.getsize(saida) / 1e6))

    os.makedirs(V7 + "relatorios", exist_ok=True)
    with open(V7 + "relatorios/quadras_refeitas.csv", "w", encoding="utf-8") as fh:
        fh.write("quadra;loteamento;planta;lotes_planta;lotes_refeitos;desalinho_graus;fora_do_miolo;frente_m;fundo_m\n")
        for r in sorted(rel, key=lambda t: -(t[5] or 0)):
            fh.write("%d;%s;%s;%d;%d;%.1f;%.3f;%.1f;%.1f\n"
                     % (r[0], r[1], r[2], r[3], r[4], r[5] or -1, r[6], r[7], r[8]))
    print("-> v7/relatorios/quadras_refeitas.csv (%d quadras)" % len(rel))


if __name__ == "__main__":
    main()
