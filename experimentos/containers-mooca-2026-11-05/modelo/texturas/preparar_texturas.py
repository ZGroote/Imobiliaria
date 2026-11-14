"""Texturas do exterior a partir de 3 materiais CC0 do ambientCG (ver LEIA-ME.md).

Reduz cor e relevo (normal GL) da grama e do concreto a 512 px em WebP e compõe, com as folhas da LeafSet024,
um "galho" de folhas com fundo transparente (folhas.webp) para os cartões da copa das árvores.
python experimentos/containers-mooca-2026-11-05/modelo/texturas/preparar_texturas.py <pasta com os zips abertos>
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat

AQUI = Path(__file__).resolve().parent
FONTE = Path(sys.argv[1])
TAM = 512


def lin(v):
    v /= 255
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4


def reduzir(asset, nome):
    cor = Image.open(FONTE/asset/f'{asset}_1K-JPG_Color.jpg').convert('RGB').resize((TAM, TAM), Image.LANCZOS)
    nor = Image.open(FONTE/asset/f'{asset}_1K-JPG_NormalGL.jpg').convert('RGB').resize((TAM, TAM), Image.LANCZOS)
    cor.save(AQUI/f'{nome}-cor.webp', quality=82, method=6)
    nor.save(AQUI/f'{nome}-normal.webp', quality=90, method=6)
    # Média linear da cor: a cena multiplica a textura por (cor do material / média), para manter o tom calibrado.
    media = [sum(lin(v)*n for v, n in enumerate(cor.getchannel(c).histogram()))/(TAM*TAM) for c in range(3)]
    return [round(m, 5) for m in media]


def folhas():
    cor = Image.open(FONTE/'LeafSet024'/'LeafSet024_1K-JPG_Color.jpg').convert('RGB')
    alfa = Image.open(FONTE/'LeafSet024'/'LeafSet024_1K-JPG_Opacity.jpg').convert('L')
    cor.putalpha(alfa)
    celula = cor.width//3
    soltas = [cor.crop((i*celula, j*celula, (i+1)*celula, (j+1)*celula)) for j in range(3) for i in range(3)]
    rng = random.Random(7)
    galho = Image.new('RGBA', (TAM, TAM), (0, 0, 0, 0))
    risco = ImageDraw.Draw(galho)
    # Galhinhos finos saindo do pé do cartão, e as folhas espalhadas ao longo deles.
    pontas = []
    for _ in range(5):
        x0, y0 = TAM/2+rng.uniform(-30, 30), TAM-10
        x1, y1 = rng.uniform(60, TAM-60), rng.uniform(40, TAM*.55)
        risco.line([(x0, y0), (x1, y1)], fill=(84, 64, 44, 255), width=5)
        pontas += [(x0+(x1-x0)*t, y0+(y1-y0)*t) for t in (.35, .55, .75, .95)]
    for _ in range(110):
        px, py = rng.choice(pontas)
        folha = rng.choice(soltas)
        lado = rng.randint(42, 72)
        f = folha.resize((lado, lado), Image.LANCZOS).rotate(rng.uniform(0, 360), Image.BICUBIC, expand=True)
        tom = rng.uniform(.72, 1.05)
        r, g, b, a = f.split()
        f = Image.merge('RGBA', [c.point(lambda v, k=k: min(255, int(v*tom*k))) for c, k in ((r, .95), (g, 1), (b, .9))]+[a])
        galho.alpha_composite(f, (int(px+rng.uniform(-55, 55)-f.width/2), int(py+rng.uniform(-55, 55)-f.height/2)))
    # Alfa duro: o site usa alphaTest, e a borda meio-transparente do JPG viraria franja escura.
    galho.putalpha(galho.getchannel('A').point(lambda v: 255 if v > 110 else 0))
    galho.save(AQUI/'folhas.webp', quality=88, method=6)
    rgb = Image.new('RGB', galho.size); rgb.paste(galho, mask=galho.getchannel('A'))
    n = sum(1 for v in galho.getchannel("A").tobytes() if v)
    media = [sum(lin(v)*k for v, k in enumerate(rgb.getchannel(c).histogram()[1:], 1))/n for c in range(3)]
    return [round(m, 5) for m in media], round(n/(TAM*TAM), 3)


medias = {'grama': reduzir('Grass004', 'grama'), 'concreto': reduzir('Concrete034', 'concreto')}
medias['folhas'], cobertura = folhas()
(AQUI/'medias.json').write_text(json.dumps({'mediaLinear': medias, 'coberturaFolhas': cobertura}, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'mediaLinear': medias, 'coberturaFolhas': cobertura,
                  'bytes': {p.name: p.stat().st_size for p in sorted(AQUI.glob('*.webp'))}}))
