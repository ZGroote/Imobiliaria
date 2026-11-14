"""Foto -> vista de frente em metros num plano y=const (usa camera.json da peca).
   python retifica.py peca y x0 x1 z0 z1 [px_por_m] [saida]   grade a cada 5 cm (10 cm em vermelho)"""
import json, sys, numpy as np
from PIL import Image, ImageDraw
peca, y, x0, x1, z0, z1 = sys.argv[1], *map(float, sys.argv[2:7])
ppm = float(sys.argv[7]) if len(sys.argv) > 7 else 400
C = json.load(open(f"{peca}/camera.json"))
im = np.asarray(Image.open(next(f"{peca}/referencia.{e}" for e in ("png", "webp", "jpg") if __import__("os").path.exists(f"{peca}/referencia.{e}"))).convert("RGB"))
g = C["rotation_euler"][2]
c, s = np.cos(g), np.sin(g)
R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
xs = np.arange(x0, x1, 1 / ppm); zs = np.arange(z1, z0, -1 / ppm)
X, Z = np.meshgrid(xs, zs)
P = np.stack([X, np.full_like(X, y), Z], -1) - np.array(C["location"])
q = P @ R                                       # = (R.T @ P)
u = C["cx"] + C["f"] * q[..., 0] / -q[..., 2]
v = C["cy"] - C["f"] * q[..., 1] / -q[..., 2]
ui, vi = np.clip(np.round(u).astype(int), 0, im.shape[1] - 1), np.clip(np.round(v).astype(int), 0, im.shape[0] - 1)
out = Image.fromarray(im[vi, ui])
d = ImageDraw.Draw(out)
for k in range(int(np.ceil(x0 * 20)), int(x1 * 20) + 1):
    px = (k / 20 - x0) * ppm
    d.line((px, 0, px, out.height), fill=(255, 0, 0) if k % 2 == 0 else (0, 200, 255))
    if k % 2 == 0: d.text((px + 2, 2), "%d" % (k * 5), fill=(255, 255, 0))
for k in range(int(np.ceil(z0 * 20)), int(z1 * 20) + 1):
    pz = (z1 - k / 20) * ppm
    d.line((0, pz, out.width, pz), fill=(255, 0, 0) if k % 2 == 0 else (0, 200, 255))
    if k % 2 == 0: d.text((2, pz + 2), "%d" % (k * 5), fill=(255, 255, 0))
out.save(sys.argv[8] if len(sys.argv) > 8 else f"{peca}/retificada.png")
