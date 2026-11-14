"""Recortes ampliados com grade fina: python zoom.py img x0 y0 x1 y1 [zoom] [passo] [saida]"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGB')
x0, y0, x1, y1 = map(int, sys.argv[2:6])
z = int(sys.argv[6]) if len(sys.argv) > 6 else 6
p = int(sys.argv[7]) if len(sys.argv) > 7 else 5
g = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST)
d = ImageDraw.Draw(g)
for x in range(x0 - x0 % p, x1, p):
    if x >= x0:
        d.line(((x - x0) * z, 0, (x - x0) * z, g.height), fill=(255, 0, 0) if x % (p * 2) == 0 else (0, 200, 255))
        if x % (p * 2) == 0: d.text(((x - x0) * z + 2, 2), str(x), fill=(255, 0, 0))
for y in range(y0 - y0 % p, y1, p):
    if y >= y0:
        d.line((0, (y - y0) * z, g.width, (y - y0) * z), fill=(255, 0, 0) if y % (p * 2) == 0 else (0, 200, 255))
        if y % (p * 2) == 0: d.text((2, (y - y0) * z + 2), str(y), fill=(255, 0, 0))
g.save(sys.argv[8] if len(sys.argv) > 8 else 'zoom.png')
