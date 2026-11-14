"""Motor de viabilidade: Lote + Zona + premissas -> estudo (dict no formato do viabilidade/README.md, contrato v3).

Tudo em metros UTM. Determinístico: sem relógio, sem acaso, coordenadas arredondadas.
"""
import math
from functools import lru_cache

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, unary_union

VERSAO = "0.7.0"

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
    "pavimentos_sem_ca": 10,           # zona sem CA máximo (null na lei) e sem altura/pavimentos: até onde procurar (escolha de projeto, não lei)
    "pavimentos_max_projeto": 30,      # teto de pavimentos de TODA opção (D: embasamento + torre), quando a lei não pede menos (escolha de projeto, não lei)
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
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    # v tem que apontar pra dentro: um passo a partir do meio da frente (o centroide erra em lote em L, que fica atrás da frente)
    for s in (0.05, 0.5):
        pra_la = lote.contains(Point(mx + v[0] * s, my + v[1] * s))
        pra_ca = lote.contains(Point(mx - v[0] * s, my - v[1] * s))
        if pra_la != pra_ca:
            return u, (v if pra_la else (-v[0], -v[1]))
    c = lote.centroid  # frente solta do contorno: sobra o centroide
    return u, (v if (c.x - x1) * v[0] + (c.y - y1) * v[1] >= 0 else (-v[0], -v[1]))


def caixa_recuada(lote, frente, rf, rl, rb):
    """Tira do lote a faixa de recuo de cada aresta (um retângulo pra dentro, sem ponta que invada a divisa vizinha).
    Frente (rf): aresta virada pra rua e perto da linha da frente. Fundos (rb): aresta virada pro fundo e perto da
    linha de fundos (divisa inclinada conta se uma ponta chega lá); sem aresta de fundos, o vértice mais fundo ganha raio rb. O resto, inclusive divisa
    interna de lote em L, é lateral (rl). Em quina côncava as duas faixas deixam um vão: preenchido com a quina reta."""
    u, v = eixos_da_frente(frente, lote)
    x1, y1 = frente[0]
    cs = list(lote.exterior.coords)[:-1]
    pts = [p for i, p in enumerate(cs) if p != cs[i - 1]]  # sem vértice repetido
    prof = [(p[0] - x1) * v[0] + (p[1] - y1) * v[1] for p in pts]
    pmax = max(prof)
    tol = max(0.5, 0.15 * (pmax - min(prof)))  # quanto a frente (ou o fundo) pode "andar" pra dentro e ainda ser frente (fundo)
    horario = 1 if lote.exterior.is_ccw else -1
    n = len(pts)
    arestas = []  # (a, b, normal pra dentro, recuo, é fundos)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L  # normal pra fora do lote, comparada com v (que aponta pra dentro)
        if lote.contains(Point((a[0] + b[0]) / 2 + nx * 0.01, (a[1] + b[1]) / 2 + ny * 0.01)):
            nx, ny = -nx, -ny
        d = -(nx * v[0] + ny * v[1])  # 1 = aresta de frente, -1 = fundos
        p = ((a[0] + b[0]) / 2 - x1) * v[0] + ((a[1] + b[1]) / 2 - y1) * v[1]
        p_fundo = max((a[0] - x1) * v[0] + (a[1] - y1) * v[1], (b[0] - x1) * v[0] + (b[1] - y1) * v[1])  # ponta mais funda: divisa inclinada de fundos tem o meio longe do fundo
        frente_, fundos = d > 0.7 and abs(p) <= tol, d < -0.7 and p_fundo >= pmax - tol  # divisa de fundos só chega perto do fundo: degrau interno do L é lateral
        arestas.append((a, b, (-nx, -ny), rf if frente_ else rb if fundos else rl, fundos))
    faixas = []
    for i, (a, b, ni, r, _) in enumerate(arestas):
        if r > 0:
            faixas.append(Polygon([a, b, (b[0] + ni[0] * r, b[1] + ni[1] * r), (a[0] + ni[0] * r, a[1] + ni[1] * r)]))
        _, c, nj, rj, _ = arestas[(i + 1) % n]
        if r > 0 and rj > 0 and ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) * horario < -1e-9:  # quina côncava
            faixas.append(Polygon([b, (b[0] + ni[0] * r, b[1] + ni[1] * r), (b[0] + ni[0] * r + nj[0] * rj, b[1] + ni[1] * r + nj[1] * rj),
                                   (b[0] + nj[0] * rj, b[1] + nj[1] * rj)]))
    if rb > 0:  # ponta de divisa de fundos inclinada: a faixa reta deixa uma cunha no canto obtuso, o disco dá a distância certa até a divisa
        faixas += [Point(p).buffer(rb) for (p, _, _, _, f) in arestas if f] + [Point(q).buffer(rb) for (_, q, _, _, f) in arestas if f]
    if rb > 0 and not any(f for *_, f in arestas):
        faixas += [Point(p).buffer(rb) for p, q in zip(pts, prof) if q >= pmax - 1e-6]
    c = _maior_parte(lote.difference(unary_union(faixas)) if faixas else lote)
    return c if c.area > 1e-6 else Polygon()  # fiapo de ponto flutuante não é caixa


def _encolhe(poly, alvo):
    """Recua o polígono pra dentro, igual em todo lado, até sobrar `alvo` m². Nunca sai do polígono
    (escalar pelo centroide saía em lote em L, onde o centroide cai fora da quina)."""
    lo, hi = 0.0, math.sqrt(poly.area)
    for _ in range(40):
        mid = (lo + hi) / 2
        if poly.buffer(-mid, join_style="mitre").area > alvo:
            lo = mid
        else:
            hi = mid
    return _maior_parte(poly.buffer(-hi, join_style="mitre"))


def _cresce(poly, limite, alvo):
    """Faz o polígono crescer igual em todo lado, sem sair de `limite`, até ter `alvo` m² (ou o que o limite deixar)."""
    lo, hi = 0.0, math.sqrt(limite.area)
    for _ in range(40):
        mid = (lo + hi) / 2
        if poly.buffer(mid, join_style="mitre").intersection(limite).area < alvo:
            lo = mid
        else:
            hi = mid
    return _maior_parte(poly.buffer(lo, join_style="mitre").intersection(limite))


def _para_local(geom, origem, u):
    """Gira pra o eixo u virar x (frente na horizontal)."""
    return affinity.rotate(geom, -math.degrees(math.atan2(u[1], u[0])), origin=origem)


def _para_mundo(geom, origem, u):
    return affinity.rotate(geom, math.degrees(math.atan2(u[1], u[0])), origin=origem)


def _arestas(regiao):
    """Arestas da fronteira como array (n, 2, 2)."""
    out = []
    for g in ([regiao] if regiao.geom_type == "Polygon" else regiao.geoms):
        if g.geom_type != "Polygon":  # coleção com ponto ou linha solta
            continue
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


@lru_cache(maxsize=4096)  # funções puras; a geometria do shapely 2 é imutável e hasheável, e vários pavimentos repetem a mesma região
def maior_retangulo(regiao, proporcao, area_max=None, contem=None):
    """Maior retângulo com largura/profundidade = proporcao que cabe na região, EM QUALQUER POSIÇÃO.
    (Antes ele ficava centrado no centro da região: quando o recuo afrouxava de um lado só, o centro
    andava e o retângulo encolhia, mesmo o antigo ainda cabendo. Era a causa da opção D piorar.)
    Entre as posições possíveis, a mais perto do centro da região. `contem`: polígono que ele precisa cobrir."""
    if regiao.is_empty or regiao.area <= 0:  # interseção de regiões pode dar ponto ou linha
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
    if e.is_empty:  # região sem área (fiapo): _maior_s devolve o piso sem testar quando testa_lo é falso
        return Polygon()
    c = nearest_points(e, _ancora(regiao))[0]
    w, d = s * sp, s / sp
    return box(c.x - w / 2, c.y - d / 2, c.x + w / 2, c.y + d / 2)


# Proporções testadas na lâmina. Lista FIXA (não depende da caixa): com a do retângulo da caixa, afrouxar a
# regra mudava a lista de tentativas e a lâmina podia sair menor.
PROPORCOES_LAMINA = (0.2, 0.25, 0.33, 0.4, 0.5, 0.67, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0)


@lru_cache(maxsize=4096)  # funções puras; a geometria do shapely 2 é imutável e hasheável, e vários pavimentos repetem a mesma região
def _maior_lamina(regiao, area_max, contem=None):
    """Maior retângulo (qualquer proporção da lista). Experimenta primeiro a proporção mais parecida com a da
    caixa e só troca por outra se for MAIOR (empate fica com a primeira); pula as que, pelo tamanho da caixa,
    não têm como ganhar. Poda exata: o resultado é o mesmo de testar todas."""
    if regiao.is_empty or regiao.area <= 0:
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


@lru_cache(maxsize=4096)  # funções puras; a geometria do shapely 2 é imutável e hasheável, e vários pavimentos repetem a mesma região
def dois_quadrados(regiao, folga, area_max=None):
    """Dois quadrados IGUAIS, os maiores que cabem na região com `folga` entre eles (em x ou em y).
    Exato: dois quadrados de lado s cabem se os centros possíveis se estendem por pelo menos s + folga
    num dos eixos. Devolve () se não couber (tupla: o resultado fica no cache e não pode ser alterado por quem chama)."""
    if regiao.is_empty or regiao.area <= 0:
        return ()
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
        return ()
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
    return tuple(quadrados)


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

    def __init__(self, lote, frente, rf, origem, u, area_max=None):
        self.lote, self.frente, self.rf, self.origem, self.u = lote, frente, rf, origem, u
        self.area_max = area_max  # (1 - permeabilidade) * A: o que dá pra ocupar (prédio + subsolo) no chão
        self.limite = None        # região do térreo encolhida a area_max, quando a caixa legal é maior que isso
        self._c = {}

    def legal(self, rl, rb):
        """A caixa pelos recuos da lei, sem o limite de permeabilidade."""
        k = ("legal", round(rl, 2), round(rb, 2))
        if k not in self._c:
            self._c[k] = caixa_recuada(self.lote, self.frente, self.rf, k[1], k[2])
        return self._c[k]

    def fixa_limite(self, terreo):
        """Com a permeabilidade apertada, prédio e subsolo ficam dentro do térreo encolhido (a união nunca passa de area_max)."""
        if self.area_max is not None and terreo.area > self.area_max:
            self.limite = _encolhe(terreo, self.area_max)
        return self.limite

    def mundo(self, rl, rb, livre=False):
        """Onde o prédio pode ficar. `livre`: parede cega, que tem o próprio limite (encolhido sozinho)."""
        k = (livre, round(rl, 2), round(rb, 2))
        if k not in self._c:
            g = self.legal(rl, rb)
            if livre:
                if self.area_max is not None and g.area > self.area_max:
                    g = _encolhe(g, self.area_max)
            elif self.limite is not None:
                g = _maior_parte(g.intersection(self.limite))
            self._c[k] = g
        return self._c[k]

    def local(self, rl, rb, livre=False):
        return _para_local(self.mundo(rl, rb, livre), self.origem, self.u)


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
        por_andar = max(0.0, min(laje * pr["eficiencia"], laje - pr["area_comum_por_pavimento_m2"]))
        priv += v["pavimentos"] * por_andar
        # apartamento não atravessa andar: divide por pavimento, depois multiplica (a sobra de um andar não completa o de cima)
        unid += v["pavimentos"] * int(por_andar // pr["area_privativa_por_unidade_m2"] + 1e-9)
    vagas = math.ceil(unid * pr["vagas_por_unidade"] - 1e-9)
    avisos, subsolos = [], []
    if pr["garagem"] == "subsolo":
        nivel = ctx["subsolo"].area
        if not vagas:
            niveis = 0
        elif nivel > 0:
            niveis = math.ceil(vagas * pr["area_por_vaga_m2"] / nivel - 1e-9)
        else:
            niveis = pr["subsolos_max"] + 1  # sem área de subsolo: cai no aviso de falta de vaga, sem dividir por zero
        if niveis > pr["subsolos_max"]:
            niveis = pr["subsolos_max"]
            cabem = int(niveis * nivel // pr["area_por_vaga_m2"])
            avisos.append(f"Faltam vagas: precisa de {vagas}, {niveis} subsolo(s) comportam {cabem}. Em metricas.vagas ficam as {cabem}.")
            vagas = cabem
        garagem = niveis * nivel
        precisa = vagas * pr["area_por_vaga_m2"]
        if pr["garagem_computavel"] and niveis and precisa < garagem - 0.01:
            garagem = precisa  # subsolo conta no CA: só o que as vagas pedem, o nível encolhe (senão caixa maior roubava andar do prédio)
        subsolos = [{"base_utm": _coords(ctx["subsolo"]), "z0_m": _r(-(k + 1) * pr["pe_direito_m"]),
                     "altura_m": _r(pr["pe_direito_m"]), "pavimentos": 1, "uso": "garagem",
                     "_nivel_m2": garagem / niveis} for k in range(niveis)]
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
    if m["area_computavel_m2"] > ctx["cap"] + 0.01:
        return False
    if m["area_permeavel_m2"] < ctx["perm_min"] - 0.1:
        return False
    if m["to_usada"] > (zp.get("taxa_ocupacao") or 1.0) + 1e-6:
        return False
    if ctx["altura_max"] and max(v["z0_m"] + v["altura_m"] for v in vols) > ctx["altura_max"] + 1e-6:
        return False
    if m["pavimentos"] > ctx["pav_cap"]:
        return False
    return m["unidades_estimadas"] >= 1  # opção sem apartamento não é opção


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
        nf = f + (cap * 0.99995 - c1) * (f - f0) / (c1 - c0)
        if nf >= 1.0:  # a secante passou do tamanho natural: a resposta está perto do topo, vai pro meio do caminho
            nf = (f + 1.0) / 2
        f, f0, c0 = nf, f, c1
        if f <= 0.05:
            break
    return achado


def _sub_final(s, ctx):
    """Subsolo que conta no CA: o nível sai encolhido à área que as vagas pedem."""
    alvo = s.pop("_nivel_m2")
    if ctx["pr"]["garagem_computavel"] and alvo < ctx["subsolo"].area - 0.01:
        s["base_utm"] = _coords(_encolhe(ctx["subsolo"], alvo))
    return s


def _chave(achado):
    m = achado[1]
    return m["unidades_estimadas"], m["area_privativa_m2"]


def _parou_no_teto(fazer, n, ctx, melhor, base):
    """O melhor prédio tem n andares e o teto de projeto é o que impede o n+1? Só então vale o alerta (o CA ou a altura
    da lei pararem no mesmo andar não é escolha de projeto). Prova: o n+1, com o teto de pavimentos solto, daria mais apartamentos."""
    if base + n != ctx["pav_cap"] or ctx["pav_cap"] != ctx["pr"]["pavimentos_max_projeto"]:
        return False  # parou antes, ou o teto é da lei (zona) ou de pavimentos_sem_ca
    solto = dict(ctx, pav_cap=math.inf)
    vols = fazer(n + 1, 1.0)
    if vols is None or (ctx["altura_max"] and max(v["z0_m"] + v["altura_m"] for v in vols) > ctx["altura_max"] + 1e-6):
        return False
    m, sub, av = _avaliar(vols, solto)
    achado = (vols, m, sub, av) if _cabe(m, vols, solto) else _ajusta_ao_ca(fazer, n + 1, solto, m, solto["cap"]) if m["area_computavel_m2"] > solto["cap"] + 0.01 else None
    return achado is not None and _chave(achado) > _chave(melhor)


def _melhor(fazer, n_max, ctx, base=0):
    """Pavimentos da parte variável: vale o prédio com MAIS UNIDADES (o cliente compra apartamento); empate: maior área
    privativa, depois o mais baixo. A laje é encolhida ao teto do CA quando o andar inteiro passaria dele (_ajusta_ao_ca).
    Escolher o máximo dessa ordem é o que garante a monotonia: afrouxar uma regra (recuo, CA, TO, altura) só cria opções
    iguais ou melhores, então as unidades nunca caem, e com as mesmas unidades a privativa nunca cai.
    Nada de "o mais baixo que chega a 95%": esse limiar mudava o prédio escolhido quando a regra afrouxava e a opção piorava."""
    # ponytail: custo = 1 geração por pavimento (+ até 7 pra ajustar ao CA); sem poda além da altura/pavimentos da lei
    cap = ctx["cap"]
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
    unid, priv = max(_chave(v) for v in achados)
    vols, m, sub, av = next(v for v in achados if v[1]["unidades_estimadas"] == unid and v[1]["area_privativa_m2"] >= priv - 0.01)
    pr = ctx["pr"]
    if _parou_no_teto(fazer, m["pavimentos"] - base, ctx, (vols, m, sub, av), base):
        av = av + [f"Parou no teto de projeto de {pr['pavimentos_max_projeto']} pavimentos (premissa pavimentos_max_projeto, escolha de projeto, não é lei)."]
    return vols, m, sub, av


def gerar_estudo(lote, zona, premissas=None):
    premissas = premissas or {}
    pr = dict(PREMISSAS_PADRAO, **premissas)
    pr["padrao"] = sorted(k for k in PREMISSAS_PADRAO if k not in premissas)
    zp = zona["parametros"]
    if zp.get("garagem_computavel") is not None:  # a lei manda sobre a premissa
        pr["garagem_computavel"] = zp["garagem_computavel"]
        pr["padrao"] = [k for k in pr["padrao"] if k != "garagem_computavel"]

    incertezas = []
    poly = Polygon(lote["poligono_utm"])
    if not poly.is_valid:
        poly = _maior_parte(poly.buffer(0))  # laço (8) vira duas partes: fica a maior
        lote = dict(lote, poligono_utm=_coords(poly))  # o estudo descreve o que foi calculado
        incertezas.append("O polígono do lote se cruza; o estudo usou só a maior parte dele. Conferir o desenho do terreno.")
    if poly.is_empty or poly.area <= 0:
        raise ValueError("lote sem área: poligono_utm não forma um polígono")
    A = poly.area
    frente = [list(p) for p in lote["frente"]]
    if math.hypot(frente[1][0] - frente[0][0], frente[1][1] - frente[0][1]) < 1e-6:  # frente sem comprimento: a maior aresta
        pts = list(poly.exterior.coords)
        frente = list(max(zip(pts, pts[1:]), key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1])))
        frente = [list(p) for p in frente]
        lote = dict(lote, frente=frente)
        incertezas.append("A frente do lote veio com dois pontos iguais; o estudo usou a maior aresta como frente. Conferir qual lado dá pra rua.")
    u, _ = eixos_da_frente(frente, poly)
    origem = tuple(frente[0])
    rf = zp["recuo_frontal_m"] if zp.get("recuo_frontal_m") is not None else pr["recuo_frontal_m"]
    rl, rb = zp.get("recuo_lateral_m") or 0, zp.get("recuo_fundos_m") or 0
    perm = zp.get("taxa_permeabilidade") or 0
    caixas = _Caixas(poly, frente, rf, origem, u, area_max=(1 - perm) * A)
    regra = zp.get("recuo_lateral_por_altura")
    # térreo: recuo do 1º pavimento (com regra por altura, o de "ate_pavimento")
    rl0, rb0 = recuo_divisa(zp, rl, 1, pr["pe_direito_terreo_m"]), recuo_divisa(zp, rb, 1, pr["pe_direito_terreo_m"], "fundos")
    caixa = caixas.legal(rl0, rb0)

    # subsolo: o térreo; se a caixa passa do que a permeabilidade deixa ocupar, prédio e subsolo ficam no térreo encolhido
    caixas.fixa_limite(caixa)
    subsolo = caixas.mundo(rl0, rb0)

    # altura: zona e áreas especiais do lote (gabarito, cone), a mais baixa vale
    especiais = lote.get("areas_especiais") or []
    alturas_lim = [zp.get("altura_max_m")] + [e.get("altura_max_m") for e in especiais]
    alturas_lim = [x for x in alturas_lim if x]
    altura_max = min(alturas_lim) if alturas_lim else None

    to_max = zp.get("taxa_ocupacao") or 1.0
    # sem CA máximo na lei (null, ex.: SC-Z6E): o teto de computável some; sobram TO, recuos, altura e pavimentos
    comp_max = zp["ca_maximo"] * A if zp.get("ca_maximo") is not None else None
    pav_cap = min(pr["pavimentos_max_projeto"], zp.get("pavimentos_max") or math.inf)  # lei ou projeto, o menor, vale pra toda opção
    ctx = {"pr": pr, "zp": zp, "A": A, "subsolo": subsolo, "u": u, "origem": origem,
           "rl": rl, "rb": rb, "altura_max": altura_max, "pav_cap": pav_cap,
           "cap": comp_max if comp_max is not None else math.inf, "perm_min": perm * A}

    ocup_max = min(to_max, 1 - perm) * A  # projeção do prédio: TO e permeabilidade
    laje_max = min(caixa.area, subsolo.area if caixas.limite is not None else math.inf, ocup_max)
    if comp_max is not None:
        n_max = min(PAV_BUSCA_MAX, int(comp_max // pr["laje_minima_m2"]) + 1)
    elif zp.get("pavimentos_max"):
        n_max = zp["pavimentos_max"]
    else:  # sem CA e sem pavimentos na lei: a altura (se houver) não basta pra limitar, vale pavimentos_sem_ca
        n_max = pr["pavimentos_sem_ca"]
        ctx["pav_cap"] = pav_cap = min(pav_cap, n_max)  # o limite vale pro prédio todo (na D, embasamento + torre)
        incertezas.append(f"A lei não define CA máximo nem pavimentos pra essa zona"
                          + (f" (a altura limita a {altura_max:g} m)" if altura_max else ", nem altura")
                          + f": o motor procurou até {n_max} pavimentos (premissa pavimentos_sem_ca, escolha de projeto, não é lei).")
    n_max = min(n_max, pav_cap)
    if comp_max is None:
        incertezas.append("A lei não define CA máximo pra essa zona: o limite vem da taxa de ocupação, dos recuos, da altura e dos pavimentos.")

    # duas perguntas diferentes: o terreno está nessa zona? os números da zona foram conferidos?
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
    if zp.get("lote_min_m2") and A < zp["lote_min_m2"]:
        incertezas.append(f"Lote de {A:.0f} m² abaixo do mínimo da zona ({zp['lote_min_m2']} m²): o estudo não diz se o lote é edificável.")
    testada = LineString(frente).length
    if zp.get("testada_min_m") and testada < zp["testada_min_m"]:
        incertezas.append(f"Testada de {testada:.1f} m abaixo do mínimo da zona ({zp['testada_min_m']} m): o estudo não diz se o lote é edificável.")
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
    if pr["garagem_computavel"]:
        incertezas.append("Garagem conta no CA (garagem_computavel): nesse regime o resultado NÃO é monotônico. Afrouxar o recuo aumenta o subsolo, que gasta CA e pode tirar apartamento "
                          "(e a laje que cruza múltiplo de 60 m² dá degrau no computável). Tratar como estimativa. Em São Carlos a garagem não conta no CA.")
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
        sub = [_sub_final(s, ctx) for s in sub]
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
    fecha("A", "Torre única", _melhor(fazer_a, n_max, ctx), "laje abaixo do mínimo, ou nenhuma laje que caiba dá 1 apartamento por andar")

    # B) Duas torres iguais: os dois maiores quadrados iguais que cabem na caixa, com o afastamento entre eles
    def fazer_b(n, f=1.0):
        r, c = topo(n)
        lajes = dois_quadrados(c, pr["afastamento_entre_torres_m"], min(laje_max / 2, pr["laje_torre_max_m2"]))
        if f < 1 and len(lajes) == 2:
            lajes = dois_quadrados(c, pr["afastamento_entre_torres_m"], f * lajes[0].area)
        if len(lajes) < 2 or lajes[0].area < pr["laje_minima_m2"]:
            return None
        return [_volume(l, ctx, 0, n, "residencial", True, *r) for l in lajes]
    fecha("B", "Duas torres", _melhor(fazer_b, n_max, ctx), "cada torre ficaria abaixo da laje mínima, ou sem apartamento por andar")

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
            rb_, cb = (0.0, 0.0), caixas.local(0.0, 0.0, livre=True)
            laje_base = min(caixas.mundo(0.0, 0.0, livre=True).area, ocup_max, pr["embasamento_ocupacao"] * A)
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
            # duas bases pra mesma torre: a maior possível (a maior sozinha se a torre cabe nela; senão em volta da torre)
            # e a menor que ainda é embasamento (torre = 90% dela). A base gasta CA sem render unidade: quando a regra afrouxa,
            # a base grande cresce e pode tirar andar da torre; com a menor na disputa, afrouxar nunca piora.
            dentro = maior_retangulo(regiao_t.intersection(base_livre), 1.0, teto_t)
            if dentro.area >= torre.area - 0.02:
                torre, base_g = dentro, base_livre
            else:
                base_g = _maior_lamina(cb, laje_base, contem=torre)
            base_m = _cresce(torre, cb, min(laje_base, torre.area / 0.9 * 1.001))  # a torre crescida em volta; qualquer proporção
            opcoes_d = []
            # com a laje encolhida ao CA (f < 1) só a base menor: trocar de base no meio da busca dava um salto no computável
            # e a secante parava num f baixo (a D perdia 1% de privativa quando o recuo fixo caía de 2,5 pra 2,0 m)
            for base_l in ((base_g, base_m) if f >= 1 else (base_m,)):
                if base_l.area < pr["laje_minima_m2"] or torre.area > base_l.area * 0.9 + 0.01:  # folga de 1 cm²: a base crescida por bisseção sobra 1e-5 abaixo do alvo e matava a D
                    continue
                base = _volume(base_l, ctx, 0, nb, "embasamento", True, *rb_)
                if base_cega:
                    base["parede_cega"] = True
                vols = [base, _volume(torre, ctx, hb, n, "residencial", False, *r, pav_abaixo=nb)]
                m = _avaliar(vols, ctx)[0]
                opcoes_d.append(((_cabe(m, vols, ctx), m["unidades_estimadas"], m["area_privativa_m2"], base_l.area), vols))
            return max(opcoes_d, key=lambda t: t[0])[1] if opcoes_d else None
        return _melhor(fazer_d, min(n_max, pav_cap - nb), ctx, nb)  # o teto de pavimentos vale pro prédio todo: embasamento + torre

    # com parede cega e sem: fica a que dá mais área privativa
    tentativas = [t for t in (tenta_d(False), tenta_d(True) if cega and hb <= cega + 1e-6 else None) if t]
    fecha("D", "Embasamento + torre",
          max(tentativas, key=lambda t: (*_chave(t), t[1]["area_computavel_m2"])) if tentativas else None,
          "a torre não ficou menor que a base, a base passou do limite ou a torre não dá apartamento")

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
                                "recuo_fundos_m": _r(r[1]), "projecao_utm": _coords(caixas.legal(*r))})
                anterior = r
        if len(degraus) > 12:  # recuo contínuo (h/8): fica com 12 degraus espaçados
            degraus = [degraus[round(i * (len(degraus) - 1) / 11)] for i in range(12)]  # inclui o primeiro e o topo

    return {
        "versao_motor": VERSAO,
        "lote": lote,
        "zona": zona,
        "premissas": pr,
        "caixa_maxima": {"projecao_utm": _coords(caixa), "altura_m": _r(altura_caixa),
                         "area_projecao_m2": _r(caixa.area), "area_lote_m2": _r(A),
                         "area_computavel_max_m2": _r(comp_max) if comp_max is not None else None, "ocupacao_max_m2": _r(to_max * A),
                         "recuo_frontal_m": _r(rf), "degraus": degraus,
                         "parede_cega_ate_m": min(cega, altura_caixa) if cega and altura_caixa else cega,
                         "projecao_parede_cega_utm": _coords(caixas.legal(0.0, 0.0)) if cega else None},
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
