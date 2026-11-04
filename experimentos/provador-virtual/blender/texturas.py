"""Texturas procedurais da jaqueta: denim (atlas com costuras) e sherpa.

Gera cor + normal map. Tudo é desenhado em milímetros "do tecido" e
convertido para pixels de acordo com o atlas definido em modelo.py.
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import modelo

S = 2048
rng = np.random.default_rng(7)

# dimensões físicas de referência (tamanho M), em mm
M = modelo.TAMANHOS["M"]
CIRC_TRONCO = 1100.0
ALT_TRONCO = (modelo.F_GOLA - modelo.F_BAINHA) * M["altura"] * 1000
CIRC_MANGA = 2 * math.pi * 75.0
_, _LT = modelo.estacoes_braco(M)
COMP_MANGA = (_LT + 0.05 * M["altura"]) * 1000

LINHA = np.array([214, 150, 72], float)        # pesponto dourado
INDIGO_ESC = np.array([28, 50, 96], float)
INDIGO_CLA = np.array([150, 178, 214], float)


def ruido_fft(h, w, beta, seed, anis=(1.0, 1.0)):
    """Ruído contínuo e periódico (tileable) com espectro 1/f^beta."""
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None] * anis[0]
    fx = np.fft.fftfreq(w)[None, :] * anis[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = 1 / f ** beta
    amp[0, 0] = 0
    ph = np.exp(2j * np.pi * r.random((h, w)))
    n = np.real(np.fft.ifft2(amp * ph))
    return (n - n.mean()) / (n.std() + 1e-9)


class Regiao:
    """Retângulo do atlas com escala física: mm -> pixel."""

    def __init__(self, u0, v0, u1, v1, larg_mm, alt_mm):
        self.x0, self.x1 = u0 * S, u1 * S
        self.y0, self.y1 = (1 - v1) * S, (1 - v0) * S  # topo da imagem = v alto
        self.lm, self.am = larg_mm, alt_mm

    def px(self, u, v):
        """u, v locais da região (0..1, v=0 embaixo) -> pixel."""
        return (self.x0 + u * (self.x1 - self.x0), self.y1 - v * (self.y1 - self.y0))

    def mm_por_px(self):
        return self.lm / (self.x1 - self.x0), self.am / (self.y1 - self.y0)


def sarja(h, w, mmx, mmy, seed):
    """Sarja do denim: diagonais finas + fios de trama brancos + slubs verticais."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    X, Y = xx * mmx, yy * mmy
    diag = np.sin(2 * np.pi * (X * math.cos(1.1) + Y * math.sin(1.1)) / 1.9)
    fio = np.sin(2 * np.pi * Y / 0.7) * 0.3
    slub = ruido_fft(h, w, 1.0, seed, anis=(0.08, 1.0))           # estrias verticais
    mancha = ruido_fft(h, w, 1.6, seed + 1)                       # stone wash
    grao = rng.standard_normal((h, w))
    return diag, fio, slub, mancha, grao


def tracejado(draw, pts, mmx, mmy, cor, larg=2, traco=3.2, vao=1.3):
    """Pesponto: segmentos curtos ao longo de uma polilinha (em pixels)."""
    pts = [np.array(p, float) for p in pts]
    for a, b in zip(pts, pts[1:]):
        d = b - a
        mm = math.hypot(d[0] * mmx, d[1] * mmy)
        if mm < 1e-6:
            continue
        t = 0.0
        while t < mm:
            t1 = min(t + traco, mm)
            p0, p1 = a + d * (t / mm), a + d * (t1 / mm)
            draw.line([tuple(p0), tuple(p1)], fill=cor, width=larg)
            t = t1 + vao


def denim(saida):
    cor = np.zeros((S, S, 3))
    altura = np.zeros((S, S))
    costura = Image.new("L", (S, S), 0)     # sulcos (costuras)
    relevo = Image.new("L", (S, S), 0)      # áreas elevadas (lapelas)
    linha = Image.new("L", (S, S), 0)       # pespontos
    dc, dr, dl = ImageDraw.Draw(costura), ImageDraw.Draw(relevo), ImageDraw.Draw(linha)

    tronco = Regiao(*modelo.UV_TRONCO, CIRC_TRONCO, ALT_TRONCO)
    mangas = [Regiao(*modelo.UV_MANGA[s], CIRC_MANGA, COMP_MANGA) for s in (-1, 1)]

    # --- base do tecido, região por região (cada uma na sua escala física)
    for k, R in enumerate([tronco] + mangas):
        x0, x1, y0, y1 = int(R.x0), int(R.x1), int(R.y0), int(R.y1)
        mmx, mmy = R.mm_por_px()
        diag, fio, slub, mancha, grao = sarja(y1 - y0, x1 - x0, mmx, mmy, 10 + k)
        t = 0.40 + 0.10 * diag + 0.05 * fio + 0.06 * slub + 0.07 * mancha + 0.035 * grao
        cor[y0:y1, x0:x1] = INDIGO_ESC + np.clip(t, 0, 1)[..., None] * (INDIGO_CLA - INDIGO_ESC)
        altura[y0:y1, x0:x1] = 0.25 * diag + 0.1 * grao
    # preenche o vão entre regiões com o tecido do tronco (evita borda preta no mipmap)
    vazio = cor.sum(2) == 0
    cor[vazio] = INDIGO_ESC + 0.42 * (INDIGO_CLA - INDIGO_ESC)

    def f2v(f):
        return (f - modelo.F_BAINHA) / (modelo.F_GOLA - modelo.F_BAINHA)

    T = tronco.px
    tmx, tmy = tronco.mm_por_px()
    du = lambda mm: mm / CIRC_TRONCO      # mm horizontais -> u
    dv = lambda mm: mm / ALT_TRONCO       # mm verticais -> v

    def costura_dupla(pts_uv, R, lado=(1, 0), dist=(2.5, 8.5)):
        """Sulco da costura + duas linhas de pesponto paralelas de um lado."""
        mmx, mmy = R.mm_por_px()
        P = [R.px(*p) for p in pts_uv]
        dc.line(P, fill=255, width=4)
        for dmm in dist:
            off = (lado[0] * dmm / mmx, -lado[1] * dmm / mmy)
            tracejado(dl, [(x + off[0], y + off[1]) for x, y in P], mmx, mmy, 255)

    # --- tronco
    cos_v = dv(55)
    for uu in (0.0, 1.0):
        pass
    # cós (barra inferior)
    costura_dupla([(0, cos_v), (1, cos_v)], tronco, lado=(0, 1), dist=(2.5, 8.5))
    tracejado(dl, [T(0, dv(4)), T(1, dv(4))], tmx, tmy, 255)
    tracejado(dl, [T(0, dv(10)), T(1, dv(10))], tmx, tmy, 255)
    # vista / abertura central
    dc.line([T(0.5, 0), T(0.5, 1)], fill=255, width=5)
    for mm in (3, 30, 36):
        tracejado(dl, [T(0.5 + du(mm), dv(2)), T(0.5 + du(mm), 1 - dv(2))], tmx, tmy, 255)
    tracejado(dl, [T(0.5 - du(3), dv(2)), T(0.5 - du(3), 1 - dv(2))], tmx, tmy, 255)
    # pala dianteira (yoke) apontando para o bolso
    for s in (-1, 1):
        pts = [(0.5 + s * du(20), f2v(0.752)), (0.5 + s * 0.092, f2v(0.742)), (0.5 + s * 0.24, f2v(0.770))]
        costura_dupla(pts, tronco, lado=(0, 1), dist=(2.5, 8.0))
    # pregas verticais da frente e de trás
    for s in (-1, 1):
        for uc, topo in ((0.5 + s * 0.052, 0.742), (0.5 + s * 0.20, 0.765)):
            costura_dupla([(uc, cos_v), (uc, f2v(topo))], tronco, lado=(s, 0), dist=(2.5, 8.5))
    for uc in (0.085, 1 - 0.085):
        costura_dupla([(uc, cos_v), (uc, f2v(0.735))], tronco, lado=(1 if uc < 0.5 else -1, 0))
    # pala traseira em V
    costura_dupla([(0.0, f2v(0.735)), (0.24, f2v(0.770))], tronco, lado=(0, 1))
    costura_dupla([(1.0, f2v(0.735)), (0.76, f2v(0.770))], tronco, lado=(0, 1))
    # costuras laterais
    for uc in (0.25, 0.75):
        costura_dupla([(uc, 0), (uc, 1)], tronco, lado=(1, 0), dist=(2.5,))
    # abas das presilhas do cós (com botão)
    for s in (-1, 1):
        uc = 0.5 + s * 0.30
        pts = [(uc - s * du(60), dv(8)), (uc + s * du(14), dv(8)), (uc + s * du(14), dv(47)), (uc - s * du(60), dv(47))]
        dr.polygon([T(*p) for p in pts], fill=120)
        dc.line([T(*p) for p in pts + [pts[0]]], fill=200, width=3)
    # bolsos do peito: lapela pontuda + saco do bolso
    for s in (-1, 1):
        uc = 0.5 + s * 0.092
        w = du(62)
        topo, lado, ponta = f2v(0.739), f2v(0.718), f2v(0.703)
        lap = [(uc - w, topo), (uc + w, topo), (uc + w, lado), (uc, ponta), (uc - w, lado)]
        dr.polygon([T(*p) for p in lap], fill=255)
        dc.line([T(*p) for p in lap + [lap[0]]], fill=255, width=4)
        ins = [(uc - w + du(6), topo - dv(5)), (uc + w - du(6), topo - dv(5)), (uc + w - du(6), lado + dv(3)),
               (uc, ponta + dv(6)), (uc - w + du(6), lado + dv(3)), (uc - w + du(6), topo - dv(5))]
        tracejado(dl, [T(*p) for p in ins], tmx, tmy, 255)
        saco = [(uc - w + du(3), lado), (uc - w + du(3), f2v(0.668)), (uc, f2v(0.660)),
                (uc + w - du(3), f2v(0.668)), (uc + w - du(3), lado)]
        dc.line([T(*p) for p in saco], fill=150, width=3)
        tracejado(dl, [T(p[0] + (du(4) if p[0] < uc else -du(4)), p[1] + dv(4)) for p in saco], tmx, tmy, 255)
    # bolsos de mão (vivo inclinado)
    for s in (-1, 1):
        a, b = (0.5 + s * 0.145, f2v(0.598)), (0.5 + s * 0.175, f2v(0.680))
        dc.line([T(*a), T(*b)], fill=255, width=5)
        off = du(14) * s
        tracejado(dl, [T(a[0] + off, a[1]), T(b[0] + off, b[1]), T(b[0], b[1] + dv(4))], tmx, tmy, 255)
        tracejado(dl, [T(a[0] + off * 0.3, a[1]), T(b[0] + off * 0.3, b[1])], tmx, tmy, 255)

    # --- mangas
    for R in mangas:
        mmx, mmy = R.mm_por_px()
        cv = 65 / COMP_MANGA
        costura_dupla([(0, cv), (1, cv)], R, lado=(0, 1), dist=(2.5, 8.5))
        tracejado(dl, [R.px(0, 4 / COMP_MANGA), R.px(1, 4 / COMP_MANGA)], mmx, mmy, 255)
        costura_dupla([(0.5, cv), (0.5, 1)], R, lado=(1, 0))       # costura de trás
        costura_dupla([(0.002, 0), (0.002, 1)], R, lado=(1, 0), dist=(2.5,))  # costura de baixo
        # carcela do punho
        dc.line([R.px(0.75, 0), R.px(0.75, cv + 70 / COMP_MANGA)], fill=200, width=3)
        tracejado(dl, [R.px(0.75 + 5 / CIRC_MANGA, 0), R.px(0.75 + 5 / CIRC_MANGA, cv + 70 / COMP_MANGA)], mmx, mmy, 255)

    # --- composição
    c_mask = np.asarray(costura, float) / 255
    c_largo = np.asarray(costura.filter(ImageFilter.GaussianBlur(9)), float) / 255
    c_med = np.asarray(costura.filter(ImageFilter.GaussianBlur(3.5)), float) / 255
    r_mask = np.asarray(relevo.filter(ImageFilter.GaussianBlur(2)), float) / 255
    l_mask = np.asarray(linha.filter(ImageFilter.GaussianBlur(0.6)), float) / 255
    desgaste = ruido_fft(S, S, 1.2, 99)

    # "high-low": a borda elevada da costura desbota, o sulco escurece
    clarear = np.clip(c_largo * 2.2 - c_mask * 1.5, 0, 1) * (0.55 + 0.45 * np.clip(desgaste, -1, 1))
    cor = cor + clarear[..., None] * (INDIGO_CLA - cor) * 0.55
    cor = cor * (1 - 0.45 * c_med[..., None] * (c_mask[..., None] > 0.05) - 0.25 * c_mask[..., None])
    cor = cor * (1 + 0.06 * r_mask[..., None])
    cor = cor * (1 - l_mask[..., None]) + LINHA * l_mask[..., None] * (0.85 + 0.15 * (1 - c_mask[..., None]))
    Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8)).save(saida / "denim_cor.jpg", quality=88)

    # altura: sulcos fundos, painéis estufados (sherpa por dentro), pesponto em relevo
    estufado = 1 - np.asarray(costura.filter(ImageFilter.GaussianBlur(28)), float) / 255
    altura = altura * 0.25 + 3.0 * estufado - 2.6 * c_med + 0.9 * r_mask + 0.6 * l_mask
    _normal(altura, 1.4, saida / "denim_normal.jpg")


def _normal(alt, forca, caminho):
    gy, gx = np.gradient(alt)
    n = np.stack([-gx * forca, gy * forca, np.ones_like(alt)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(caminho, quality=90)


def sherpa(saida, T=1024):
    """Lã de carneiro sintética: tufos encaracolados, periódica."""
    tufos = ruido_fft(T, T, 0.6, 31)
    medio = ruido_fft(T, T, 1.4, 32)
    # anéis de cachos: |sin| do ruído gera contornos tipo "cacho"
    cachos = np.abs(np.sin(tufos * 2.6 + medio * 1.2))
    h = 0.6 * (1 - cachos) + 0.4 * np.clip(medio * 0.5 + 0.5, 0, 1)
    h += 0.08 * rng.standard_normal((T, T))
    h = (h - h.min()) / (h.max() - h.min())
    claro, escuro = np.array([238, 230, 212], float), np.array([168, 150, 122], float)
    k = np.clip(h ** 0.8, 0, 1)[..., None]
    cor = escuro + k * (claro - escuro)
    Image.fromarray(cor.astype(np.uint8)).save(saida / "sherpa_cor.jpg", quality=88)
    _normal(h * 6.0, 1.0, saida / "sherpa_normal.jpg")


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "texturas")
    out.mkdir(parents=True, exist_ok=True)
    denim(out)
    sherpa(out)
    print("texturas em", out)
