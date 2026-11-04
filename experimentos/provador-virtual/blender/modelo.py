"""Modelo paramétrico do manequim e da jaqueta (sem dependência do Blender).

Todas as posições de vértice são funções LINEARES das cinco medidas abaixo.
Por isso cada medida vira um shape key (morph target) exato: a malha de
qualquer corpo = base(mínimo) + soma(influência_i * delta_i), e o site só
precisa mexer nas influências.

Convenção: metros, Z para cima, manequim de frente para -Y.
"""
import math
import numpy as np

# medida: (mínimo, máximo) — o shape key vai do mínimo (influência 0) ao máximo (1)
FAIXAS = {
    "altura": (1.45, 2.05),   # estatura
    "ombros": (0.34, 0.54),   # largura biacromial
    "busto": (0.74, 1.36),    # circunferência do peito
    "cintura": (0.58, 1.30),  # circunferência da cintura
    "quadril": (0.78, 1.40),  # circunferência do quadril
}
PARAMS = list(FAIXAS)
MINIMO = {k: v[0] for k, v in FAIXAS.items()}

# Corpos de referência usados no teste de manequins (medidas do CORPO).
TAMANHOS = {
    "PP": dict(altura=1.60, ombros=0.39, busto=0.84, cintura=0.70, quadril=0.88),
    "P": dict(altura=1.68, ombros=0.41, busto=0.91, cintura=0.77, quadril=0.94),
    "M": dict(altura=1.75, ombros=0.44, busto=0.98, cintura=0.84, quadril=0.99),
    "G": dict(altura=1.80, ombros=0.46, busto=1.06, cintura=0.94, quadril=1.05),
    "GG": dict(altura=1.85, ombros=0.48, busto=1.14, cintura=1.04, quadril=1.12),
    "XG": dict(altura=1.88, ombros=0.50, busto=1.24, cintura=1.16, quadril=1.20),
}

# A JAQUETA É UMA PEÇA ÚNICA, de tamanho fixo, estimado pela foto de
# referência (327x322 px). Régua: cabide adulto de madeira (~44-45 cm entre as
# pontas, que ficam nas costuras do ombro, ~183 px) conferido pelos botões de
# metal de jaqueta trucker (~17 mm, ~7 px): os dois dão ~4,2 px/cm.
# Incerteza estimada: +-3 cm nas circunferências, +-2 cm nos comprimentos.
PECA = {
    "ombros": 0.44,         # costura a costura do ombro
    "peito": 1.06,          # circunferência externa na altura do peito (53 cm "axila a axila")
    "barra": 0.98,          # circunferência externa da barra (~49 cm de largura; laterais escondidas pelas mangas)
    "manga": 0.62,          # costura do ombro ao fim do punho
}


def params_peca():
    """Parâmetros do construtor que reproduzem as medidas fixas da peça."""
    # a manga mede 0.348*H a partir da articulação + ~0.03 m da cabeça da manga
    H = (PECA["manga"] - 0.03) / 0.348
    b = PECA["peito"] - 0.14
    c = 0.90 * b
    q = (PECA["barra"] - 0.10 - 0.25 * c - 0.20 * b) / 0.55
    return dict(altura=H, ombros=PECA["ombros"], busto=b, cintura=c, quadril=q)


def deslocamento_peca(altura_corpo):
    """Translação vertical (m) que apoia a jaqueta nos ombros de um corpo."""
    return 0.81 * (altura_corpo - params_peca()["altura"])


ESPESSURA_FORRO = 0.007   # denim + sherpa
ANG_BRACO = math.radians(11.0)
ANG_PERNA = math.radians(2.5)


# ---------------------------------------------------------------- utilidades
def _perimetro_unit(k, n, amostras=2000):
    """Perímetro da superelipse com semi-eixos (1, k) e expoente n."""
    t = np.linspace(0, 2 * math.pi, amostras, endpoint=False)
    c, s = np.cos(t), np.sin(t)
    x = np.sign(c) * np.abs(c) ** (2 / n)
    y = k * np.sign(s) * np.abs(s) ** (2 / n)
    p = np.stack([x, y], 1)
    return float(np.linalg.norm(np.roll(p, -1, 0) - p, axis=1).sum())


def semi_eixos(circ, k, n):
    a = circ / _perimetro_unit(k, n)
    return a, k * a


def catmull(vals, sub):
    """Interpola uma lista de vetores com Catmull-Rom (pesos fixos -> linear)."""
    vals = [np.asarray(v, float) for v in vals]
    out = []
    m = len(vals)
    for i in range(m - 1):
        p0 = vals[max(i - 1, 0)]
        p1, p2 = vals[i], vals[i + 1]
        p3 = vals[min(i + 2, m - 1)]
        for j in range(sub):
            t = j / sub
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(vals[-1])
    return out


def anel(centro, e1, e2, a, b, n, N, fase=0.0):
    t = fase + 2 * math.pi * np.arange(N) / N
    c, s = np.cos(t), np.sin(t)
    x = np.sign(c) * np.abs(c) ** (2 / n) * a
    y = np.sign(s) * np.abs(s) ** (2 / n) * b
    return np.asarray(centro) + np.outer(x, e1) + np.outer(y, e2)


class Malha:
    """Acumula vértices, faces (quads/tris), UVs por canto e material por face."""

    def __init__(self):
        self.v, self.f, self.uv, self.mat = [], [], [], []
        self.grupos = {}

    def _add(self, pts):
        base = sum(len(p) for p in self.v)
        self.v.append(np.asarray(pts, float))
        return base

    def tubo(self, aneis, mat, uv_rect=(0, 0, 1, 1), uvv=None, tampa_ini=None, tampa_fim=None,
             grupo=None, sentido=1):
        """aneis: lista de arrays (N,3). UV u ao redor, v ao longo (1 no primeiro anel).
        sentido=+1 normais para fora do eixo do tubo, -1 para dentro."""
        N = len(aneis[0])
        R = len(aneis)
        base = self._add(np.concatenate(aneis))
        u0, v0, u1, v1 = uv_rect
        if uvv is None:
            uvv = [1 - i / (R - 1) for i in range(R)]
        idx = lambda r, j: base + r * N + (j % N)
        uvp = lambda r, j: (u0 + (u1 - u0) * j / N, v0 + (v1 - v0) * uvv[r])
        faces, uvs = [], []
        for r in range(R - 1):
            for j in range(N):
                faces.append([(r, j), (r + 1, j), (r + 1, j + 1), (r, j + 1)])
        tampas = []
        for tampa, r, ini in ((tampa_ini, 0, True), (tampa_fim, R - 1, False)):
            if tampa is not None:
                c = self._add([tampa])
                tampas.append((c, r, ini))
        # orientação: compara a normal do primeiro quad com o raio do anel
        a0 = aneis[0] if R < 3 else aneis[R // 2]
        r0 = 0 if R < 3 else R // 2
        P = lambda r, j: aneis[r][j % N]
        nq = np.cross(P(r0 + (1 if r0 + 1 < R else -1), 0) - P(r0, 0), P(r0, 1) - P(r0, 0))
        if r0 + 1 >= R:
            nq = -nq
        radial = P(r0, 0) - a0.mean(0)
        flip = (np.dot(nq, radial) * sentido) < 0
        for q in faces:
            vi = [idx(r, j) for r, j in q]
            uq = [uvp(r, j) for r, j in q]
            if flip:
                vi, uq = vi[::-1], uq[::-1]
            self.f.append(vi); self.uv.append(uq); self.mat.append(mat)
        for c, r, ini in tampas:
            uc = (u0 + (u1 - u0) * 0.5, v0 + (v1 - v0) * uvv[r])
            for j in range(N):
                tri = [(r, j), (r, j + 1)] if ini else [(r, j + 1), (r, j)]
                vi = [idx(*t) for t in tri] + [c]
                uq = [uvp(*t) for t in tri] + [uc]
                if flip:
                    vi, uq = vi[::-1], uq[::-1]
                self.f.append(vi); self.uv.append(uq); self.mat.append(mat)
        if grupo:
            self.grupos.setdefault(grupo, []).extend(range(base, base + N * R))
        return base

    def ponte(self, base_a, base_b, N, mat, uvs):
        """Faces entre dois anéis já existentes (borda/espessura)."""
        for j in range(N):
            q = [base_a + j, base_a + (j + 1) % N, base_b + (j + 1) % N, base_b + j]
            self.f.append(q)
            self.uv.append([uvs] * 4)
            self.mat.append(mat)

    def vertices(self):
        return np.concatenate(self.v)


# ---------------------------------------------------------------- corpo
def _quadro_braco(s):
    d = np.array([s * math.sin(ANG_BRACO), 0, -math.cos(ANG_BRACO)])
    e1 = np.array([s * math.cos(ANG_BRACO), 0, math.sin(ANG_BRACO)])
    return d, e1, np.array([0, 1.0, 0])


def niveis_tronco(p):
    """Níveis do tronco do corpo: (frac_altura, a, b, n)."""
    H = p["altura"]
    aq, bq = semi_eixos(p["quadril"], 0.74, 2.2)
    ac, bc = semi_eixos(p["cintura"], 0.76, 2.2)
    ab, bb = semi_eixos(p["busto"], 0.70, 2.4)
    rn = 0.39 * p["busto"] / (2 * math.pi)
    o = p["ombros"]
    L = [
        (0.470, 0.80 * aq, 0.84 * bq, 2.2),
        (0.490, 0.95 * aq, 0.97 * bq, 2.2),
        (0.515, aq, bq, 2.2),
        (0.565, 0.5 * (aq + ac), 0.5 * (bq + bc), 2.2),
        (0.615, ac, bc, 2.2),
        (0.665, 0.45 * ac + 0.55 * ab, 0.45 * bc + 0.55 * bb, 2.3),
        (0.715, ab, bb, 2.4),
        (0.745, ab, 0.98 * bb, 2.5),
        (0.775, 0.55 * ab + 0.45 * 0.46 * o, 0.88 * bb, 2.6),
        (0.805, 0.47 * o, 0.62 * bb, 2.7),
        (0.818, 0.38 * o, 0.55 * bb, 2.5),
        (0.828, 0.22 * o + 0.6 * rn, 0.45 * bb, 2.2),
        (0.836, 1.15 * rn, 1.10 * rn, 2.0),
    ]
    return [(f * H, a, b, n) for f, a, b, n in L]


def estacoes_braco(p, ease=None):
    """Estações ao longo do braço: (t em m a partir da articulação, a, b)."""
    H, C = p["altura"], p["busto"]
    ru = 0.31 * C / (2 * math.pi)
    re = 0.255 * C / (2 * math.pi)
    rf = 0.27 * C / (2 * math.pi)
    rw = 0.172 * C / (2 * math.pi)
    Lu, Lf = 0.186 * H, 0.146 * H
    E = [
        (-0.034 * H, 0.15 * ru, 0.15 * ru),
        (-0.030 * H, 0.55 * ru, 0.55 * ru),
        (-0.022 * H, 0.85 * ru, 0.88 * ru),
        (-0.010 * H, 0.98 * ru, 1.02 * ru),
        (0.020 * H, 1.02 * ru, 1.05 * ru),
        (0.090 * H, 0.95 * ru, 1.00 * ru),
        (Lu - 0.02 * H, 0.97 * re, 1.0 * re),
        (Lu, 0.95 * re, 1.0 * re),
        (Lu + 0.04 * H, 0.93 * rf, 1.08 * rf),
        (Lu + 0.10 * H, 0.85 * (0.5 * rf + 0.5 * rw), 1.05 * (0.5 * rf + 0.5 * rw)),
        (Lu + Lf, 0.85 * rw, 1.12 * rw),
    ]
    return E, Lu + Lf


def corpo(p):
    H = p["altura"]
    m = Malha()
    # tronco
    lv = niveis_tronco(p)
    fino = catmull([(z, a, b, n) for z, a, b, n in lv], 5)
    ex, ey = np.array([1.0, 0, 0]), np.array([0, 1.0, 0])
    aneis = [anel((0, 0, z), ex, ey, a, b, n, 64, math.pi / 2) for z, a, b, n in fino]
    m.tubo(aneis, 0, tampa_ini=(0, 0, fino[0][0] - 0.01 * H), tampa_fim=(0, 0, fino[-1][0] + 0.004 * H))
    # pescoço
    rn = 0.39 * p["busto"] / (2 * math.pi)
    zs = np.linspace(0.81 * H, 0.885 * H, 8)
    m.tubo([anel((0, 0.006, z), ex, ey, rn * (1.0 - 0.06 * i / 7), rn * 1.02, 2.0, 32) for i, z in enumerate(zs)],
           0, tampa_ini=(0, 0.006, zs[0]), tampa_fim=(0, 0.006, zs[-1]))
    # cabeça (ovo de manequim)
    zc, hh = 0.932 * H, 0.066 * H
    aneis = []
    for i in range(1, 24):
        phi = math.pi * i / 24
        k = math.sin(phi)
        z = zc + hh * math.cos(phi)
        queixo = 0.86 if phi > math.pi / 2 else 1.0
        aneis.append(anel((0, -0.004 * H, z), ex, ey, 0.043 * H * k * queixo, 0.054 * H * k, 2.0, 40, math.pi / 2))
    m.tubo(aneis, 0, tampa_ini=(0, -0.004 * H, zc + hh), tampa_fim=(0, -0.004 * H, zc - hh))
    # braços + mãos
    for s in (-1, 1):
        d, e1, e2 = _quadro_braco(s)
        J = np.array([s * (0.5 * p["ombros"] - 0.03), 0, 0.788 * H])
        est, Lt = estacoes_braco(p)
        hp = [
            (Lt + 0.03 * H, 0.012 * H, 0.025 * H),
            (Lt + 0.06 * H, 0.011 * H, 0.028 * H),
            (Lt + 0.09 * H, 0.009 * H, 0.024 * H),
            (Lt + 0.105 * H, 0.006 * H, 0.016 * H),
        ]
        fino = catmull(est + hp, 3)
        aneis = [anel(J + d * t, e1, e2, a, b, 2.0, 32) for t, a, b in fino]
        m.tubo(aneis, 0, tampa_ini=J + d * (fino[0][0] - 0.002 * H), tampa_fim=J + d * (fino[-1][0] + 0.004 * H))
    # pernas + pés
    for s in (-1, 1):
        d = np.array([s * math.sin(ANG_PERNA), 0, -math.cos(ANG_PERNA)])
        e1 = np.array([math.cos(ANG_PERNA) * s, 0, math.sin(ANG_PERNA) * s])
        J = np.array([s * 0.088 * p["quadril"], 0, 0.495 * H])
        Lg = (0.495 - 0.045) * H / math.cos(ANG_PERNA)
        Q = p["quadril"] / (2 * math.pi)
        est = [
            (-0.05 * H, 0.70 * Q * 0.58, 0.70 * Q * 0.58),
            (0.0, 0.58 * Q, 0.60 * Q),
            (0.25 * Lg, 0.48 * Q, 0.50 * Q),
            (0.47 * Lg, 0.37 * Q, 0.38 * Q),
            (0.62 * Lg, 0.37 * Q, 0.40 * Q),
            (0.85 * Lg, 0.26 * Q, 0.27 * Q),
            (1.0 * Lg, 0.22 * Q, 0.23 * Q),
            (1.0 * Lg + 0.03 * H, 0.21 * Q, 0.22 * Q),
        ]
        fino = catmull(est, 4)
        aneis = [anel(J + d * t, e1, np.array([0, 1.0, 0]), a, b, 2.0, 32) for t, a, b in fino]
        m.tubo(aneis, 0, tampa_ini=J + d * fino[0][0], tampa_fim=J + d * (fino[-1][0] + 0.004 * H))
        A = J + d * Lg
        # pé: do calcanhar à ponta, ao longo de -Y
        pe = [(0.035, 0.012, 0.020), (0.030, 0.024, 0.030), (0.0, 0.030, 0.034), (-0.04, 0.033, 0.030),
              (-0.08, 0.036, 0.022), (-0.11, 0.032, 0.016), (-0.127, 0.020, 0.010)]
        aneis = []
        for y, hx, hz in catmull(pe, 3):
            c = np.array([A[0], y * H, 0.02 * H + hz * H * 0.5])
            aneis.append(anel(c, np.array([1.0, 0, 0]), np.array([0, 0, 1.0]), hx * H * 0.75, hz * H * 0.75, 2.4, 24))
        m.tubo(aneis, 0, tampa_ini=aneis[0].mean(0) + np.array([0, 0.004, 0]),
               tampa_fim=aneis[-1].mean(0) - np.array([0, 0.004, 0]))
    return m


# ---------------------------------------------------------------- jaqueta
# Layout do atlas da jaqueta (u0, v0, u1, v1) em coordenadas UV (v=0 embaixo)
UV_TRONCO = (0.0, 0.42, 1.0, 1.0)
UV_MANGA = {-1: (0.0, 0.0, 0.5, 0.40), 1: (0.5, 0.0, 1.0, 0.40)}
F_BAINHA, F_GOLA = 0.552, 0.846


def niveis_jaqueta(p, recuo=0.0):
    H = p["altura"]
    o = p["ombros"]
    rn = 0.39 * p["busto"] / (2 * math.pi)
    _, bb = semi_eixos(p["busto"], 0.70, 2.4)

    def circ(c, k=0.72, n=2.3):
        a, b = semi_eixos(c, k, n)
        return a - recuo, b - recuo

    abj, bbj = semi_eixos(p["busto"] + 0.14, 0.72, 2.4)
    q, c, b = p["quadril"], p["cintura"], p["busto"]
    L = [
        (F_BAINHA, *circ(0.55 * q + 0.25 * c + 0.20 * b + 0.10), 2.3),
        (0.585, *circ(0.35 * q + 0.35 * c + 0.30 * b + 0.11), 2.3),
        (0.625, *circ(0.10 * q + 0.45 * c + 0.45 * b + 0.12), 2.3),
        (0.670, *circ(0.25 * c + 0.75 * b + 0.13), 2.35),
        (0.715, abj - recuo, bbj - recuo, 2.4),
        (0.745, abj - recuo, 0.98 * bbj - recuo, 2.5),
        (0.775, 0.55 * abj + 0.45 * (0.46 * o + 0.03) - recuo, 0.90 * bbj - recuo, 2.6),
        (0.805, 0.47 * o + 0.038 - recuo, 0.62 * bb + 0.034 - recuo, 2.7),
        (0.822, 0.38 * o + 0.030 - recuo, 0.55 * bb + 0.028 - recuo, 2.5),
        (0.836, 0.22 * o + 0.6 * rn + 0.022 - recuo, 0.45 * bb + 0.022 - recuo, 2.2),
        (F_GOLA, 1.15 * rn + 0.020 - recuo, 1.10 * rn + 0.020 - recuo, 2.0),
    ]
    return [(f * H, f, a, b, n) for f, a, b, n in L]


def _frac_fino(sub=6):
    lv = niveis_jaqueta(dict(MINIMO))
    return [r[0] for r in catmull([(f,) for _, f, _, _, _ in lv], sub)]


def jaqueta(p):
    H = p["altura"]
    m = Malha()
    ex, ey = np.array([1.0, 0, 0]), np.array([0, 1.0, 0])
    NT, NS = 112, 56
    fr = _frac_fino()
    vt = [(f - F_BAINHA) / (F_GOLA - F_BAINHA) for f in fr]
    # material 0 = denim, 1 = sherpa, 2 = metal, 3 = forro (sherpa interno)
    camadas = {}
    for nome, recuo in (("fora", 0.0), ("dentro", ESPESSURA_FORRO)):
        lv = niveis_jaqueta(p, recuo)
        fino = catmull([(z, a, b, n) for z, _, a, b, n in lv], 6)
        aneis = [anel((0, 0, z), ex, ey, a, b, n, NT, math.pi / 2) for z, a, b, n in fino]
        # UV: v cresce para cima (gola); o tubo começa pela bainha
        camadas[nome] = (m.tubo(aneis, 0 if nome == "fora" else 3, UV_TRONCO, uvv=vt,
                                sentido=1 if nome == "fora" else -1, grupo="tronco_" + nome), len(aneis))
    # bainha com espessura
    bf, R = camadas["fora"]
    bd, _ = camadas["dentro"]
    m.ponte(bd, bf, NT, 0, (0.5, UV_TRONCO[1] + 0.003))
    m.ponte(bf + (R - 1) * NT, bd + (R - 1) * NT, NT, 1, (0.5, 0.5))
    # mangas
    for s in (-1, 1):
        d, e1, e2 = _quadro_braco(s)
        J = np.array([s * (0.5 * p["ombros"] - 0.03), 0, 0.788 * H])
        est, Lt = estacoes_braco(p)
        folga = []
        for t, a, b in est:
            fr_t = max(t, 0) / Lt
            e = 0.040 - 0.020 * fr_t  # folga diminui até o punho
            # cabeça da manga: pouca folga no eixo vertical, para não estufar o ombro
            cab = min(1.0, max(0.0, (t + 0.01 * H) / (0.06 * H)))
            folga.append((t, a + e * (0.25 + 0.75 * cab), b + e))
        folga[0] = (est[0][0] - 0.008 * H, 0.3 * folga[1][1], 0.3 * folga[1][2])
        folga.append((Lt + 0.016 * H, folga[-1][1], folga[-1][2]))
        fino = catmull(folga, 4)
        bases = {}
        for nome, recuo in (("fora", 0.0), ("dentro", ESPESSURA_FORRO)):
            aneis = [anel(J + d * t, e1, e2, max(a - recuo, 0.002), max(b - recuo, 0.002), 2.0, NS, math.pi)
                     for t, a, b in fino]
            bases[nome] = m.tubo(aneis, 0 if nome == "fora" else 3, UV_MANGA[s], sentido=1 if nome == "fora" else -1,
                                 tampa_ini=(J + d * (fino[0][0] - 0.003 * H)) if nome == "fora" else None,
                                 grupo=f"manga_{nome}")
            Rm = len(aneis)
        m.ponte(bases["fora"] + (Rm - 1) * NS, bases["dentro"] + (Rm - 1) * NS, NS, 0,
                (UV_MANGA[s][0] + 0.25, UV_MANGA[s][1] + 0.003))
    _gola(m, p)
    _botoes(m, p)
    return m


def _gola(m, p):
    """Gola de sherpa: varredura de uma seção achatada em volta do decote."""
    H = p["altura"]
    lv = niveis_jaqueta(p)
    _, _, a, b, _ = lv[-1]
    zg = F_GOLA * H
    phi0 = 0.30
    NP, NSec = 90, 20
    aneis = []
    for i in range(NP):
        phi = phi0 + (2 * math.pi - 2 * phi0) * i / (NP - 1)  # 0 = frente
        ang = -math.pi / 2 + phi  # ângulo no plano xy (frente = -y)
        radial = np.array([math.cos(ang), math.sin(ang), 0])
        fr = min(phi, 2 * math.pi - phi)
        w = max(0.0, 1 - (fr - phi0) / 1.0)
        w = w * w * (3 - 2 * w)  # suaviza: 1 na ponta da frente, 0 atrás
        base = np.array([a * math.cos(ang), b * math.sin(ang), zg - 0.035 * H * w])
        base = base + radial * (0.006 + 0.03 * w)
        psi = math.radians(74 + 14 * w)
        longo = math.cos(psi) * np.array([0, 0, 1.0]) + math.sin(psi) * radial
        curto = np.cross(longo, np.cross(radial, np.array([0, 0, 1.0])))
        curto = curto / np.linalg.norm(curto)
        centro = base + longo * (0.024 + 0.014 * w) + curto * 0.012
        aneis.append(anel(centro, longo, curto, 0.058 + 0.020 * w, 0.015, 2.2, NSec))
    m.tubo(aneis, 1, (0, 0, 1, 1), uvv=[i / (NP - 1) * 6 for i in range(NP)],
           tampa_ini=aneis[0].mean(0), tampa_fim=aneis[-1].mean(0))


def ponto_tronco(p, frac, u):
    """Ponto e normal (aprox.) sobre a casca externa da jaqueta, u=0.5 = frente."""
    H = p["altura"]
    lv = niveis_jaqueta(p)
    fr = [f for _, f, _, _, _ in lv]
    i = max(0, min(len(fr) - 2, int(np.searchsorted(fr, frac) - 1)))
    t = (frac - fr[i]) / (fr[i + 1] - fr[i])
    a = lv[i][2] * (1 - t) + lv[i + 1][2] * t
    b = lv[i][3] * (1 - t) + lv[i + 1][3] * t
    n = lv[i][4] * (1 - t) + lv[i + 1][4] * t
    th = math.pi / 2 + 2 * math.pi * u
    c, s = math.cos(th), math.sin(th)
    x = np.sign(c) * abs(c) ** (2 / n) * a
    y = np.sign(s) * abs(s) ** (2 / n) * b
    # normal com a proporção do corpo mínimo (constante -> mantém linearidade)
    lv0 = niveis_jaqueta(dict(MINIMO))
    a0, b0 = lv0[i][2], lv0[i][3]
    nr = np.array([math.cos(th) / a0, math.sin(th) / b0, 0])
    return np.array([x, y, frac * H]), nr / np.linalg.norm(nr)


BOTOES_FRENTE = [0.566, 0.597, 0.645, 0.694, 0.760, 0.818]
BOTOES_BOLSO = [(0.5 - 0.092, 0.708), (0.5 + 0.092, 0.708)]
BOTOES_COS = [(0.5 - 0.30, 0.569), (0.5 + 0.30, 0.569)]


def _botao(m, centro, normal):
    up = np.array([0, 0, 1.0])
    e1 = np.cross(up, normal)
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(normal, e1)
    perfil = [(-0.001, 0.0080), (0.0015, 0.0085), (0.0030, 0.0080), (0.0042, 0.0055), (0.0048, 0.0)]
    aneis = [anel(centro + normal * h, e1, e2, max(r, 0.0006), max(r, 0.0006), 2.0, 16) for h, r in perfil]
    m.tubo(aneis, 2, (0.5, 0.5, 0.5, 0.5), tampa_ini=centro - normal * 0.001)


def _botoes(m, p):
    for f in BOTOES_FRENTE:
        c, n = ponto_tronco(p, f, 0.5)
        _botao(m, c + n * 0.003, n)
    for u, f in BOTOES_BOLSO + BOTOES_COS:
        c, n = ponto_tronco(p, f, u)
        _botao(m, c + n * 0.003, n)
    # botão do punho, na parte de trás de cada manga
    H = p["altura"]
    for s in (-1, 1):
        d, e1, e2 = _quadro_braco(s)
        J = np.array([s * (0.5 * p["ombros"] - 0.03), 0, 0.788 * H])
        est, Lt = estacoes_braco(p)
        t = Lt - 0.012 * H
        a = est[-1][1] + 0.020
        c = J + d * t + e2 * (a + 0.004) + e1 * 0.0
        _botao(m, c, e2)


# ---------------------------------------------------------------- sondas de caimento
def perimetro_anel(a, b, n):
    return _perimetro_unit(b / a, n) * a


SONDAS = {"peito": 0.715, "cintura": 0.625, "barra": F_BAINHA}


def _c_corpo(p, frac):
    lv = niveis_tronco(p)
    H = p["altura"]
    zs = [z / H for z, *_ in lv]
    i = int(np.searchsorted(zs, frac) - 1)
    t = (frac - zs[i]) / (zs[i + 1] - zs[i])
    a, b, n = (lv[i][k] * (1 - t) + lv[i + 1][k] * t for k in (1, 2, 3))
    return perimetro_anel(a, b, n)


def sondas_corpo(p):
    """Circunferência do corpo nas alturas de prova."""
    return {k: _c_corpo(p, f) for k, f in SONDAS.items()}


def sondas_jaqueta():
    """Circunferência INTERNA (sobre o sherpa) da jaqueta nas mesmas alturas."""
    jaq = niveis_jaqueta(params_peca(), ESPESSURA_FORRO)
    fs = [f for _, f, *_ in jaq]
    out = {}
    for k, f in SONDAS.items():
        i = max(0, min(len(fs) - 2, int(np.searchsorted(fs, f) - 1)))
        t = (f - fs[i]) / (fs[i + 1] - fs[i])
        a, b, n = (jaq[i][j] * (1 - t) + jaq[i + 1][j] * t for j in (2, 3, 4))
        out[k] = perimetro_anel(a, b, n)
    return out
