"""Organiza fotos reais do interior; preserva os PNGs originais do canvas."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
CAP = ROOT / 'comparacoes'
BG = (13, 21, 28)
TXT = (227, 236, 240)
SUB = (164, 184, 196)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', size)

def contain(path, size, source=False):
    image = Image.open(path).convert('RGBA')
    image = Image.alpha_composite(Image.new('RGBA', image.size, (*BG, 255)), image).convert('RGB')
    if source:
        image = image.crop((85, 210, 895, 820))
    else:
        rows, cols = np.where(np.asarray(image).max(axis=2) > 76)
        if len(rows):
            pad = round(min(image.size) * .035)
            image = image.crop((max(0, int(cols.min()) - pad), max(0, int(rows.min()) - pad),
                                min(image.width, int(cols.max()) + pad + 1),
                                min(image.height, int(rows.max()) + pad + 1)))
    image = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
    card = Image.new('RGB', size, BG)
    card.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return card

def main():
    light = json.loads((ROOT / 'interior/luz/manifest.json').read_text('utf8'))
    unit = ROOT / 'interior/previa/unidade.json'
    if not light.get('ready') or light['unitSHA256'] != sha(unit):
        raise SystemExit('A luz própria deve corresponder à unidade final do construtor.')
    capture = json.loads((ROOT / 'qa/interior-capturas.json').read_text('utf8'))
    if (capture.get('etapa') != 'atlas-real-ativo'
            or capture['unidadeSHA256'] != sha(unit)
            or capture['sourceSHA256'] != light['sourceSHA256']
            or capture['textureSHA256'] != light['textureSHA256']):
        raise SystemExit('As fotos devem mostrar a unidade e o mapa de luz atuais.')
    for rel, expected in capture['capturasSHA256'].items():
        if sha(ROOT / rel) != expected:
            raise SystemExit('Captura alterada: ' + rel)
    board = Image.new('RGB', (1800, 900), BG)
    draw = ImageDraw.Draw(board)
    draw.text((38, 24), 'LIV IPANEMA · PLANTA 47,59 m²', fill=TXT, font=font(28))
    draw.text((38, 79), 'PLANTA PUBLICADA · LIVON', fill=SUB, font=font(18))
    draw.text((922, 79), 'CONSTRUTOR · FOTO REAL DA PLANTA 3D', fill=SUB, font=font(18))
    board.paste(contain(ROOT / 'referencias/planta-47-59.jpg', (852, 720), source=True), (36, 115))
    board.paste(contain(ROOT / 'qa/interior-topo.png', (852, 720)), (912, 115))
    draw.line((900, 112, 900, 835), fill=(51, 69, 79))
    draw.text((38, 864), 'Mesma orientação. Escala uniforme inferida; acabamentos e pé-direito aproximados. Fotos originais preservadas.',
              fill=SUB, font=font(17))
    CAP.mkdir(exist_ok=True)
    board.save(CAP / 'comparativo-interior.png')
    for label, name in [('Planta 3D', 'planta3d'), ('Sala', 'sala'), ('Suíte', 'suite')]:
        source = ROOT / ('qa/interior-' + name + '.png')
        if not source.is_file():
            raise SystemExit('Falta foto real do interior: ' + str(source))
        Image.open(source).save(CAP / ('interior-' + name + '.png'))
    print('INTERIOR_COMPARE_READY', light['textureSHA256'])

if __name__ == '__main__':
    main()
