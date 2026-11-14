"""Motor de viabilidade: Lote + Zona + premissas -> estudo (dict no formato do viabilidade/README.md, contrato v3).

Tudo em metros UTM. Determinístico: sem relógio, sem acaso, coordenadas arredondadas.
"""
import math

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, unary_union

VERSAO = "0.4.0"

# Premissas de projeto (não são lei). Quem chamar pode trocar qualquer uma; as que ficarem
# no valor daqui saem listadas em premissas.padrao (aparecem como "padrão" no relatório).
PREMISSAS_PADRAO = {
    "pe_direito_m": 3.0,
    "pe_direito_terreo_m": 4.5,
    "area_privativa_por_unidade_m2": 60,
    "eficiencia": 0.8,                 # área privativa / área construída (sem garagem)
    "area_comum_por_pavimento_m2": 40,  # hall + escada + elevador; a privativa nunca passa da laje menos isso
    "nucleo_nao_computavel_m2": 20,    # escada + elevador + shaft por pavimento: fora do CA e da TO (COE art. 51)
    "vagas_por_unidade": 1,
    "area_por_vaga_m2": 27,            # vaga + circulação
    "garagem": "subsolo",              # "subsolo" desenha os níveis; outro valor só soma a área
    "subsolos_max": 2,
    "garagem_computavel": False,       # se a zona disser, a zona manda
    "recuo_frontal_m": 4.0,            # só vale quando a lei não define (null)
    "preco_venda_m2_privativo": None,  # sem preço, VGV fica null
    "laje_torre_max_m2": 500,          # maior pavimento-tipo que chamamos de "torre"
    "laje_minima_m2": 80,              # abaixo disso a opção é descartada
    "afastamento_entre_torres_m": 6.0,
    "pavimentos_lamina_max": 4,        # "prédio baixo": até 4 andares
    "pavimentos_embasamento": 2,
    "embasamento_ocupacao": 0.4,       # fração do lote que o embasamento ocupa (escolha de projeto, não lei). Fixa de propósito:
                                       # se crescesse com a TO ou o recuo, afrouxar a regra gastaria CA no embasamento e pioraria a torre
}
FOLGA_LIMITE = 0.98  # usar >= 98% do limite gera alerta "no limite"
PAV_BUSCA_MAX = 200  # teto da busca de pavimentos


# ---------- geometria ----------

def _r(v, n=2):
    return round(v + 0.0, n)  # +0.0 tira o -0.0


def _coords(poly):
    return [[_r(x), _r(y)] for x, y in list(poly.exterior.coords)[:-1]]


def _maior_parte(geom):
    if geom.is_empty:
        return Polygon()
    if geom.geom_type == "Polygon":
        return geom
    return max((g for g in geom.geoms if g.geom_type == "Polygon"), key=lambda g: g.area, default=Polygon())


def eixos_da_frente(frente, lote):
    """u = ao longo da frente, v = da rua pra dentro do lote."""
    (x1, y1), (x2, y2) = frente
    L = math.hypot(x2 - x1, y2 - y1)
    u = ((x2 - x1) / L, (y2 - y1) / L)
    v = (-u[1], u[0])
    c = lote.centroid
    if (c.x - x1) * v[0] + (c.y - y1) * v[1] < 0:
        v = (-v[0], -v[1])
    return u, v


def caixa_recuada(lote, frente, rf, rl, rb):
    """Tira do lote a faixa de recuo de cada aresta: frente (rf), fundos/oposta (rb) e laterais (rl)."""
    u, v = eixos_da_frente(frente, lote)
    pts = list(lote.exterior.coords)
    faixas = []
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-6:
            continue
        # normal da aresta apontando pra FORA do lote, comparada com v (que aponta pra dentro)
        nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
        if lote.contains(Point((a[0] + b[0]) / 2 + nx * 0.01, (a[1] + b[1]) / 2 + ny * 0.01)):
            nx, ny = -nx, -ny
        d = -(nx * v[0] + ny * v[1])  # 1 = aresta de frente, -1 = fundos
        recuo = rf if d > 0.7 else rb if d < -0.7 else rl
        if recuo > 0:
            faixas.append(LineString([a, b]).buffer(recuo))
    return _maior_parte(lote.difference(unary_union(faixas)) if faixas else lote)


def _para_local(geom, origem, u):
    """Gira pra o eixo u virar x (frente na horizontal)."""
    return affinity.rotate(geom, -math.degrees(math.atan2(u[1], u[0])), origin=origem)


def _para_mundo(geom, origem, u):
    return affinity.rotate(geom, math.degrees(math.atan2(u[1], u[0])), origin=origem)


def _arestas(regiao):
    """Arestas da fronteira como array (n, 2, 2)."""
    out = []
    for g in ([regiao] if regiao.geom_type == "Polygon" else regiao.geoms):
        for anel in [g.exterior, *g.interiors]:
            c = np.asarray(anel.coords)
            out.append(np.stack([c[:-1], c[1:]], axis=1))
    return np.concatenate(out)


def _centros(regiao, arestas, w, d):
    """Onde o centro de um retângulo w x d (eixos locais) pode ficar sem sair da região.
    Exato: o retângulo toca a borda quando o centro está a até meio retângulo de alguma aresta,
    então tiramos da região o 'varrido' de cada aresta pelo retângulo."""
    cantos = np.array([(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)])
    pts = (arestas[:, :, None, :] + cantos[None, None, :, :]).reshape(-1, 2)  # 8 pontos por aresta
    varridos = shapely.convex_hull(shapely.multipoints(pts, indices=np.repeat(np.arange(len(arestas)), 8)))
    return regiao.difference(shapely.union_all(varridos))


def _enxuta(regiao):
    """A caixa vem de um buffer redondo com centenas de vértices; 3 mm de tolerância bastam e deixam o encaixe ~10x mais rápido."""
    return regiao.simplify(0.003)


def _ancora(regiao):
    return regiao.centroid if regiao.contains(regiao.centroid) else regiao.representative_point()


def _maior_s(viavel, lo, hi, passos=14, testa_lo=True):
    """Maior s em [lo, hi] com viavel(s) (viável em s => viável em qualquer s menor). None se nem lo cabe."""
    if testa_lo and not viavel(lo):
        return None
    if viavel(hi):
        return hi
    for _ in range(passos):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if viavel(mid) else (lo, mid)
    return lo


def maior_retangulo(regiao, proporcao, area_max=None, contem=None):
    """Maior retângulo com largura/profundidade = proporcao que cabe na região, EM QUALQUER POSIÇÃO.
    (Antes ele ficava centrado no centro da região: quando o recuo afrouxava de um lado só, o centro
    andava e o retângulo encolhia, mesmo o antigo ainda cabendo. Era a causa da opção D piorar.)
    Entre as posições possíveis, a mais perto do centro da região. `contem`: polígono que ele precisa cobrir."""
    if regiao.is_empty:
        return Polygon()
    regiao = _enxuta(regiao)
    ar, sp = _arestas(regiao), math.sqrt(proporcao)
    x0, y0, x1, y1 = regiao.bounds
    lo = 0.0
    if contem is not None:
        tx0, ty0, tx1, ty1 = contem.bounds
        lo = max((tx1 - tx0) / sp, (ty1 - ty0) * sp)

    def centros(s):
        w, d = s * sp, s / sp
        e = _centros(regiao, ar, w, d)
        if contem is not None and not e.is_empty:  # o centro tem que deixar o retângulo cobrir `contem`
            e = e.intersection(box(tx1 - w / 2, ty1 - d / 2, tx0 + w / 2, ty0 + d / 2))
        return e

    hi = min((x1 - x0) / sp, (y1 - y0) * sp)
    if area_max is not None:
        if contem is not None and area_max < lo * lo - 1e-9:
            return Polygon()
        hi = min(hi, math.sqrt(area_max))  # a tampa de área manda: não adianta procurar acima dela
    s = _maior_s(lambda v: not centros(v).is_empty, max(lo, 1e-3), max(hi, lo, 1e-3), testa_lo=contem is not None)
    if s is None:
        return Polygon()
    e = centros(s)
    c = nearest_points(e, _ancora(regiao))[0]
    w, d = s * sp, s / sp
    return box(c.x - w / 2, c.y - d / 2, c.x + w / 2, c.y + d / 2)


# Proporções testadas na lâmina. Lista FIXA (não depende da caixa): com a do retângulo da caixa, afrouxar a
# regra mudava a lista de tentativas e a lâmina podia sair menor.
PROPORCOES_LAMINA = (0.2, 0.25, 0.33, 0.4, 0.5, 0.67, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0)


def _maior_lamina(regiao, area_max, contem=None):
    """Maior retângulo (qualquer proporção da lista). Experimenta primeiro a proporção mais parecida com a da
    caixa e só troca por outra se for MAIOR (empate fica com a primeira); pula as que, pelo tamanho da caixa,
    não têm como ganhar. Poda exata: o resultado é o mesmo de testar todas."""
    if regiao.is_empty:
        return Polygon()
    x0, y0, x1, y1 = regiao.bounds
    W, H = x1 - x0, y1 - y0
    alvo = math.log(max(W / max(H, 1e-6), 1e-6))
    melhor = Polygon()
    for p in sorted(PROPORCOES_LAMINA, key=lambda p: abs(math.log(p) - alvo)):
        sp = math.sqrt(p)
        teto = min(W / sp, H * sp) ** 2
        if area_max is not None:
            teto = min(teto, area_max)
        if teto <= melhor.area + 1e-4:
            continue
        r = maior_retangulo(regiao, p, area_max, contem)
        if r.area > melhor.area + 1e-4:
            melhor = r
    return melhor


def dois_quadrados(regiao, folga, area_max=None):
    """Dois quadrados IGUAIS, os maiores que cabem na região com `folga` entre eles (em x ou em y).
    Exato: dois quadrados de lado s cabem se os centros possíveis se estendem por pelo menos s + folga
    num dos eixos. Devolve [] se não couber."""
    if regiao.is_empty:
        return []
    regiao = _enxuta(regiao)
    ar = _arestas(regiao)
    x0, y0, x1, y1 = regiao.bounds

    def folga_eixo(s):
        e = _centros(regiao, ar, s, s)
        if e.is_empty or e.area <= 0:
            return None
        bx0, by0, bx1, by1 = e.bounds
        return e, max((bx1 - bx0) - (s + folga), (by1 - by0) - (s + folga))

    hi = max(min(x1 - x0, y1 - y0), 1e-3)
    if area_max is not None:
        hi = min(hi, math.sqrt(area_max))
    s = _maior_s(lambda v: (r := folga_eixo(v)) is not None and r[1] >= 0, 1e-3, hi)
    if s is None:
        return []
    e, sobra = folga_eixo(s)
    bx0, by0, bx1, by1 = e.bounds
    horiz = (bx1 - bx0) >= (by1 - by0)
    a = _ancora(regiao)

    def ponta(eixo, lado):  # ponto de e na ponta do eixo, na altura mais perto da âncora
        if eixo == 0:
            faixa = box(bx0 if lado == 0 else bx1, by0 - 1, (bx0 if lado == 0 else bx1), by1 + 1).buffer(1e-9)
            alvo = Point(bx0 if lado == 0 else bx1, a.y)
        else:
            faixa = box(bx0 - 1, by0 if lado == 0 else by1, bx1 + 1, (by0 if lado == 0 else by1)).buffer(1e-9)
            alvo = Point(a.x, by0 if lado == 0 else by1)
        return nearest_points(e.intersection(faixa), alvo)[0]

    eixo = 0 if horiz else 1
    q1, q2 = ponta(eixo, 0), ponta(eixo, 1)
    ext = (bx1 - bx0) if horiz else (by1 - by0)
    k = (sobra / 4) / ext if ext > 0 else 0  # sobrando espaço, aproxima as duas torres: metade da sobra entre elas
    cs = [(q1.x + (q2.x - q1.x) * k, q1.y + (q2.y - q1.y) * k), (q2.x - (q2.x - q1.x) * k, q2.y - (q2.y - q1.y) * k)]
    dentro = regiao.buffer(1e-6)
    quadrados = [box(x - s / 2, y - s / 2, x + s / 2, y + s / 2) for x, y in cs]
    if not all(dentro.contains(q) for q in quadrados):  # região torta: as pontas exatas sempre servem
        quadrados = [box(p.x - s / 2, p.y - s / 2, p.x + s / 2, p.y + s / 2) for p in (q1, q2)]
    return quadrados


# ---------- recuo por altura ----------

def recuo_divisa(zp, base_m, pavimento, h, lado="lateral"):
    """Recuo de lateral ou fundos pro pavimento `pavimento` cujo teto fica a h metros.
    Contagem do contrato v4: térreo = 1, então "1,50 m no térreo e no 1º pavimento" é ate_pavimento 2.
    Fundos usa `recuo_fundos_por_altura` e, se faltar, a regra lateral. Sem regra, vale o fixo."""
    regra = zp.get(f"recuo_{lado}_por_altura") or zp.get("recuo_lateral_por_altura")
    if not regra:
        return base_m
    if pavimento <= regra.get("ate_pavimento", 1):
        return max(base_m, regra.get("recuo_m", base_m))
    acima = regra["acima"]
    return max(base_m, acima.get("fracao_h", 0) * h, acima.get("minimo_m", 0))


class _Caixas:
    """Caixa recuada por (recuo lateral, recuo fundos), com cache. Coordenadas locais e de mundo."""

    def __init__(self, lote, frente, rf, origem, u):
        self.lote, self.frente, self.rf, self.origem, self.u = lote, frente, rf, origem, u
        self._c = {}

    def mundo(self, rl, rb):
        k = (round(rl, 2), round(rb, 2))
        if k not in self._c:
            self._c[k] = caixa_recuada(self.lote, self.frente, self.rf, *k)
        return self._c[k]

    def local(self, rl, rb):
        return _para_local(self.mundo(rl, rb), self.origem, self.u)


# ---------- estudo ----------

def _altura(pr, pav, terreo):
    if pav <= 0:
        return 0.0
    return (pr["pe_direito_terreo_m"] + (pav - 1) * pr["pe_direito_m"]) if terreo else pav * pr["pe_direito_m"]


def _volume(base_local, ctx, z0, pav, uso, terreo, rl, rb, pav_abaixo=0):
    base = _para_mundo(base_local, ctx["origem"], ctx["u"])
    return {"base_utm": _coords(base), "z0_m": _r(z0), "altura_m": _r(_altura(ctx["pr"], pav, terreo)),
            "pavimentos": pav, "uso": uso, "recuo_lateral_m": _r(rl), "recuo_fundos_m": _r(rb),
            "_geom": base, "_pav_abaixo": pav_abaixo}


def _recuos_topo(ctx, pav_topo, h_topo):
    zp = ctx["zp"]
    return (recuo_divisa(zp, ctx["rl"], pav_topo, h_topo), recuo_divisa(zp, ctx["rb"], pav_topo, h_topo, "fundos"))


def _avaliar(vols, ctx):
    """Métricas do contrato pra uma lista de volumes acima do chão. Devolve (metricas, subsolos, avisos)."""
    pr, A, zp = ctx["pr"], ctx["A"], ctx["zp"]
    nucleo = pr["nucleo_nao_computavel_m2"]
    acima = sum(v["_geom"].area * v["pavimentos"] for v in vols)
    nucleos = sum(min(nucleo, v["_geom"].area) * v["pavimentos"] for v in vols)
    priv, unid = 0.0, 0
    for v in vols:
        if v["uso"] != "residencial":
            continue
        laje = v["_geom"].area
        p = v["pavimentos"] * max(0.0, min(laje * pr["eficiencia"], laje - pr["area_comum_por_pavimento_m2"]))
        priv += p
        unid += int(p // pr["area_privativa_por_unidade_m2"] + 1e-9)
    vagas = math.ceil(unid * pr["vagas_por_unidade"] - 1e-9)
    avisos, subsolos = [], []
    if pr["garagem"] == "subsolo":
        nivel = ctx["subsolo"].area
        niveis = math.ceil(vagas * pr["area_por_vaga_m2"] / nivel - 1e-9) if vagas else 0
        if niveis > pr["subsolos_max"]:
            niveis = pr["subsolos_max"]
            cabem = int(niveis * nivel // pr["area_por_vaga_m2"])
            avisos.append(f"Faltam vagas: precisa de {vagas}, {niveis} subsolo(s) comportam {cabem}.")
            vagas = cabem
        garagem = niveis * nivel
        subsolos = [{"base_utm": _coords(ctx["subsolo"]), "z0_m": _r(-(k + 1) * pr["pe_direito_m"]),
                     "altura_m": _r(pr["pe_direito_m"]), "pavimentos": 1, "uso": "garagem"} for k in range(niveis)]
    else:
        garagem = vagas * pr["area_por_vaga_m2"]
    nao_comp = nucleos + (0 if pr["garagem_computavel"] else garagem)
    comp = acima + garagem - nao_comp
    no_chao = [v for v in vols if v["z0_m"] == 0]
    proj = unary_union([v["_geom"] for v in vols]).area
    proj_to = max(0.0, proj - sum(min(nucleo, v["_geom"].area) for v in no_chao))  # núcleo fora da TO
    ocupado = unary_union([v["_geom"] for v in vols] + ([ctx["subsolo"]] if subsolos else [])).area
    basico = zp.get("ca_basico")
    preco = pr["preco_venda_m2_privativo"]
    m = {
        "area_construida_m2": _r(acima + garagem),
        "area_computavel_m2": _r(comp),
        "area_nao_computavel_m2": _r(nao_comp),
        "area_privativa_m2": _r(priv),
        "area_acima_ca_basico_m2": _r(max(0.0, comp - basico * A)) if basico is not None else None,
        "area_garagem_m2": _r(garagem),
        "vagas": vagas,
        "area_permeavel_m2": _r(A - ocupado),  # o máximo possível: tudo sem prédio e sem subsolo
        "ca_usado": _r(comp / A, 3),
        "to_usada": _r(proj_to / A, 3),
        "pavimentos": max(v["_pav_abaixo"] + v["pavimentos"] for v in vols),
        "unidades_estimadas": unid,
        "vgv_estimado": _r(priv * preco) if preco else None,
    }
    return m, subsolos, avisos


def _cabe(m, vols, ctx):
    zp, A = ctx["zp"], ctx["A"]
    if m["area_computavel_m2"] > zp["ca_maximo"] * A + 0.01:
        return False
    if m["to_usada"] > (zp.get("taxa_ocupacao") or 1.0) + 1e-6:
        return False
    if ctx["altura_max"] and max(v["z0_m"] + v["altura_m"] for v in vols) > ctx["altura_max"] + 1e-6:
        return False
    if zp.get("pavimentos_max") and m["pavimentos"] > zp["pavimentos_max"]:
        return False
    return True


def _ajusta_ao_ca(fazer, n, ctx, m, cap):
    """O prédio de n andares passou do CA. Em vez de descartar (e piorar quando a regra afrouxa: andar é inteiro),
    encolhe as lajes (fator f da área natural) até o computável encostar no teto. Secante, poucas rodadas."""
    f0, c0, f = 1.0, m["area_computavel_m2"], 1.0
    achado = None
    f = f0 * cap / c0 * 0.9995
    for _ in range(7):
        vols = fazer(n, f)
        if vols is None:
            return achado
        m1, sub, av = _avaliar(vols, ctx)
        if _cabe(m1, vols, ctx):
            achado = (vols, m1, sub, av)
            if m1["area_computavel_m2"] >= cap * 0.9999:
                return achado
        c1 = m1["area_computavel_m2"]
        if abs(c1 - c0) < 1e-6:
            break
        f, f0, c0 = f + (cap * 0.99995 - c1) * (f - f0) / (c1 - c0), f, c1
        if not 0.05 < f < 1.0:
            break
    return achado


def _melhor(fazer, n_max, ctx):
    """Pavimentos da parte variável: vale o prédio de MAIOR área privativa (empate: o mais baixo), com a laje
    encolhida ao teto do CA quando o andar inteiro passaria dele (_ajusta_ao_ca). Escolher o máximo é o que
    garante a monotonia: afrouxar uma regra (recuo, CA, TO, altura) só cria opções iguais ou melhores. Nada de
    "o mais baixo que chega a 95%": esse limiar mudava o prédio escolhido quando a regra afrouxava e a opção piorava.
    Efeito: o núcleo não conta no CA, então com o CA no teto mais andares dão um pouco mais de privativa."""
    # ponytail: custo = 1 geração por pavimento (+ até 7 pra ajustar ao CA); sem poda além da altura/pavimentos da lei
    cap = ctx["zp"]["ca_maximo"] * ctx["A"]
    achados = []
    for n in range(1, n_max + 1):
        vols = fazer(n, 1.0)
        if vols is None:
            continue
        if ctx["altura_max"] and max(v["z0_m"] + v["altura_m"] for v in vols) > ctx["altura_max"] + 1e-6:
            break  # daqui pra cima só piora
        m, sub, av = _avaliar(vols, ctx)
        if _cabe(m, vols, ctx):
            achado = (vols, m, sub, av)
        elif m["area_computavel_m2"] > cap + 0.01:
            achado = _ajusta_ao_ca(fazer, n, ctx, m, cap)
        else:
            achado = None
        if achado is None:
            continue
        achados.append(achado)
    if not achados:
        return None
    melhor = max(v[1]["area_privativa_m2"] for v in achados)
    return next(v for v in achados if v[1]["area_privativa_m2"] >= melhor - 0.01)


def gerar_estudo(lote, zona, premissas=None):
    premissas = premissas or {}
    pr = dict(PREMISSAS_PADRAO, **premissas)
    pr["padrao"] = sorted(k for k in PREMISSAS_PADRAO if k not in premissas)
    zp = zona["parametros"]
    if zp.get("garagem_computavel") is not None:  # a lei manda sobre a premissa
        pr["garagem_computavel"] = zp["garagem_computavel"]
        pr["padrao"] = [k for k in pr["padrao"] if k != "garagem_computavel"]

    poly = Polygon(lote["poligono_utm"])
    if not poly.is_valid:
        poly = poly.buffer(0)
    A = poly.area
    u, _ = eixos_da_frente(lote["frente"], poly)
    origem = tuple(lote["frente"][0])
    rf = zp["recuo_frontal_m"] if zp.get("recuo_frontal_m") is not None else pr["recuo_frontal_m"]
    rl, rb = zp.get("recuo_lateral_m") or 0, zp.get("recuo_fundos_m") or 0
    caixas = _Caixas(poly, lote["frente"], rf, origem, u)
    regra = zp.get("recuo_lateral_por_altura")
    # térreo: recuo do 1º pavimento (com regra por altura, o de "ate_pavimento")
    rl0, rb0 = recuo_divisa(zp, rl, 1, pr["pe_direito_terreo_m"]), recuo_divisa(zp, rb, 1, pr["pe_direito_terreo_m"], "fundos")
    caixa = caixas.mundo(rl0, rb0)

    # subsolo: a caixa do térreo, encolhida no centro se for preciso pra sobrar a área permeável da lei
    subsolo = caixa
    perm = zp.get("taxa_permeabilidade") or 0
    if caixa.area > (1 - perm) * A:
        f = math.sqrt((1 - perm) * A / caixa.area)
        subsolo = affinity.scale(caixa, f, f, origin=caixa.centroid)

    # altura: zona e áreas especiais do lote (gabarito, cone), a mais baixa vale
    especiais = lote.get("areas_especiais") or []
    alturas_lim = [zp.get("altura_max_m")] + [e.get("altura_max_m") for e in especiais]
    alturas_lim = [x for x in alturas_lim if x]
    altura_max = min(alturas_lim) if alturas_lim else None

    ctx = {"pr": pr, "zp": zp, "A": A, "subsolo": subsolo, "u": u, "origem": origem,
           "rl": rl, "rb": rb, "altura_max": altura_max}

    to_max = zp.get("taxa_ocupacao") or 1.0
    laje_max = min(caixa.area, to_max * A)
    comp_max = zp["ca_maximo"] * A
    n_max = min(PAV_BUSCA_MAX, int(comp_max // pr["laje_minima_m2"]) + 1)

    # duas perguntas diferentes: o terreno está nessa zona? os números da zona foram conferidos?
    incertezas = []
    origem_zona = lote.get("zona_origem")
    texto_origem = {"oficial": "pelo mapa digital oficial", "anotada_a_mao": "lida à mão no anexo em PDF",
                    "teste": "escolhida só pra testar"}.get(origem_zona, "sem origem informada (falta zona_origem no lote)")
    if not lote.get("zona_conferida"):
        incertezas.append(f"Terreno na zona {zona['id']}: NÃO conferido ({texto_origem}). Confirmar a zona do lote antes de usar o estudo.")
    else:
        incertezas.append(f"Terreno na zona {zona['id']}: conferido ({texto_origem}).")
    if lote.get("zona_id") and lote["zona_id"] != zona["id"]:
        incertezas.append(f"O lote diz zona {lote['zona_id']}, mas o estudo usou {zona['id']}.")
    if not zona.get("conferido"):
        incertezas.append(f"Números da zona {zona['id']}: não conferidos na lei.")
    if zp.get("recuo_frontal_m") is None:
        incertezas.append(f"A lei não define recuo frontal: usado {rf:.1f} m (premissa). Vale a restrição do loteamento; conferir na matrícula.")
    if not altura_max and not zp.get("pavimentos_max"):
        incertezas.append("Nem a zona nem o lote limitam altura ou pavimentos: a altura saiu do CA. Conferir gabarito (aeroporto, cone visual etc.).")
    alertas_esp = []  # em cada opção: restrição que o motor NÃO aplicou (sem número de altura), pra ninguém ler o resultado como livre
    for e in especiais:
        if not e.get("altura_max_m"):
            alertas_esp.append(f"ÁREA ESPECIAL sem altura numérica, NÃO aplicada: {e.get('tipo', '?')}"
                               + (f" ({e['nome']})" if e.get("nome") else "") + ". O resultado pode passar do que o terreno permite; conferir antes de usar.")
        if e.get("altura_max_m"):
            incertezas.append(f"Área especial {e.get('tipo', '?')}: altura máxima {e['altura_max_m']} m ({e.get('fonte', 'sem fonte')}).")
        else:
            incertezas.append(f"Área especial {e.get('tipo', '?')} sem número de altura: não aplicada ({e.get('fonte', 'sem fonte')}).")
    if regra:
        a = regra["acima"]
        incertezas.append(f"Recuo lateral e de fundos por altura: {regra.get('recuo_m')} m até o {regra.get('ate_pavimento', 1)}º pavimento; "
                          f"acima, o maior entre h×{a.get('fracao_h')} e {a.get('minimo_m')} m (h = altura até o teto do último pavimento). "
                          "Torre, duas torres e lâmina usam o recuo do topo no prédio todo; embasamento + torre escalona.")
    elif zp.get("recuo_lateral_regra"):
        incertezas.append(f"Recuo lateral usado fixo ({rl} m): a regra por altura só veio em texto (\"{zp['recuo_lateral_regra'][:160]}...\"). Falta o campo recuo_lateral_por_altura na zona.")
    cega = zp.get("parede_cega_encosta_ate_m")
    if cega:
        incertezas.append(f"Parede cega (sem janela) encosta na divisa lateral e de fundos até {cega} m: usada só no embasamento da opção D. "
                          "Torre e apartamentos têm janela e mantêm o recuo. Acima de 12 m a lei pede 2,00 m mesmo pra parede cega (COE art. 70).")
    incertezas.append("Escada, elevador e shaft (núcleo, premissa) fora do CA e da TO; o resto acima do chão conta, inclusive varanda.")
    if pr["garagem"] == "subsolo":
        incertezas.append("Subsolo desenhado dentro da caixa do térreo (encolhido se faltar área permeável); a lei pode deixar o subsolo ir até a divisa.")
    else:
        incertezas.append(f"Garagem \"{pr['garagem']}\": só a área entra na conta, sem volume desenhado.")
    if zp.get("vagas_min_por_unidade") is None and "vagas_regra" in zp:
        incertezas.append("A lei não exige vaga mínima pra residencial: vagas vêm da premissa vagas_por_unidade.")
    else:
        incertezas.append("Vagas pela premissa vagas_por_unidade; a regra de vagas da lei ainda não entrou.")
    incertezas.append("Relevo ignorado: volumes assentados em terreno plano, z=0.")
    if pr["padrao"]:
        incertezas.append("Premissas no valor padrão do motor (não vieram do cliente): " + ", ".join(pr["padrao"]) + ".")

    opcoes = []

    def fecha(id_, nome, achado, motivo=""):
        if achado is None:
            incertezas.append(f"Opção {id_} ({nome}) não coube" + (f": {motivo}." if motivo else "."))
            return
        vols, m, sub, av = achado
        altura = max(v["z0_m"] + v["altura_m"] for v in vols)
        if regra or any(v.get("parede_cega") for v in vols):
            av = av + ["Recuo lateral/fundos: " + ", ".join(
                f"{v['uso']} {v['recuo_lateral_m']:.2f}/{v['recuo_fundos_m']:.2f} m"
                + (" (parede cega na divisa)" if v.get("parede_cega") else "") for v in vols)
                + (" (escalonado)." if len({v['recuo_lateral_m'] for v in vols}) > 1 else " (recuo do topo no prédio todo).")]
        opcoes.append({"id": id_, "nome": nome,
                       "volumes": [{k: x for k, x in v.items() if not k.startswith("_")} for v in vols] + sub,
                       "metricas": m, "alertas": av + alertas_esp + _alertas(m, altura, A, zp, altura_max)})

    def topo(n):  # recuos e caixa local de um prédio de n pavimentos a partir do chão
        r = _recuos_topo(ctx, n, _altura(pr, n, True))
        return r, caixas.local(*r)

    # A) Torre única: laje quadrada no meio da caixa
    def fazer_a(n, f=1.0):
        r, c = topo(n)
        laje = maior_retangulo(c, 1.0, min(laje_max, pr["laje_torre_max_m2"]))
        if f < 1:
            laje = maior_retangulo(c, 1.0, f * laje.area)
        if laje.area < pr["laje_minima_m2"]:
            return None
        return [_volume(laje, ctx, 0, n, "residencial", True, *r)]
    fecha("A", "Torre única", _melhor(fazer_a, n_max, ctx), "laje abaixo do mínimo")

    # B) Duas torres iguais: os dois maiores quadrados iguais que cabem na caixa, com o afastamento entre eles
    def fazer_b(n, f=1.0):
        r, c = topo(n)
        lajes = dois_quadrados(c, pr["afastamento_entre_torres_m"], min(laje_max / 2, pr["laje_torre_max_m2"]))
        if f < 1 and len(lajes) == 2:
            lajes = dois_quadrados(c, pr["afastamento_entre_torres_m"], f * lajes[0].area)
        if len(lajes) < 2 or lajes[0].area < pr["laje_minima_m2"]:
            return None
        return [_volume(l, ctx, 0, n, "residencial", True, *r) for l in lajes]
    fecha("B", "Duas torres", _melhor(fazer_b, n_max, ctx), "cada torre ficaria abaixo da laje mínima")

    # C) Lâmina baixa e larga: ocupa o máximo que a TO deixa, poucos andares
    def fazer_c(n, f=1.0):
        r, c = topo(n)
        lam = _maior_lamina(c, laje_max)
        if f < 1:
            lam = _maior_lamina(c, f * lam.area)
        if lam.area < pr["laje_minima_m2"]:
            return None
        return [_volume(lam, ctx, 0, n, "residencial", True, *r)]
    fecha("C", "Lâmina baixa", _melhor(fazer_c, pr["pavimentos_lamina_max"], ctx), "sem área")

    # D) Embasamento (lazer/comércio, sem unidades) + torre por cima, recuos escalonados
    nb = pr["pavimentos_embasamento"]
    hb = _altura(pr, nb, True)
    def tenta_d(base_cega):
        if base_cega:  # embasamento sem janela encosta na divisa lateral e de fundos
            rb_, cb = (0.0, 0.0), caixas.local(0.0, 0.0)
            laje_base = min(caixas.mundo(0.0, 0.0).area, to_max * A, pr["embasamento_ocupacao"] * A)
        else:
            (rb_, cb), laje_base = topo(nb), min(laje_max, pr["embasamento_ocupacao"] * A)
        if nb <= 0 or cb.is_empty:
            return None
        # a torre não passa de 90% da maior base possível (senão não é embasamento + torre)
        teto_torre = min(pr["laje_torre_max_m2"], 0.9 * min(cb.area, laje_base))
        base_livre = _maior_lamina(cb, laje_base)  # a maior base sozinha; serve quando a torre cabe nela (quase sempre)

        def fazer_d(n, f=1.0):
            r = _recuos_topo(ctx, nb + n, hb + _altura(pr, n, False))
            regiao_t = caixas.local(*r).intersection(cb)
            teto_t = teto_torre
            torre = maior_retangulo(regiao_t, 1.0, teto_t)  # a maior torre possível, onde couber
            if f < 1 and not torre.is_empty:
                teto_t = f * torre.area
                torre = maior_retangulo(regiao_t, 1.0, teto_t)
            if torre.area < pr["laje_minima_m2"]:
                return None
            # base: a maior sozinha, se a torre não perde nada por ficar dentro dela; senão a base nasce em volta da torre
            dentro = maior_retangulo(regiao_t.intersection(base_livre), 1.0, teto_t)
            if dentro.area >= torre.area - 0.02:
                torre, base_l = dentro, base_livre
            else:
                base_l = _maior_lamina(cb, laje_base, contem=torre)
            if base_l.area < pr["laje_minima_m2"] or torre.area >= base_l.area * 0.9:
                return None
            base = _volume(base_l, ctx, 0, nb, "embasamento", True, *rb_)
            if base_cega:
                base["parede_cega"] = True
            return [base, _volume(torre, ctx, hb, n, "residencial", False, *r, pav_abaixo=nb)]
        return _melhor(fazer_d, n_max, ctx)

    # com parede cega e sem: fica a que dá mais área privativa
    tentativas = [t for t in (tenta_d(False), tenta_d(True) if cega and hb <= cega + 1e-6 else None) if t]
    fecha("D", "Embasamento + torre",
          max(tentativas, key=lambda t: (t[1]["area_privativa_m2"], t[1]["area_computavel_m2"])) if tentativas else None,
          "a torre não ficou menor que a base, ou a base passou do limite")

    alturas = [v["z0_m"] + v["altura_m"] for o in opcoes for v in o["volumes"]]
    lims = [altura_max]
    if zp.get("pavimentos_max"):
        lims.append(_altura(pr, zp["pavimentos_max"], True))
    lims = [x for x in lims if x]
    altura_caixa = min(lims) if lims else (max(alturas) if alturas else 0)

    # degraus da caixa máxima: a projeção encolhe com a altura quando há regra por altura
    degraus = []
    if regra and altura_caixa:
        n_top = 1
        while _altura(pr, n_top + 1, True) <= altura_caixa + 1e-6:
            n_top += 1
        anterior = None
        for n in range(1, n_top + 1):
            r = _recuos_topo(ctx, n, _altura(pr, n, True))
            if r != anterior:
                degraus.append({"z0_m": _r(_altura(pr, n - 1, True)), "recuo_lateral_m": _r(r[0]),
                                "recuo_fundos_m": _r(r[1]), "projecao_utm": _coords(caixas.mundo(*r))})
                anterior = r
        if len(degraus) > 12:  # recuo contínuo (h/8): fica com 12 degraus espaçados
            passo = len(degraus) / 12
            degraus = [degraus[int(i * passo)] for i in range(12)]

    return {
        "versao_motor": VERSAO,
        "lote": lote,
        "zona": zona,
        "premissas": pr,
        "caixa_maxima": {"projecao_utm": _coords(caixa), "altura_m": _r(altura_caixa),
                         "area_projecao_m2": _r(caixa.area), "area_lote_m2": _r(A),
                         "area_computavel_max_m2": _r(comp_max), "ocupacao_max_m2": _r(to_max * A),
                         "recuo_frontal_m": _r(rf), "degraus": degraus,
                         "parede_cega_ate_m": cega,
                         "projecao_parede_cega_utm": _coords(caixas.mundo(0.0, 0.0)) if cega else None},
        "opcoes": opcoes,
        "incertezas": incertezas,
    }


def _alertas(m, altura, A, zp, altura_max):
    out = []

    def checa(nome, usado, lim, fmt):
        if lim is None:
            return
        if usado > lim * 1.0001:
            out.append(f"PASSOU: {nome} {fmt(usado)} acima do máximo {fmt(lim)}.")
        elif usado >= lim * FOLGA_LIMITE:
            out.append(f"No limite: {nome} {fmt(usado)} (máximo {fmt(lim)}).")

    checa("CA", m["ca_usado"], zp.get("ca_maximo"), lambda x: f"{x:.2f}")
    checa("taxa de ocupação", m["to_usada"], zp.get("taxa_ocupacao"), lambda x: f"{x:.0%}")
    checa("altura", altura, altura_max, lambda x: f"{x:.1f} m")
    checa("pavimentos", m["pavimentos"], zp.get("pavimentos_max"), lambda x: f"{x:.0f}")
    if m["area_acima_ca_basico_m2"]:
        out.append(f"{m['area_acima_ca_basico_m2']:.0f} m² acima do CA básico: exige outorga onerosa"
                   + ("." if zp.get("outorga_onerosa") else " (conferir se a zona permite)."))
    perm = zp.get("taxa_permeabilidade")
    if perm and m["area_permeavel_m2"] < perm * A - 1.0:  # 1 m² de folga pro arredondamento do subsolo
        out.append(f"Permeável possível {m['area_permeavel_m2']:.0f} m² menor que o exigido {perm * A:.0f} m² ({perm:.0%}).")
    return out
