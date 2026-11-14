"""Referencia com grade de pixels (pra medir canto a olho): python grade.py peca/referencia.png [passo] [zoom]"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGB')
passo = int(sys.argv[2]) if len(sys.argv) > 2 else 50
z = float(sys.argv[3]) if len(sys.argv) > 3 else 2
g = im.resize((int(im.width * z), int(im.height * z)), Image.LANCZOS)
d = ImageDraw.Draw(g)
for x in range(0, im.width, passo):
    d.line((x * z, 0, x * z, g.height), fill=(255, 0, 0) if x % (passo * 2) == 0 else (0, 160, 255), width=1)
    d.text((x * z + 2, 2), str(x), fill=(255, 0, 0))
for y in range(0, im.height, passo):
    d.line((0, y * z, g.width, y * z), fill=(255, 0, 0) if y % (passo * 2) == 0 else (0, 160, 255), width=1)
    d.text((2, y * z + 2), str(y), fill=(255, 0, 0))
g.save(sys.argv[1].rsplit('.', 1)[0] + '_grade.png')
