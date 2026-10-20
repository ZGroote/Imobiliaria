"""Pinta as vistas escolhidas pelo remontar_vistas.py com as cores das fotos de treino e monta a folha:
verdade (Cycles) | remontada só com as fotos | splat (print do Tour) | rumo da foto usada (preto = sem foto).

python remontar_compor.py <pasta-do-remontar> <pasta-dos-prints-do-splat> <pasta-com-pngs> [<outra> ...]
Imprime, por vista, a diferença média de cor contra a verdade (0–255) da remontagem e do splat.
"""
import glob, os, sys
import numpy as np
from PIL import Image, ImageDraw

pasta, prints, fontes = sys.argv[1], sys.argv[2], sys.argv[3:] + [os.path.join(sys.argv[1], "fotos")]
cache = {}
def foto(i):
    if i not in cache:
        nome = f"f{i:04d}.png"
        caminho = next((os.path.join(d, nome) for d in fontes if os.path.exists(os.path.join(d, nome))), None)
        cache[i] = np.asarray(Image.open(caminho).convert("RGB")) if caminho else None   # ainda não renderizada
    return cache[i]

linhas = []
for npz in sorted(glob.glob(os.path.join(pasta, "*.npz"))):
    nome = os.path.basename(npz)[:-4]; a = np.load(npz); W, H = int(a["W"]), int(a["H"])
    esc, uv, ang = a["escolha"], a["uv"], a["angulo"]
    img = np.zeros((W * H, 3), np.uint8)
    for i in np.unique(esc[esc >= 0]):
        sel = esc == i; f = foto(int(i))
        if f is None: img[sel] = (255, 0, 255); continue   # magenta: foto ainda não renderizada
        k = f.shape[1] / 1280   # uv na resolução do plano; foto refeita pode ser menor
        x = np.clip((uv[sel, 0] * k).astype(int), 0, f.shape[1] - 1); y = np.clip((uv[sel, 1] * k).astype(int), 0, f.shape[0] - 1)
        img[sel] = f[y, x]
    remont = Image.fromarray(img.reshape(H, W, 3))
    verdade = Image.open(os.path.join(pasta, f"verdade-{nome}.png")).convert("RGB")
    splat = Image.open(os.path.join(prints, f"{nome}.jpg")).convert("RGB").resize((W, H))
    a8 = np.nan_to_num(np.clip(ang / 45, 0, 1), nan=1.0)   # 0° = branco, 45°+ = vermelho, sem foto = preto
    mapa = np.stack([255 * np.ones_like(a8), 255 * (1 - a8), 255 * (1 - a8)], -1).reshape(H, W, 3)
    mapa[(esc < 0).reshape(H, W)] = 0
    v = np.asarray(verdade, float)
    erro = lambda im: np.abs(np.asarray(im, float) - v).mean()
    print(f"{nome:13s} remontada {erro(remont):5.1f}   splat {erro(splat):5.1f}   sem foto {100 * (esc < 0).mean():4.1f}%"
          f"   rumo mediano {np.nanmedian(ang):4.1f}°")
    linhas.append((nome, [verdade, remont, splat, Image.fromarray(mapa.astype(np.uint8))]))

titulos = ["verdade (Cycles)", "só com as fotos de treino", "splat no ar", "rumo da foto (branco 0°, vermelho 45°+)"]
W, H = linhas[0][1][0].size
folha = Image.new("RGB", (4 * (W + 8) + 8, len(linhas) * (H + 20) + 22), "white"); d = ImageDraw.Draw(folha)
for k, t in enumerate(titulos): d.text((8 + k * (W + 8), 5), t, fill="black")
for n, (nome, ims) in enumerate(linhas):
    for k, im in enumerate(ims): folha.paste(im, (8 + k * (W + 8), 22 + n * (H + 20)))
    d.text((8, 22 + n * (H + 20) + H + 3), nome, fill="black")
folha.save(os.path.join(pasta, "remontagem.jpg"), quality=85)
