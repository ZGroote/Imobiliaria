"""Passadas de fios.py -> textura que repete: la_fios_cor.png (cor x AO: a sombra entre os fios fica NA
COR, como o tufo da cama) e la_fios_nor.png. As passadas sao emissao gravada em sRGB (view Standard):
desfaz a curva pra ter o DADO (o normal era N*0,5+0,5 linear)."""
import os, numpy as np
import imageio.v3 as iio
from PIL import Image
M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "materiais")
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
# 16 bits: o PIL abre RGB de 16 bits convertido pra 8 (a conta dava zero); o imageio le inteiro
ler = lambda n: (lambda a: a.astype(np.float32) / (65535.0 if a.dtype == np.uint16 else 255.0))(iio.imread(os.path.join(M, "_fios_%s.png" % n)))
cor, ao, nor = lin(ler("cor")[..., :3]), lin(ler("ao")[..., :1]), lin(ler("normal")[..., :3])
final = cor * (0.30 + 0.70 * np.power(ao, 1.2))   # sombra do sulco NA COR (luz suave apaga o relevo)
Image.fromarray((srgb(final) * 255 + 0.5).astype(np.uint8)).save(os.path.join(M, "la_fios_cor.png"))
n = nor * 2 - 1
n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(M, "la_fios_nor.png"))
print("cor media", (srgb(final) * 255).reshape(-1, 3).mean(0).round(), "normal z medio", n[..., 2].mean().round(3))
