"""Imagem lado a lado da comparação visual (versão atual × v4 no perfil alto × diferença 6×).
Usa as capturas de `node medicoes/comparar.mjs --q alto` (medicoes/comparacao/).

    python medicoes/montagem.py      -> medicoes/resultados/comparacao-alto.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
D = AQUI / 'comparacao'
LINHAS = ['maquete', 'conjunto', 'planta3d', 'visita-sala']
W, H, TOPO = 360, 230, 28


def rgb(f):
    im = Image.open(f).convert('RGBA')
    return Image.alpha_composite(Image.new('RGBA', im.size, (14, 20, 27, 255)), im).convert('RGB')


try:
    fonte = ImageFont.truetype('DejaVuSans.ttf', 15)
except OSError:
    fonte = ImageFont.load_default()
img = Image.new('RGB', (W * 3, TOPO + H * len(LINHAS)), (14, 20, 27))
d = ImageDraw.Draw(img)
for j, t in enumerate(['Versão atual (aprovada)', 'v4, perfil alto', 'Diferença ampliada 6×']):
    d.text((j * W + 10, 6), t, fill=(231, 235, 240), font=fonte)
for i, p in enumerate(LINHAS):
    a, b = rgb(D / f'{p}-base.png'), rgb(D / f'{p}-nova-alto.png')
    dif = np.abs(np.asarray(a, float) - np.asarray(b, float)).max(-1)
    for j, im in enumerate([a, b, Image.fromarray(np.uint8(np.clip(dif * 6, 0, 255))).convert('RGB')]):
        img.paste(im.resize((W, H), Image.LANCZOS), (j * W, TOPO + i * H))
saida = AQUI / 'resultados' / 'comparacao-alto.webp'
img.save(saida, 'WEBP', quality=82, method=6)
print(saida, saida.stat().st_size, 'bytes')
