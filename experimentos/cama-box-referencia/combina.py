"""Cor assada x AO assado, dosado aqui (em linear), e WebP pro navegador.
   python combina.py 0.25 0.35   (forca do AO no corpo e nos travesseiros)"""
import os, sys, numpy as np
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assado")
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
for nome, f in (("corpo_cor", float(sys.argv[1])), ("trav_cor", float(sys.argv[2]))):
    c = lin(np.asarray(Image.open(os.path.join(D, nome + "_crua.png")).convert("RGB"), np.float32) / 255)
    a = lin(np.asarray(Image.open(os.path.join(D, nome + "_ao.png")).convert("L"), np.float32) / 255)
    out = srgb(c * ((1 - f) + f * a[..., None]))
    Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(os.path.join(D, nome + ".webp"), quality=85, method=6)
    print(nome, "AO %.2f" % f, os.path.getsize(os.path.join(D, nome + ".webp")) // 1024, "KB")
