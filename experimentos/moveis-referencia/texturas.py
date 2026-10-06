"""Texturas que REPETEM sem emenda (ruido filtrado na FFT e periodico por construcao), geradas
aqui e usadas IGUAIS no Cycles e no three -- a comparacao nao mistura duas texturas.
1024 px = 1 m (1 px = 1 mm). Veio ao longo de u (colunas).
    python texturas.py [nome ...]      -> materiais/<nome>_cor.png, _nor.png (+ _amostra.png)"""
import sys, os, numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
N = 1024


def ruido(lu, lv, semente, n=N):
    """Campo gaussiano periodico; lu/lv = comprimento de correlacao em px ao longo de u/v."""
    w = np.random.default_rng(semente).standard_normal((n, n))
    fv, fu = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * np.exp(-2 * np.pi ** 2 * ((fu * lu) ** 2 + (fv * lv) ** 2))))
    return (r - r.mean()) / r.std()


def normal_de(h, forca):
    """Altura -> normal em espaco tangente (OpenGL: verde = +v), periodica (np.roll)."""
    du = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * forca
    dv = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * forca      # linha 0 e o TOPO da imagem (v=1)
    n = np.stack([-du, -dv, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def srgb(c):
    return np.array(c, np.float32) / 255


def madeira(claro, escuro, semente):
    fibra = 0.6 * ruido(260, 1.5, semente) + 0.4 * ruido(90, 0.8, semente + 1)
    faixa = ruido(600, 22, semente + 2)
    mancha = ruido(160, 60, semente + 4)                          # variacao larga, sem direcao forte
    # catedral: aneis senoidais em v, bem entortados -- k inteiro mantem periodico
    v = np.arange(N)[:, None] / N
    fase = 5 * v + 0.9 * ruido(420, 160, semente + 3)
    anel = np.abs(np.sin(np.pi * fase)) ** 14
    t = 0.22 * fibra + 0.30 * faixa + 0.25 * mancha - 0.45 * anel
    t = 1 / (1 + np.exp(-1.8 * t))                               # 0 escuro .. 1 claro
    cor = srgb(escuro) + (srgb(claro) - srgb(escuro)) * t[..., None]
    h = 0.6 * t + 0.04 * fibra                                    # poro (escuro) mais fundo
    return cor, normal_de(h, 1.2)


def escovado(semente):
    """Aco escovado: risco fino ao longo de u, quase sem variacao de cor (o metal da a cor)."""
    risco = 0.7 * ruido(700, 0.6, semente) + 0.3 * ruido(200, 2.5, semente + 1)
    cor = np.full((N, N, 3), 0.92, np.float32) + 0.03 * risco[..., None]
    return cor, normal_de(risco * 0.25, 1.0)


def linho(semente):
    """Linho mesclado: fio grosso irregular (slub) nas duas direcoes + mescla larga. Cor quase
    branca -- a cor do tecido e a TINTA do material (um linho serve pra varias cores)."""
    n = np.arange(N)
    trama = 0.5 + 0.5 * np.cos(2 * np.pi * n / 2.0)                 # 2 px = 2 mm por fio
    urd = trama[None, :] * (0.6 + 0.4 * ruido(40, 0.7, semente)) + trama[:, None] * (0.6 + 0.4 * ruido(0.7, 40, semente + 1))
    slub = np.clip(ruido(14, 1.2, semente + 2), 0, None) + np.clip(ruido(1.2, 14, semente + 3), 0, None)
    mescla = ruido(60, 60, semente + 4)
    t = 0.035 * mescla + 0.03 * slub - 0.025 * urd
    cor = np.full((N, N, 3), 0.86, np.float32) + t[..., None]
    h = 0.5 * urd + 0.6 * slub
    return cor, normal_de(h, 0.35)


def blackout(semente):
    """Blackout de cortina: mescla FINA (fio) sem a mancha larga do linho -- no pano de 2,6 m a mescla
    de 6 cm do linho virava mancha suja."""
    n = np.arange(N)
    trama = 0.5 + 0.5 * np.cos(2 * np.pi * n / 2.0)
    urd = trama[None, :] * (0.6 + 0.4 * ruido(30, 0.7, semente)) + trama[:, None] * (0.6 + 0.4 * ruido(0.7, 30, semente + 1))
    fio = ruido(3, 3, semente + 2)
    t = 0.02 * fio - 0.015 * urd
    cor = np.full((N, N, 3), 0.86, np.float32) + t[..., None]
    return cor, normal_de(0.4 * urd + 0.3 * fio, 0.3)


def marmore(semente):
    """Marmore branco de veio cinza fino e esparso (calacata claro): veio = linha de nivel de um campo
    QUASE linear na diagonal (turbulencia baixa -- alta vira curva de nivel), afiada; fundo nebuloso leve."""
    base = ruido(160, 160, semente)
    turb = 0.7 * ruido(220, 220, semente + 1) + 0.3 * ruido(50, 50, semente + 2)
    v = np.arange(N)[:, None] / N
    u = np.arange(N)[None, :] / N
    fase = 2 * u + 3 * v + 0.12 * turb                            # inteiros por volta: periodico
    fino = 1 - np.clip(np.abs(np.sin(np.pi * (3 * u - 2 * v + 0.10 * ruido(140, 140, semente + 3)))) * 40, 0, 1)
    grosso = 1 - np.clip(np.abs(np.sin(np.pi * fase)) * 25, 0, 1)
    t = 0.45 * grosso + 0.25 * fino * (ruido(200, 200, semente + 4) > 0.3)
    cor = (np.array([0.93, 0.91, 0.88], np.float32) + 0.025 * base[..., None]
           - t[..., None] * np.array([0.32, 0.32, 0.31], np.float32))
    return cor, normal_de(0.02 * t, 0.5)


def la(semente, linha=12):
    """La grossa de tapete artesanal: tufos pequenos e irregulares em FILEIRAS soltas (a da foto corre na
    largura), sobrepostos, + fibra fina. A variacao forte vem da LUZ no relevo; a cor varia pouco.
    Periodico (soma com volta)."""
    rng = np.random.default_rng(semente)
    h = np.zeros((N, N), np.float32)
    yy, xx = np.mgrid[-10:11, -22:23]
    for r in range(N // linha):
        v0 = r * linha + rng.uniform(-5, 5)
        u = rng.uniform(0, 20)
        while u < N:
            L = rng.uniform(16, 36)
            a_ = np.radians(rng.uniform(-22, 22))
            ca, sa = np.cos(a_), np.sin(a_)
            xr, yr = xx * ca + yy * sa, -xx * sa + yy * ca
            blob = rng.uniform(0.5, 1.0) * np.exp(-(xr / (L / 2.4)) ** 2 - (yr / rng.uniform(3.5, 6.0)) ** 2)
            iy = (int(round(v0 + rng.uniform(-3, 3))) + np.arange(-10, 11)) % N
            ix = (int(u + L / 2) + np.arange(-22, 23)) % N
            h[np.ix_(iy, ix)] = np.maximum(h[np.ix_(iy, ix)], blob)
            u += L * rng.uniform(0.45, 0.7)
    fibra = ruido(9, 0.7, semente + 1)                              # fio ao longo da fileira
    h = h + 0.15 * fibra + 0.06 * ruido(1.2, 1.2, semente + 2)
    h = (h - h.min()) / (h.max() - h.min())
    # a sombra da fresta vai NA COR (como o tufo da cama): sob luz suave o relevo pintado some
    cor = np.array([0.95, 0.92, 0.85], np.float32) * (0.50 + 0.50 * h[..., None] ** 0.8)
    return cor, normal_de(h, 2.5)


MATS = {
    "la": lambda: la(51),
    "marmore": lambda: marmore(41),
    "linho": lambda: linho(21),
    "blackout": lambda: blackout(31),
    "inox_escovado": lambda: escovado(11),
    "madeira_nature": lambda: madeira((190, 140, 84), (140, 96, 54), 7),
}

if __name__ == "__main__":
    os.makedirs(os.path.join(AQUI, "materiais"), exist_ok=True)
    for nome in sys.argv[1:] or MATS:
        cor, nor = MATS[nome]()
        b = os.path.join(AQUI, "materiais", nome)
        Image.fromarray((np.clip(cor, 0, 1) * 255 + 0.5).astype(np.uint8)).save(b + "_cor.png")
        Image.fromarray((nor * 255 + 0.5).astype(np.uint8)).save(b + "_nor.png")
        c = Image.open(b + "_cor.png")
        dois = Image.new("RGB", (N * 2, N)); dois.paste(c, (0, 0)); dois.paste(c, (N, 0))   # emenda visivel?
        dois.resize((N, N // 2)).save(b + "_amostra.png")
        print(nome, "media", (np.asarray(c).reshape(-1, 3).mean(0)).round().tolist())
