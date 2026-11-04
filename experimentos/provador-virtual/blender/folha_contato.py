"""Junta os renders do teste de tamanhos numa folha única com as folgas medidas."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

pasta = Path(sys.argv[1])
res = json.loads((pasta / "resultado.json").read_text())
ims = [Image.open(pasta / f"teste_{r['tamanho']}.png").convert("RGB") for r in res]
w, h = ims[0].size
crop = (60, 120, w - 60, h - 40)
cw, ch = crop[2] - crop[0], crop[3] - crop[1]
folha = Image.new("RGB", (cw * len(ims), ch + 150), (238, 240, 243))
d = ImageDraw.Draw(folha)
try:
    f1 = ImageFont.truetype("DejaVuSans-Bold.ttf", 30)
    f2 = ImageFont.truetype("DejaVuSansMono.ttf", 17)
except OSError:
    f1 = f2 = ImageFont.load_default()


def veredito(r):
    p = r["folga_cm"]["peito"]
    if min(r["folga_cm"].values()) < 0:
        return "APERTADA", (178, 58, 46)
    if p > 12:
        return "FOLGADA", (154, 106, 8)
    if p < 4:
        return "JUSTA", (154, 106, 8)
    return "VESTE BEM", (47, 125, 79)


for i, (im, r) in enumerate(zip(ims, res)):
    x = i * cw
    folha.paste(im.crop(crop), (x, 0))
    c = r["corpo"]
    v, cor = veredito(r)
    d.text((x + 16, ch + 12), f"Manequim {r['tamanho']}", font=f1, fill=(22, 33, 58))
    d.text((x + 16, ch + 52), f"{c['altura']*100:.0f} cm, peito {c['busto']*100:.0f}", font=f2, fill=(77, 88, 114))
    fp = r["folga_cm"]
    d.text((x + 16, ch + 76), f"folga peito {fp['peito']:+.0f} barra {fp['barra']:+.0f}", font=f2, fill=(77, 88, 114))
    d.text((x + 16, ch + 104), v, font=f1, fill=cor)
folha.save(pasta / "folha_contato.jpg", quality=86)
print(folha.size)
