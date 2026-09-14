# -*- coding: utf-8 -*-
"""Grade de lotes sintetica sobre o MIOLO da quadra (quadras_miolo.geojson) e nao
sobre o poligono cheio - que vai ate o eixo da rua e por isso fazia todo lote
sintetico nascer em cima do asfalto.

Quadra comum e dividida da rua ate o meio. Gleba larga conserva um nucleo livre quando
nao existe rua ou viela que sustente outra fileira. Enquanto a fileira puxava DEPTH
metros fixos (25 m), a quadra comum de 86 m ficava com 36 m de nada no meio; a regra
abaixo fecha esse caso sem transformar o miolo de glebas em lotes cegos.

Sao quatro coisas, e cada uma so apareceu depois da anterior:

1. `fundo_ate_o_meio`: lanca um raio da testada pra dentro, mede a travessia da quadra
   ALI e usa METADE. A fileira da face oposta mede a mesma travessia, entao as duas se
   encontram no meio. Quadra concava faz o raio sair e voltar: vale o trecho que COMECA
   na testada, nao a soma.
2. Teto pela largura menor da quadra. Sem ele a face CURTA media a travessia no sentido
   comprido (130 m numa quadra de 130 x 86) e puxava lote de 65 m, que comia metade do
   quarteirao e deixava o resto em lasca.
3. Teto de `lote.fundo_max_m`, CONDICIONAL: so corta quando o que sobra ainda da uma
   fileira de fundo inteira. Na quadra comum de 86 m, 35 + 35 deixaria um nucleo de
   16 m -- estreito demais pra virar fileira e grande demais pra ser absorvido -- e
   reabriria exatamente o defeito da secao 21.
4. `sem_sobra` + `funde_inuteis`: sobras estreitas entram no lote vizinho de maior
   divisa compartilhada. Nucleo largo permanece livre: sem rua ou viela confirmada,
   ele nao pode virar uma segunda fileira de lotes cegos. Lote que nao comporta casa
   tambem entra no vizinho, em vez de ganhar muro sem ganhar casa.

  python v7/pipeline/lotes_sinteticos.py
"""
import json, math, os
from shapely.geometry import shape, Point, Polygon, LineString, mapping
from shapely.ops import transform as sht, unary_union
from pyproj import Transformer

AQUI = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.abspath(os.path.join(AQUI, "..")) + "/"
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "..")))
from padrao.cidade import carrega as _carrega
CID = _carrega(_os.environ.get("CIDADE", "sao-carlos"))
# CRS e tamanho de terreno saem do JSON da cidade. Estavam escritos aqui: o fuso de
# Sao Carlos (29193) e o lote 12x25 dela.
FWD = Transformer.from_crs(CID.epsg_geo, CID.epsg_utm, always_xy=True)
INV = Transformer.from_crs(CID.epsg_utm, CID.epsg_geo, always_xy=True)
FRONT = float(CID.lote.get('frente_m', 12.0))
DEPTH = float(CID.lote.get('fundo_m', 25.0))
FUNDO_MAX = float(CID.lote.get('fundo_max_m', 35.0))
AREA_MIN = float(CID.lote.get('area_min_m2', 35.0))

# Testada minima. O recorte por `feito` deixa caco de 2-3 m de frente na quina: passa
# na area e no retangulo, mas o build_v7_city recusa (w < 3,6) e o lote fica so com
# muro -- eram 9.729 assim na primeira rodada da secao 21.
FRENTE_MIN = 5.0
# Lote mais raso que isto nao comporta casa. Nao sao os 8 m da regra do build_v7_city:
# ele ainda desconta o recuo (livre >= 6, ~9,1 m) e mede no eixo da QUADRA.
FUNDO_UTIL_MIN = 11.0
# Nucleo mais estreito que isto nao vira fileira -- e absorvido pelos vizinhos. Duas
# fileiras de fundo minimo: abaixo disso nem uma das duas comporta casa.
NUCLEO_LARG_MIN = 2 * FUNDO_UTIL_MIN


def _pol(g):
    """Os poligonos de uma geometria qualquer, ignorando linha e ponto."""
    if g.is_empty: return []
    if g.geom_type == "Polygon": return [g]
    return [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]


def largura_menor(poly):
    """Lado CURTO do retangulo minimo. E a travessia mais estreita da quadra."""
    try:
        c = list(poly.minimum_rotated_rectangle.exterior.coords)
    except Exception:
        return 0.0
    if len(c) < 4: return 0.0
    return min(math.dist(c[0], c[1]), math.dist(c[1], c[2]))


def fundo_ate_o_meio(poly, mx, my, nx, ny, alcance=600.0):
    """Metade da travessia da quadra medida NA TESTADA, e nao um fundo fixo.

    Quadra concava faz o raio sair e voltar: vale o trecho que COMECA na testada,
    nao a soma -- somar atravessaria o vao e daria um lote do outro lado da rua."""
    raio = LineString([(mx, my), (mx + nx * alcance, my + ny * alcance)])
    try:
        tr = raio.intersection(poly)
    except Exception:
        return None
    if tr.is_empty: return None
    partes = [tr] if tr.geom_type == "LineString" else [g for g in getattr(tr, "geoms", [])
                                                       if g.geom_type == "LineString"]
    p0 = Point(mx, my)
    daqui = [g for g in partes if g.distance(p0) < 0.5]
    if not daqui: return None
    return max(g.length for g in daqui) / 2.0


def _fundo_do_passo(poly, mx, my, nx, ny, teto_quadra, depth):
    """O fundo desta testada: ate o meio, limitado pela quadra e pelo teto da cidade."""
    if depth is not None:
        return float(depth)                       # a planta manda; sem_sobra fecha o resto
    d = fundo_ate_o_meio(poly, mx, my, nx, ny)
    if d is None: return DEPTH
    d = min(d, teto_quadra)
    # O teto de fundo e CONDICIONAL: cortar em FUNDO_MAX so vale se o nucleo que sobra
    # ainda der uma fileira de fundo. Senao o corte reabre o miolo vazio.
    if d > FUNDO_MAX and 2 * (d - FUNDO_MAX) >= NUCLEO_LARG_MIN:
        d = FUNDO_MAX
    return max(d, 1.0)


def _fileira(poly, front, depth):
    """Uma volta no perimetro: passo de `front` metros, puxando o fundo pra dentro."""
    lots = []
    ext = poly.exterior
    L = ext.length
    if L < front: return lots
    teto_quadra = largura_menor(poly) / 2.0
    feito = None
    n = max(1, int(round(L / front)))
    step = L / n
    if step < FRENTE_MIN: return lots
    for i in range(n):
        s = i * step
        p0 = ext.interpolate(s); p1 = ext.interpolate(min(s + step, L))
        fx, fy = p1.x - p0.x, p1.y - p0.y
        fl = math.hypot(fx, fy)
        if fl < FRENTE_MIN: continue
        nx, ny = -fy / fl, fx / fl
        mx, my = (p0.x + p1.x) / 2, (p0.y + p1.y) / 2
        if not poly.contains(Point(mx + nx * 0.5, my + ny * 0.5)): nx, ny = -nx, -ny
        d = _fundo_do_passo(poly, mx, my, nx, ny, teto_quadra, depth)
        a = (p0.x, p0.y); b = (p1.x, p1.y)
        c = (p1.x + nx * d, p1.y + ny * d); e = (p0.x + nx * d, p0.y + ny * d)
        try: lot = Polygon([a, b, c, e]).intersection(poly)
        except Exception: continue
        if lot.is_empty or lot.area < AREA_MIN: continue
        if feito is not None:
            try: lot = lot.difference(feito)      # nao invade lote ja criado nesta quadra
            except Exception: pass
        if lot.is_empty: continue
        if lot.geom_type == "MultiPolygon": lot = max(lot.geoms, key=lambda g: g.area)
        if lot.geom_type != "Polygon" or lot.area < AREA_MIN: continue
        # Terreno e quadrilatero. O que sai daqui com contorno curvo e SOBRA: a quadra
        # foi recortada por rotatoria ou balao de retorno (199 aneis fechados na malha,
        # raio 11-16 m) e o pedaco que restou virava lote em forma de arco.
        lot = lot.simplify(0.5).intersection(poly)
        # Simplificar move a borda alguns centimetros e pode recolocar area dentro
        # de um lote ja aceito. O recorte final preserva a invariavel sem sobreposicao.
        if feito is not None:
            try: lot = lot.difference(feito)
            except Exception: continue
        if lot.geom_type == "MultiPolygon": lot = max(lot.geoms, key=lambda g: g.area)
        if lot.geom_type != "Polygon" or lot.area < AREA_MIN: continue
        mrr = lot.minimum_rotated_rectangle
        if mrr.area <= 0 or lot.area / mrr.area < 0.62: continue
        # `difference(feito)` pode arrancar a testada em quina irregular e deixar
        # somente o fundo da parcela. Sem contato com a borda da quadra ela nao tem
        # acesso comprovado e deve permanecer como espaco livre, sem muro ou casa.
        if lot.distance(poly.exterior) > 0.5: continue
        lots.append((lot, (nx, ny)))
        feito = lot if feito is None else feito.union(lot)
    return lots


def _divisa(a, b):
    """Comprimento da divisa compartilhada entre dois lotes."""
    try:
        i = a.buffer(0.2).intersection(b.buffer(0.2))
    except Exception:
        return 0.0
    return i.area / 0.4 if not i.is_empty else 0.0


def _absorve(lots, sobras):
    """Cada sobra entra no VIZINHO de maior divisa compartilhada.

    E como um loteamento real fecha a quadra: a cunha da esquina fica pro lote de
    esquina, e nao vira um triangulo murado sozinho no meio do quarteirao.

    O indice nao muda o resultado -- lote longe tem divisa zero de qualquer jeito --,
    so evita o par a par: na gleba com 300 lotes e 400 sobras eram 120 mil buffers."""
    if not lots or not sobras: return lots
    from shapely.strtree import STRtree
    arv = STRtree([g for g, _n in lots])
    for s in sobras:
        melhor, dmax = None, 0.6
        for k in arv.query(s.buffer(0.3)):
            d = _divisa(lots[int(k)][0], s)
            if d > dmax: melhor, dmax = int(k), d
        if melhor is None: continue
        try: u = lots[melhor][0].union(s)
        except Exception: continue
        if u.geom_type == "Polygon" and u.is_valid:
            # A sobra ja foi simplificada na origem. Simplificar novamente depois da
            # uniao desloca a divisa e pode invadir o lote ao lado.
            lots[melhor] = (u, lots[melhor][1])
    return lots


def _fundo_do_lote(lot, n):
    """Extensao do lote no sentido em que ele foi puxado pra dentro da quadra."""
    nx, ny = n
    v = [x * nx + y * ny for x, y in lot.exterior.coords]
    return max(v) - min(v)


def funde_inuteis(lots):
    """Lote que nao comporta casa nao e lote.

    Ele continua com prova de ocupacao, entao ganhava MURO e nao ganhava casa: quintal
    murado vazio no meio do quarteirao. Eram 9,4% dos lotes antes deste conserto."""
    bons = [t for t in lots if _fundo_do_lote(*t) >= FUNDO_UTIL_MIN]
    ruins = [t[0] for t in lots if _fundo_do_lote(*t) < FUNDO_UTIL_MIN]
    if not bons: return lots            # quadra inteira rasa: melhor rasa que vazia
    return _absorve(bons, ruins)


def sem_sobra(poly, lots):
    """Absorve apenas frestas; preserva nucleo largo sem acesso confirmado."""
    try:
        resto = poly.difference(unary_union([g for g, _n in lots])) if lots else poly
    except Exception:
        return lots
    frestas = [g for g in _pol(resto)
               if g.area >= 2.0 and largura_menor(g) < FRENTE_MIN]
    return _absorve(lots, frestas)


def subdivide(poly, front=None, depth=None, acesso=None):
    """Cria a fileira acessivel; `acesso` e a borda que representa rua.

    Por padrao a propria borda de `poly` e acessivel. No complemento de uma planta,
    `poly` pode ser apenas o vazio interno; nesse caso o chamador passa a borda do
    miolo da quadra para que a divisa interna nao seja confundida com rua.
    """
    front = FRONT if front is None else float(front)
    depth = None if depth is None else float(depth)
    if poly.geom_type != 'Polygon' or poly.area < 120: return []
    lots = _fileira(poly, front, depth)
    if not lots: return []
    lots = sem_sobra(poly, lots)
    lots = funde_inuteis(lots)
    acesso = poly.exterior if acesso is None else acesso
    return [t for t in lots if t[0].distance(acesso) <= 0.5]


def main():
    q = json.load(open(CID.caminho("miolo"), encoding="utf-8"))
    feats = []; lid = 0
    for _n, f in enumerate(q["features"], 1):
        if _n % 500 == 0:
            print("  %d/%d quadras | %d lotes" % (_n, len(q["features"]), len(feats)), flush=True)
        g = sht(lambda x, y, z=None: FWD.transform(x, y), shape(f["geometry"]))
        if g.geom_type != "Polygon": continue
        for lot, (nx, ny) in subdivide(g):
            c = lot.centroid
            feats.append({"type": "Feature",
                          "properties": {"lid": lid, "quadra": f["properties"]["id"],
                                         "nx": round(nx, 4), "ny": round(ny, 4),
                                         "fx": round(c.x - nx * DEPTH * 0.35, 1),
                                         "fy": round(c.y - ny * DEPTH * 0.35, 1)},
                          "geometry": mapping(sht(lambda x, y, z=None: INV.transform(x, y), lot))})
            lid += 1
    saida = CID.caminho("lotes_sinteticos")
    json.dump({"type": "FeatureCollection", "features": feats}, open(saida, "w"))
    print("-> %s | %d lotes sinteticos em %d quadras (%.1f MB)"
          % (saida, len(feats), len(q["features"]), os.path.getsize(saida) / 1e6))


def demo():
    """Confere as tres regras de fundo em quadra de laboratorio.

        python v7/pipeline/lotes_sinteticos.py --demo

    Nao substitui `pipeline/cobertura_da_quadra.py`, que mede a cidade real. Serve
    pra pegar a regressao na hora: sem o `fundo_ate_o_meio` a quadra de 86 m volta a
    ficar com 36 m de nada no meio, e nada no pipeline quebra -- so a foto muda."""
    comum = Polygon([(0, 0), (120, 0), (120, 86), (0, 86)])       # quarteirao comum
    lots = subdivide(comum)
    u = unary_union([g for g, _n in lots])
    cob = u.area / comum.area
    fundos = [_fundo_do_lote(g, n) for g, n in lots]
    assert cob >= 0.90, "quadra de 86 m ficou com %.0f%% de cobertura" % (100 * cob)
    assert min(fundos) >= FUNDO_UTIL_MIN - 0.5, "sobrou lote de %.1f m de fundo" % min(fundos)
    # 43 + 43 = 86: o teto de 35 NAO pode cortar aqui (deixaria nucleo de 16 m).
    assert max(fundos) > FUNDO_MAX, "o teto cortou a quadra comum e reabriu o miolo vazio"
    sobreposta = sum(a.intersection(b).area
                     for i, (a, _x) in enumerate(lots) for b, _y in lots[i + 1:])
    assert sobreposta < 1.0, "lotes se sobrepoem em %.1f m2" % sobreposta

    gleba = Polygon([(0, 0), (200, 0), (200, 190), (0, 190)])     # gleba de 190 m
    lotes_gleba = subdivide(gleba)
    fundos = [_fundo_do_lote(g, n) for g, n in lotes_gleba]
    fundos.sort()
    meio = fundos[len(fundos) // 2]
    assert meio <= FUNDO_MAX + 1, "gleba de 190 m deu lote de %.0f m de fundo" % meio
    cegos = [g for g, _n in lotes_gleba if g.distance(gleba.exterior) > 0.5]
    assert not cegos, "%d lotes internos nasceram sem acesso a rua" % len(cegos)
    nucleo = gleba.difference(unary_union([g for g, _n in lotes_gleba]))
    assert nucleo.area > 5000, "gleba grande perdeu o espaco interno coerente"

    # Esquina irregular do trecho C: o recorte pelos lotes anteriores arrancava a
    # testada de uma parcela e deixava 92 m2 isolados, 3,9 m longe da rua.
    irregular = Polygon([(0,74.3),(19.2,69),(39.7,63.8),(38.9,60.5),(36.1,48.6),
                         (35.6,45),(36,39.4),(38.3,34.9),(41.2,32.6),(51.5,27.9),
                         (69.7,26.1),(78.3,27.1),(77.9,30.6),(80.8,28.6),(85.3,34.8),
                         (89.4,45.6),(86.1,46.8),(89.6,46.2),(90.6,51),(106.2,49.9),
                         (150.3,33.7),(178.1,24.3),(195.1,18.9),(202.2,17.1),
                         (196.2,5.9),(3.2,0)])
    lotes_irregulares = subdivide(irregular)
    cegos = [g for g, _n in lotes_irregulares if g.distance(irregular.exterior) > 0.5]
    assert not cegos, "esquina irregular gerou lote sem testada"
    sobreposta = sum(a.intersection(b).area for i, (a, _n) in enumerate(lotes_irregulares)
                     for b, _m in lotes_irregulares[i + 1:])
    assert sobreposta < 0.1, "esquina irregular sobrepos lotes em %.1f m2" % sobreposta

    # Complemento de planta pode ser um vazio totalmente interno. A borda desse
    # vazio nao e rua; quando o chamador fornece a borda acessivel da quadra, nenhuma
    # parcela desse miolo pode sobreviver.
    quadra = Polygon([(0,0),(120,0),(120,100),(0,100)])
    vazio_interno = Polygon([(30,30),(90,30),(90,70),(30,70)])
    assert not subdivide(vazio_interno, acesso=quadra.exterior), \
        "complemento interno virou lote sem acesso"
    print("demo ok: quadra comum %.0f%% de cobertura; gleba de 190 m com fundo "
          "mediano %.0f m, p90 %.0f m (a cauda e a cunha de esquina absorvida)"
          % (100 * cob, meio, fundos[int(0.9 * len(fundos))]))


if __name__ == "__main__":
    if "--demo" in _sys.argv: demo()
    else: main()
